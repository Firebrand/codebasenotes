'use strict';

import * as vscode from 'vscode';
import { ProjectTreeProvider } from './json/projectTreeProvider';
import { AnnotationEditorProvider } from './json/annotationEditor';

export function activate(context: vscode.ExtensionContext) {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (workspaceRoot) {
        const annotationEditorProvider = new AnnotationEditorProvider(context.extensionUri, workspaceRoot);
        const projectTreeProvider = new ProjectTreeProvider(workspaceRoot, annotationEditorProvider);

        registerTreeView(context, projectTreeProvider);
        registerAnnotationEditor(context, annotationEditorProvider);
        registerCommands(context, projectTreeProvider, annotationEditorProvider);

        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            projectTreeProvider.refresh();
        });
    }
}

function registerTreeView(context: vscode.ExtensionContext, folderTreeProvider: ProjectTreeProvider) {
    const treeView = vscode.window.createTreeView('folderTree', { 
        treeDataProvider: folderTreeProvider, 
        showCollapseAll: true 
    });
    context.subscriptions.push(treeView);
}

function registerAnnotationEditor(context: vscode.ExtensionContext, annotationEditorProvider: AnnotationEditorProvider) {
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(AnnotationEditorProvider.viewType, annotationEditorProvider)
    );
}

function registerCommands(context: vscode.ExtensionContext, folderTreeProvider: ProjectTreeProvider, annotationEditorProvider: AnnotationEditorProvider) {
    context.subscriptions.push(
        vscode.commands.registerCommand('folderTree.openFileAndEditAnnotation', async (element: string) => {
            const document = await vscode.workspace.openTextDocument(element);
            await vscode.window.showTextDocument(document);
            annotationEditorProvider.editAnnotation(element);
        }),
        vscode.commands.registerCommand('folderTree.editFolderAnnotation', (element: string) => {
            annotationEditorProvider.editAnnotation(element);
        }),
        vscode.commands.registerCommand('projectdoc.refreshTree', () => folderTreeProvider.refresh())
    );
}

export function deactivate() {}