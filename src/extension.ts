import * as vscode from 'vscode';
import * as path from 'path';
import { ProjectTreeProvider } from './json/projectTreeProvider';
import { AnnotationEditorProvider } from './json/annotationEditor';

export function activate(context: vscode.ExtensionContext) {
    console.log('Activating CodebaseNotes extension');

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

    context.subscriptions.push(
        treeView,
        vscode.window.registerWebviewViewProvider(AnnotationEditorProvider.viewType, annotationEditorProvider),
        ...registerCommands(projectTreeProvider, annotationEditorProvider, treeView, workspaceRoot)
    );

    setupEventListeners(context, projectTreeProvider, treeView, workspaceRoot);
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
            annotationEditorProvider.editAnnotation(element);
        }),
        vscode.commands.registerCommand('projectTree.editFolderAnnotation', (element: string) => {
            annotationEditorProvider.editAnnotation(element);
        }),
        vscode.commands.registerCommand('codebaseNotes.refreshTree', () => projectTreeProvider.refresh()),
        vscode.commands.registerCommand('codebaseNotes.copyRelativePath', (element: string) => {
            const relativePath = path.relative(workspaceRoot, element);
            vscode.env.clipboard.writeText(`[${relativePath}]`);
            vscode.window.showInformationMessage(`Copied relative path: ${relativePath}`);
        }),
        vscode.commands.registerCommand('codebaseNotes.revealInCodebaseNotes', (uri: vscode.Uri) => {
            if (uri && uri.scheme === 'file') {
                treeView.reveal(uri.fsPath, { select: true, focus: true, expand: true });
            } else {
                vscode.window.showErrorMessage('No file to reveal in CodebaseNotes');
            }
        })
    ];
}

function setupEventListeners(
    context: vscode.ExtensionContext, 
    projectTreeProvider: ProjectTreeProvider, 
    treeView: vscode.TreeView<string>,
    workspaceRoot: string
) {
    let isCodeBaseNotesActive = false;

    context.subscriptions.push(
        vscode.window.onDidChangeVisibleTextEditors(() => {
            isCodeBaseNotesActive = vscode.window.visibleTextEditors.some(
                editor => editor.document.uri.scheme === 'codebasenotes'
            );
            if (isCodeBaseNotesActive) {
                vscode.commands.executeCommand('codebaseNotes.refreshTree');
                revealActiveFileInTree(treeView, workspaceRoot);
            }
        }),
        vscode.window.registerWebviewViewProvider('codebaseNotes', {
            resolveWebviewView: () => {
                isCodeBaseNotesActive = true;
                vscode.commands.executeCommand('codebaseNotes.refreshTree');
                revealActiveFileInTree(treeView, workspaceRoot);
            }
        }),
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (isCodeBaseNotesActive) {
                revealActiveFileInTree(treeView, workspaceRoot);
            }
        }),
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            projectTreeProvider.refresh();
        })
    );
}

function revealActiveFileInTree(treeView: vscode.TreeView<string>, workspaceRoot: string) {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document.uri.scheme === 'file') {
        const filePath = activeEditor.document.uri.fsPath;
        if (filePath.startsWith(workspaceRoot)) {
            treeView.reveal(filePath, { select: true, focus: false, expand: true });
        }
    }
}

export function deactivate() {}