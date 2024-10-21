import * as vscode from 'vscode';
import * as path from 'path';
import { AnnotationEditorProvider } from './annotationEditor';
import { GitignoreParser } from './gitignoreUtils';

export class ProjectTreeProvider implements vscode.TreeDataProvider<string> {
    private _onDidChangeTreeData = new vscode.EventEmitter<string | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private gitignoreParser: GitignoreParser;
    private fileSystemWatcher: vscode.FileSystemWatcher;
    private treeItemCache = new Map<string, vscode.TreeItem>();

    constructor(
        private workspaceRoot: string,
        private annotationEditorProvider: AnnotationEditorProvider
    ) {
        this.gitignoreParser = new GitignoreParser(workspaceRoot);
        this.fileSystemWatcher = this.createFileSystemWatcher();
        this.setupEventListeners();
    }

    private createFileSystemWatcher(): vscode.FileSystemWatcher {
        const watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(this.workspaceRoot, '**/*')
        );
        watcher.onDidCreate((uri) => this.handleFileChange(uri, 'create'));
        watcher.onDidDelete((uri) => this.handleFileChange(uri, 'delete'));
        watcher.onDidChange((uri) => this.handleFileChange(uri, 'change'));
        return watcher;
    }

    private setupEventListeners() {
        this.annotationEditorProvider.onDidChangeAnnotation(() => this.refresh());
        vscode.workspace.onDidRenameFiles((event) => this.handleFileRename(event));
    }

    private handleFileChange(uri: vscode.Uri, changeType: 'create' | 'delete' | 'change'): void {
        const relativePath = path.relative(this.workspaceRoot, uri.fsPath);
        
        if (this.gitignoreParser.isIgnored(relativePath)) return;

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
                this.annotationEditorProvider.moveAnnotation(oldUri.fsPath, newUri.fsPath);
            }
        }

        this.refresh();
    }

    refresh(): void {
        this.treeItemCache.clear();
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
            const validChildren = entries
                .filter(([name]) => {
                    const fullPath = path.join(dirPath, name);
                    const relativePath = path.relative(this.workspaceRoot, fullPath);
                    return !this.gitignoreParser.isIgnored(relativePath);
                })
                .map(([name, type]) => ({
                    path: path.join(dirPath, name),
                    type
                }));
            
            const sortedChildren = this.sortFiles(validChildren);
            return sortedChildren.map(child => child.path);
        } catch (error) {
            console.error(`Error reading directory ${dirPath}:`, error);
            return [];
        }
    }

    private sortFiles(files: { path: string, type: vscode.FileType }[]): { path: string, type: vscode.FileType }[] {
        return files.sort((a, b) => {
            const aIsDir = a.type === vscode.FileType.Directory;
            const bIsDir = b.type === vscode.FileType.Directory;
            if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
            return path.basename(a.path).localeCompare(path.basename(b.path));
        });
    }

    async getTreeItem(element: string): Promise<vscode.TreeItem> {
        if (this.treeItemCache.has(element)) {
            return this.treeItemCache.get(element)!;
        }

        try {
            const stat = await vscode.workspace.fs.stat(vscode.Uri.file(element));
            const isDirectory = stat.type === vscode.FileType.Directory;
            
            const relativePath = path.relative(this.workspaceRoot, element);
            if (this.gitignoreParser.isIgnored(relativePath)) {
                return new vscode.TreeItem('');
            }

            const annotation = this.annotationEditorProvider.getAnnotation(element);
            const truncatedAnnotation = this.truncateAnnotation(annotation);

            const treeItem = new vscode.TreeItem(
                path.basename(element),
                isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
            );

            treeItem.resourceUri = vscode.Uri.file(element);
            treeItem.description = truncatedAnnotation ? `(${truncatedAnnotation})` : '';
            treeItem.contextValue = isDirectory ? 'folder' : 'file';
            treeItem.tooltip = annotation || (isDirectory ? "Click to edit folder annotation" : "Click to open file and edit annotation");

            treeItem.command = {
                command: 'codebaseNotes.clearAndOpenItem',
                title: 'Open Item',
                arguments: [element, isDirectory]
            };

            this.treeItemCache.set(element, treeItem);
            return treeItem;
        } catch (error) {
            console.error(`Error creating tree item for ${element}:`, error);
            return new vscode.TreeItem(path.basename(element));
        }
    }

    private truncateAnnotation(annotation: string): string {
        const newLineIndex = annotation.indexOf('\n');
        if (newLineIndex !== -1 && newLineIndex < 60) {
            return annotation.substring(0, newLineIndex) + '...';
        } else if (annotation.length > 60) {
            return annotation.substring(0, 60) + '...';
        }
        return annotation;
    }

    getParent?(element: string): vscode.ProviderResult<string> {
        const parentPath = path.dirname(element);
        return parentPath !== this.workspaceRoot ? parentPath : null;
    }

    dispose() {
        this.fileSystemWatcher.dispose();
    }

    async reveal(itemPath: string): Promise<void> {
        const element = itemPath;
        const item = await this.getTreeItem(element);
        if (item) {
            vscode.commands.executeCommand('projectTree.focus');
            vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(element));
        }
    }
}