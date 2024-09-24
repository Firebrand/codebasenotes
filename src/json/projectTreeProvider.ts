import * as vscode from 'vscode';
import * as path from 'path';
import { AnnotationEditorProvider } from './annotationEditor';
import { GitignoreParser } from './gitignoreUtils';
import * as fs from 'fs/promises';

export class ProjectTreeProvider implements vscode.TreeDataProvider<string> {
    private _onDidChangeTreeData: vscode.EventEmitter<string | undefined | null | void> = new vscode.EventEmitter<string | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<string | undefined | null | void> = this._onDidChangeTreeData.event;
    private gitignoreParser: GitignoreParser;
    private fileSystemWatcher: vscode.FileSystemWatcher;
    private treeItemCache: Map<string, vscode.TreeItem> = new Map();

    constructor(
        private workspaceRoot: string,
        private annotationEditorProvider: AnnotationEditorProvider
    ) {
        this.gitignoreParser = new GitignoreParser(workspaceRoot);
        this.fileSystemWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(this.workspaceRoot, '**/*')
        );
        this.setupEventListeners();
        this.annotationEditorProvider.onDidChangeAnnotation(this.handleAnnotationChange.bind(this));
    }

    private handleAnnotationChange(changedPath: string) {
        this.treeItemCache.delete(changedPath);
        this._onDidChangeTreeData.fire(changedPath);
    }

    private setupEventListeners() {
        this.annotationEditorProvider.onDidChangeAnnotation(() => this.refresh());
        
        this.fileSystemWatcher.onDidCreate((uri) => this.handleFileChange(uri, 'create'));
        this.fileSystemWatcher.onDidDelete((uri) => this.handleFileChange(uri, 'delete'));
        this.fileSystemWatcher.onDidChange((uri) => this.handleFileChange(uri, 'change'));

        vscode.workspace.onDidRenameFiles((event) => this.handleFileRename(event));
    }

    private handleFileChange(uri: vscode.Uri, changeType: 'create' | 'delete' | 'change'): void {
        const relativePath = path.relative(this.workspaceRoot, uri.fsPath);
        
        if (this.gitignoreParser.isIgnored(relativePath)) {
            return;  // Ignore changes to files that should be ignored
        }

        console.log(`File ${changeType} detected: ${uri.fsPath}`);

        if (changeType === 'delete') {
            this.annotationEditorProvider.removeAnnotation(uri.fsPath);
        }

        this.refresh();
    }

    private handleFileRename(event: vscode.FileRenameEvent): void {
        for (const { oldUri, newUri } of event.files) {
            const oldPath = path.relative(this.workspaceRoot, oldUri.fsPath);
            const newPath = path.relative(this.workspaceRoot, newUri.fsPath);

            if (!this.gitignoreParser.isIgnored(oldPath) && !this.gitignoreParser.isIgnored(newPath)) {
                console.log(`File renamed from ${oldUri.fsPath} to ${newUri.fsPath}`);
                this.annotationEditorProvider.moveAnnotation(oldUri.fsPath, newUri.fsPath);
            }
        }

        this.refresh();
    }

    refresh(): void {
        console.log('Refreshing entire tree');
        this._onDidChangeTreeData.fire();
    }

    async getChildren(element?: string): Promise<string[]> {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage('No workspace folder open');
            return [];
        }

        const dirPath = element || this.workspaceRoot;
        try {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));
            const children = await Promise.all(entries.map(async ([name, type]) => {
                const fullPath = path.join(dirPath, name);
                const relativePath = path.relative(this.workspaceRoot, fullPath);
                if (!this.gitignoreParser.isIgnored(relativePath)) {
                    return { path: fullPath, type };
                }
                return null;
            }));

            const validChildren = children.filter((child): child is { path: string, type: vscode.FileType } => child !== null);
            
            const sortedChildren = await this.sortFilesAsync(validChildren);
            
            return sortedChildren.map(child => child.path);
        } catch (error) {
            console.error(`Error reading directory ${dirPath}:`, error);
            return [];
        }
    }

    private async sortFilesAsync(files: { path: string, type: vscode.FileType }[]): Promise<{ path: string, type: vscode.FileType }[]> {
        const sortedFiles = [...files];
        for (let i = 0; i < sortedFiles.length; i++) {
            for (let j = i + 1; j < sortedFiles.length; j++) {
                if (await this.compareFiles(sortedFiles[i], sortedFiles[j]) > 0) {
                    [sortedFiles[i], sortedFiles[j]] = [sortedFiles[j], sortedFiles[i]];
                }
            }
        }
        return sortedFiles;
    }

    private async compareFiles(a: { path: string, type: vscode.FileType }, b: { path: string, type: vscode.FileType }): Promise<number> {
        const aIsDir = a.type === vscode.FileType.Directory;
        const bIsDir = b.type === vscode.FileType.Directory;
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return path.basename(a.path).localeCompare(path.basename(b.path));
    }

    async getTreeItem(element: string): Promise<vscode.TreeItem> {
        if (this.treeItemCache.has(element)) {
            return this.treeItemCache.get(element)!;
        }

        try {
            const stat = await fs.stat(element);
            const isDirectory = stat.isDirectory();
            
            const relativePath = path.relative(this.workspaceRoot, element);
            if (this.gitignoreParser.isIgnored(relativePath)) {
                return new vscode.TreeItem(''); // This should never happen due to filtering in getChildren
            }

            const annotation = this.annotationEditorProvider.getAnnotation(element);

            const shortAnnotation = annotation.length > 15 ? annotation.substring(0, 15) + '...' : annotation;

            const treeItem = new vscode.TreeItem(
                path.basename(element),
                isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
            );

            treeItem.resourceUri = vscode.Uri.file(element);
            treeItem.description = shortAnnotation ? `(${shortAnnotation})` : '';
            treeItem.contextValue = isDirectory ? 'folder' : 'file';
            treeItem.tooltip = annotation || (isDirectory ? "Click to edit folder annotation" : "Click to open file and edit annotation");

            treeItem.command = {
                command: isDirectory ? 'folderTree.editFolderAnnotation' : 'folderTree.openFileAndEditAnnotation',
                title: isDirectory ? 'Edit Folder Annotation' : 'Open File and Edit Annotation',
                arguments: [element]
            };

            this.treeItemCache.set(element, treeItem);
            return treeItem;
        } catch (error) {
            console.error(`Error creating tree item for ${element}:`, error);
            return new vscode.TreeItem(path.basename(element));
        }
    }

    getParent?(element: string): vscode.ProviderResult<string> {
        const parentPath = path.dirname(element);
        return parentPath !== this.workspaceRoot ? parentPath : null;
    }

    dispose() {
        this.fileSystemWatcher.dispose();
    }
}