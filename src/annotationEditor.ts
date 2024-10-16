import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { GitignoreParser } from './gitignoreUtils';

interface AnnotationNode {
    type: string;
    annotation?: string;
    subNodes: Map<string, AnnotationNode>;
}

export class AnnotationEditorProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'annotationEditor';
    private _view?: vscode.WebviewView;
    private currentEditingItem: string | undefined;
    private annotations: AnnotationNode = { type: 'dir', subNodes: new Map() };
    private annotationFilePath: string;
    private gitignoreParser: GitignoreParser;
    private fileSystemWatcher: vscode.FileSystemWatcher;
    private annotationsExist: boolean = true;
    private openedAnnotations: Set<string> = new Set();
    private lastOpenedTimestamp: number = 0;

    private _onDidChangeAnnotation = new vscode.EventEmitter<string>();
    public readonly onDidChangeAnnotation = this._onDidChangeAnnotation.event;

    constructor(private readonly _extensionUri: vscode.Uri, private workspaceRoot: string) {
        this.annotationFilePath = path.join(workspaceRoot, '.codebasenotes-annotations.json');
        this.gitignoreParser = new GitignoreParser(workspaceRoot);
        this.fileSystemWatcher = this.createFileSystemWatcher();
        this.loadAnnotations();
    }

    private createFileSystemWatcher(): vscode.FileSystemWatcher {
        const watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(this.workspaceRoot, '.codebasenotes-annotations.json')
        );
        watcher.onDidDelete(() => this.handleAnnotationFileDeleted());
        watcher.onDidCreate(() => this.loadAnnotations());
        return watcher;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        this.setupWebviewMessageListener(webviewView);
    }

    private setupWebviewMessageListener(webviewView: vscode.WebviewView) {
        webviewView.webview.onDidReceiveMessage(data => {
            if (data.type === 'annotationUpdated') {
                this.updateAnnotation(data.value);
            }
        });
    }

    public async editAnnotation(element: string) {
        const relativePath = path.relative(this.workspaceRoot, element);
        if (this.gitignoreParser.isIgnored(relativePath)) {
            vscode.window.showInformationMessage('This file/folder is ignored by .gitignore and cannot be edited.');
            return;
        }

        const currentTime = Date.now();
        if (currentTime - this.lastOpenedTimestamp > 5000) {
            this.openedAnnotations.clear();
        }

        if (this._view) {
            this.currentEditingItem = element;
            this._view.show?.(true);
            this._view.webview.postMessage({ 
                type: 'setAnnotation', 
                itemName: path.basename(element),
                annotation: this.getAnnotation(element)
            });

            if (!this.openedAnnotations.has(element)) {
                await this.openReferencedFiles(element);
                await vscode.workspace.openTextDocument(element).then(doc => 
                    vscode.window.showTextDocument(doc, { preview: false })
                );
                this.openedAnnotations.add(element);
                this.lastOpenedTimestamp = currentTime;
            }
        } else {
            vscode.window.showErrorMessage('Unable to open annotation editor. Please try again.');
        }
    }

    private async openReferencedFiles(element: string) {
        const annotation = this.getAnnotation(element);
        const regex = /\s*\[\s*([^\]]+)\s*\]\s*/g;
        let match;
        const filesToOpen = [];

        while ((match = regex.exec(annotation)) !== null) {
            const relativePath = match[1].trim().replace(/\\/g, '/');
            const fullPath = path.join(this.workspaceRoot, relativePath);

            if (fullPath === element) continue;

            try {
                const stat = await fs.stat(fullPath);
                if (stat.isFile()) {
                    filesToOpen.push(fullPath);
                }
            } catch (error) {
                console.error(`Error processing file: ${relativePath}`, error);
            }
        }

        // Open referenced files
        for (const file of filesToOpen) {
            const document = await vscode.workspace.openTextDocument(file);
            await vscode.window.showTextDocument(document, { preview: false, preserveFocus: true });
        }

        // Open the original document last
        const originalDocument = await vscode.workspace.openTextDocument(element);
        await vscode.window.showTextDocument(originalDocument, { preview: false });
    }

    private async updateAnnotation(annotation: string) {
        if (this.currentEditingItem) {
            const relativePath = path.relative(this.workspaceRoot, this.currentEditingItem);
            if (!this.gitignoreParser.isIgnored(relativePath)) {
                await this.setAnnotation(relativePath, annotation);
                await this.saveAnnotations();
                this._onDidChangeAnnotation.fire(this.currentEditingItem);
            }
        }
    }

    public getAnnotation(element: string): string {
        if (!this.annotationsExist) return '';
        const relativePath = path.relative(this.workspaceRoot, element);
        if (this.gitignoreParser.isIgnored(relativePath)) return '';
        return this.getAnnotationFromNode(this.annotations, relativePath.split(path.sep));
    }

    private getAnnotationFromNode(node: AnnotationNode, parts: string[]): string {
        if (parts.length === 0) return node.annotation || '';
        const nextNode = node.subNodes.get(parts[0]);
        return nextNode ? this.getAnnotationFromNode(nextNode, parts.slice(1)) : '';
    }

    private async setAnnotation(relativePath: string, annotation: string) {
        this.annotationsExist = true;
        if (this.gitignoreParser.isIgnored(relativePath)) return;
        const parts = relativePath.split(path.sep);
        let node = this.annotations;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!node.subNodes.has(part)) {
                const fullPath = path.join(this.workspaceRoot, ...parts.slice(0, i + 1));
                const type = await this.getNodeType(fullPath, i === parts.length - 1);
                node.subNodes.set(part, { type, subNodes: new Map() });
            }
            node = node.subNodes.get(part)!;
        }
        node.annotation = annotation;
    }

    public removeAnnotation(path: string): void {
        const relativePath = vscode.workspace.asRelativePath(path);
        const parts = relativePath.split('/');
        let node = this.annotations;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!node.subNodes.has(parts[i])) return;
            node = node.subNodes.get(parts[i])!;
        }
        node.subNodes.delete(parts[parts.length - 1]);
        this.saveAnnotations();
    }

    public moveAnnotation(oldPath: string, newPath: string): void {
        const annotation = this.getAnnotation(oldPath);
        if (annotation) {
            this.removeAnnotation(oldPath);
            this.setAnnotation(newPath, annotation);
        }
    }

    private async getNodeType(fullPath: string, isFile: boolean): Promise<string> {
        try {
            const stats = await fs.stat(fullPath);
            if (!isFile || stats.isDirectory()) return 'dir';
            const ext = path.extname(fullPath).slice(1).toLowerCase();
            return ext || 'file';
        } catch (error) {
            console.error(`Error getting node type for ${fullPath}:`, error);
            return 'file';
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'annotationEditor.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'annotationEditor.css'));

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${styleUri}" rel="stylesheet">
            <title>Annotation Editor</title>
        </head>
        <body>
            <h2 id="itemName"></h2>
            <textarea id="annotation" rows="10"></textarea>
            <script src="${scriptUri}"></script>
        </body>
        </html>`;
    }

    private async loadAnnotations() {
        try {
            const data = await fs.readFile(this.annotationFilePath, 'utf8');
            this.annotations = this.deserializeAnnotations(JSON.parse(data));
            this.cleanupIgnoredAnnotations(this.annotations);
            this.annotationsExist = true;
        } catch (error) {
            if (error instanceof Error && 'code' in error && (error as any).code === 'ENOENT') {
                console.log('Annotation file does not exist');
                this.annotationsExist = false;
            } else {
                console.error('Error loading annotations:', error);
            }
        }
    }

    private async saveAnnotations() {
        if (!this.annotationsExist) return;
        try {
            this.cleanupIgnoredAnnotations(this.annotations);
            const data = JSON.stringify(this.serializeAnnotations(this.annotations), null, 2);
            await fs.writeFile(this.annotationFilePath, data);
        } catch (error) {
            console.error('Error saving annotations:', error);
            vscode.window.showErrorMessage(`Failed to save annotations: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private cleanupIgnoredAnnotations(node: AnnotationNode, currentPath: string = '') {
        for (const [key, childNode] of node.subNodes.entries()) {
            const childPath = path.join(currentPath, key);
            if (this.gitignoreParser.isIgnored(childPath)) {
                node.subNodes.delete(key);
            } else {
                this.cleanupIgnoredAnnotations(childNode, childPath);
                if (childNode.subNodes.size === 0 && childNode.annotation === undefined) {
                    node.subNodes.delete(key);
                }
            }
        }
    }

    private serializeAnnotations(node: AnnotationNode): any {
        const result: any = { type: node.type };
        if (node.annotation !== undefined) result.annotation = node.annotation;
        if (node.subNodes.size > 0) {
            result.subNodes = Object.fromEntries(
                Array.from(node.subNodes.entries()).map(([key, value]) => [key, this.serializeAnnotations(value)])
            );
        }
        return result;
    }

    private deserializeAnnotations(data: any): AnnotationNode {
        const node: AnnotationNode = { type: data.type, subNodes: new Map() };
        if (data.annotation !== undefined) node.annotation = data.annotation;
        if (data.subNodes) {
            for (const [key, value] of Object.entries(data.subNodes)) {
                node.subNodes.set(key, this.deserializeAnnotations(value as any));
            }
        }
        return node;
    }

    private handleAnnotationFileDeleted() {
        console.log('Annotation file deleted by user');
        this.annotationsExist = false;
        this.annotations = { type: 'dir', subNodes: new Map() };
        this._onDidChangeAnnotation.fire('');
    }

    dispose() {
        this.fileSystemWatcher.dispose();
    }
}
