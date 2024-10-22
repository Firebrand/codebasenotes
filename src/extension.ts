import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ProjectTreeProvider } from './projectTreeProvider';
import { AnnotationEditorProvider } from './annotationEditor';
import { AnnotationListProvider } from './annotationListProvider';

let isTreeViewVisible: boolean = false;

export function activate(context: vscode.ExtensionContext) {

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('CodebaseNotes requires a workspace folder to be open.');
        return;
    }

    const annotationEditorProvider = new AnnotationEditorProvider(context.extensionUri, workspaceRoot);
    const projectTreeProvider = new ProjectTreeProvider(workspaceRoot, annotationEditorProvider);

    const treeView = vscode.window.createTreeView('projectTree', { 
        treeDataProvider: projectTreeProvider, 
        showCollapseAll: true 
    });

    // Listen for when the view becomes visible
    treeView.onDidChangeVisibility(async e => {
        isTreeViewVisible = e.visible;
        if (isTreeViewVisible) {
            await annotationEditorProvider.createAnnotationFileIfNotExists();
            projectTreeProvider.refresh();
        }
    });

    context.subscriptions.push(
        treeView,
        vscode.window.registerWebviewViewProvider(AnnotationEditorProvider.viewType, annotationEditorProvider),
        ...registerCommands(projectTreeProvider, annotationEditorProvider, treeView, workspaceRoot)
    );

    setupEventListeners(context, projectTreeProvider, treeView, workspaceRoot, annotationEditorProvider);

    const annotationListProvider = new AnnotationListProvider(context.extensionUri, workspaceRoot);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(AnnotationListProvider.viewType, annotationListProvider)
    );
}

function registerCommands(
    projectTreeProvider: ProjectTreeProvider, 
    annotationEditorProvider: AnnotationEditorProvider, 
    treeView: vscode.TreeView<string>,
    workspaceRoot: string
): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand('codebaseNotes.clearAndOpenItem', async (element: string, isDirectory: boolean) => {
            await vscode.commands.executeCommand('workbench.action.closeAllEditors');
            if (isDirectory) {
                await vscode.commands.executeCommand('projectTree.editFolderAnnotation', element);
            } else {
                await vscode.commands.executeCommand('projectTree.openFileAndEditAnnotation', element);
            }
        }),
        vscode.commands.registerCommand('projectTree.openFileAndEditAnnotation', async (element: string) => {
            const document = await vscode.workspace.openTextDocument(element);
            await vscode.window.showTextDocument(document);
        }),
        vscode.commands.registerCommand('projectTree.editFolderAnnotation', async (element: string) => {
            await annotationEditorProvider.editAnnotation(element);
        }),
        vscode.commands.registerCommand('codebaseNotes.refreshTree', () => projectTreeProvider.refresh()),
        vscode.commands.registerCommand('codebaseNotes.copyRelativePath', (element: string) => {
            const relativePath = path.relative(workspaceRoot, element);
            vscode.env.clipboard.writeText(`[${relativePath}]`);
            vscode.window.showInformationMessage(`Copied relative path: ${relativePath}`);
        }),
        vscode.commands.registerCommand('codebaseNotes.focus', () => {
            vscode.commands.executeCommand('workbench.view.extension.codebaseNotes');
        }),
        vscode.commands.registerCommand('codebaseNotes.revealItem', (itemPath: string) => {
            const fullPath = path.join(workspaceRoot, itemPath);
            // projectTreeProvider.reveal(fullPath);
            if (isTreeViewVisible) {
                revealAndLoadAnnotation(vscode.Uri.file(fullPath), treeView, workspaceRoot, projectTreeProvider, annotationEditorProvider);
            }
        })
    ];
}

function setupEventListeners(
    context: vscode.ExtensionContext, 
    projectTreeProvider: ProjectTreeProvider, 
    treeView: vscode.TreeView<string>,
    workspaceRoot: string,
    annotationEditorProvider: AnnotationEditorProvider
) {
    let isCodeBaseNotesActive = false;

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(async (editor) => {
            if (editor && editor.document.uri.scheme === 'file') {
                if (isTreeViewVisible) {
                    revealAndLoadAnnotation(editor.document.uri, treeView, workspaceRoot, projectTreeProvider, annotationEditorProvider);
                }
            }
        }),
        vscode.window.onDidChangeVisibleTextEditors(() => {
            isCodeBaseNotesActive = vscode.window.visibleTextEditors.some(
                editor => editor.document.uri.scheme === 'codebasenotes'
            );
            if (isCodeBaseNotesActive) {
                refreshAndRevealActiveFile();
            }
        }),
        vscode.window.registerWebviewViewProvider('codebaseNotes', {
            resolveWebviewView: () => {
                isCodeBaseNotesActive = true;
                refreshAndRevealActiveFile();
            }
        }),
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            projectTreeProvider.refresh();
        })
    );

    function refreshAndRevealActiveFile() {
        vscode.commands.executeCommand('codebaseNotes.refreshTree');
        vscode.commands.executeCommand('codebaseNotes.revealActiveFile');
    }

    treeView.onDidChangeVisibility(async (e) => {
        if (e.visible) {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                revealAndLoadAnnotation(activeEditor.document.uri, treeView, workspaceRoot, projectTreeProvider, annotationEditorProvider);
            }
        }
        isTreeViewVisible = e.visible;
    });
}

async function revealFileInTree(
    uri: vscode.Uri, 
    treeView: vscode.TreeView<string>, 
    workspaceRoot: string,
    projectTreeProvider: ProjectTreeProvider
) {
    try {
        if (uri && uri.scheme === 'file' && uri.fsPath.startsWith(workspaceRoot) && isTreeViewVisible) {
            const relativePath = path.relative(workspaceRoot, uri.fsPath);
            const pathParts = relativePath.split(path.sep);
            
            // Expand the tree to show the file
            for (let i = 0; i < pathParts.length - 1; i++) {
                const partialPath = path.join(workspaceRoot, ...pathParts.slice(0, i + 1));
                await expandDirectoryIfNeeded(partialPath, projectTreeProvider);
            }

            // Reveal the file
            await treeView.reveal(uri.fsPath, { select: true, focus: false, expand: 3 });
        }
    } catch (error) {
        console.error('Error revealing file:', error);
    }
}

async function expandDirectoryIfNeeded(dirPath: string, projectTreeProvider: ProjectTreeProvider) {
    try {
        const stats = await fs.stat(dirPath);
        if (stats.isDirectory()) {
            await projectTreeProvider.getChildren(dirPath);
        }
    } catch (error) {
        console.error(`Error processing path ${dirPath}:`, error);
    }
}

export function deactivate() {}



function revealAndLoadAnnotation(
    uri: vscode.Uri,
    treeView: vscode.TreeView<string>,
    workspaceRoot: string,
    projectTreeProvider: ProjectTreeProvider,
    annotationEditorProvider: AnnotationEditorProvider
) {
    if (uri && uri.scheme === 'file' && uri.fsPath.startsWith(workspaceRoot)) {
        revealFileInTree(uri, treeView, workspaceRoot, projectTreeProvider);
        annotationEditorProvider.editAnnotation(uri.fsPath);
    }
}

