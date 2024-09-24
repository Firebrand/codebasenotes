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
    private annotations: AnnotationNode = { type: 'dir', subNodes: new Map() };
    public static readonly viewType = 'annotationEditor';

    private _view?: vscode.WebviewView;
    private currentEditingItem: string | undefined;
    private annotationFilePath: string;
    private gitignoreParser: GitignoreParser;

    private _onDidChangeAnnotation = new vscode.EventEmitter<string>();
    public readonly onDidChangeAnnotation = this._onDidChangeAnnotation.event;

    constructor(private readonly _extensionUri: vscode.Uri, private workspaceRoot: string) {
        this.annotationFilePath = path.join(workspaceRoot, '.codebasenotes-annotations.json');
        this.gitignoreParser = new GitignoreParser(workspaceRoot);
        this.loadAnnotations();
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

        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'annotationUpdated':
                    this.updateAnnotation(data.value);
                    break;
            }
        });
    }

    public editAnnotation(element: string) {
        const relativePath = path.relative(this.workspaceRoot, element);
        if (this.gitignoreParser.isIgnored(relativePath)) {
            vscode.window.showInformationMessage('This file/folder is ignored by .gitignore and cannot be edited.');
            return;
        }

        console.log('Editing annotation for:', element);
        if (this._view) {
            this.currentEditingItem = element;
            this._view.show?.(true);
            this._view.webview.postMessage({ 
                type: 'setAnnotation', 
                itemName: path.basename(element),
                annotation: this.getAnnotation(element)
            });
        } else {
            console.error('WebviewView is not available');
            vscode.window.showErrorMessage('Unable to open annotation editor. Please try again.');
        }
    }

    private async updateAnnotation(annotation: string) {
        if (this.currentEditingItem) {
            const relativePath = path.relative(this.workspaceRoot, this.currentEditingItem);
            if (!this.gitignoreParser.isIgnored(relativePath)) {
                await this.setAnnotation(relativePath, annotation);
                await this.saveAnnotations();
                // Emit the event with the path of the updated item
                this._onDidChangeAnnotation.fire(this.currentEditingItem);
            }
        }
    }

    public getAnnotation(element: string): string {
        const relativePath = path.relative(this.workspaceRoot, element);
        if (this.gitignoreParser.isIgnored(relativePath)) {
            return '';
        }
        const parts = relativePath.split(path.sep);
        let node: AnnotationNode = this.annotations;
        for (const part of parts) {
            if (!node.subNodes.has(part)) {
                return '';
            }
            node = node.subNodes.get(part)!;
        }
        return node.annotation || '';
    }

    private async setAnnotation(relativePath: string, annotation: string) {
        if (this.gitignoreParser.isIgnored(relativePath)) {
            return;
        }
        const parts = relativePath.split(path.sep);
        let node: AnnotationNode = this.annotations;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!node.subNodes.has(part)) {
                const isLastPart = i === parts.length - 1;
                const fullPath = path.join(this.workspaceRoot, ...parts.slice(0, i + 1));
                const type = await this.getNodeType(fullPath, isLastPart);
                node.subNodes.set(part, { type, subNodes: new Map() });
            }
            if (i === parts.length - 1) {
                const lastNode = node.subNodes.get(part)!;
                lastNode.annotation = annotation;
            } else {
                node = node.subNodes.get(part)!;
            }
        }
    }

    public removeAnnotation(path: string): void {
        const relativePath = vscode.workspace.asRelativePath(path);
        const parts = relativePath.split('/');
        let node = this.annotations;
        
        for (let i = 0; i < parts.length - 1; i++) {
            if (!node.subNodes.has(parts[i])) {
                return; // Path doesn't exist in our annotations
            }
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
            if (!isFile || stats.isDirectory()) {
                return 'dir';
            }
            const ext = path.extname(fullPath).slice(1).toLowerCase();
            return ext || 'file';  // Use 'file' if there's no extension
        } catch (error) {
            console.error(`Error getting node type for ${fullPath}:`, error);
            return 'file'; // Default to 'file' if we can't determine the type
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
        } catch (error) {
            if (error instanceof Error && 'code' in error) {
                if (error.code !== 'ENOENT') {
                    console.error('Error loading annotations:', error.message);
                }
            } else {
                console.error('Unknown error loading annotations:', error);
            }
        }
    }

    private async saveAnnotations() {
        try {
            this.cleanupIgnoredAnnotations(this.annotations);
            const data = JSON.stringify(this.serializeAnnotations(this.annotations), null, 2);
            await fs.writeFile(this.annotationFilePath, data);
        } catch (error) {
            if (error instanceof Error) {
                console.error('Error saving annotations:', error.message);
                vscode.window.showErrorMessage(`Failed to save annotations: ${error.message}`);
            } else {
                console.error('Unknown error saving annotations:', error);
                vscode.window.showErrorMessage('Failed to save annotations due to an unknown error');
            }
        }
    }

    private cleanupIgnoredAnnotations(node: AnnotationNode, currentPath: string = '') {
        for (const [key, childNode] of node.subNodes.entries()) {
            const childPath = path.join(currentPath, key);
            if (this.gitignoreParser.isIgnored(childPath)) {
                node.subNodes.delete(key);
            } else {
                this.cleanupIgnoredAnnotations(childNode, childPath);
                // Remove empty nodes
                if (childNode.subNodes.size === 0 && childNode.annotation === undefined) {
                    node.subNodes.delete(key);
                }
            }
        }
    }

    private serializeAnnotations(node: AnnotationNode): any {
        const result: any = {
            type: node.type
        };
        if (node.annotation !== undefined) {
            result.annotation = node.annotation;
        }
        if (node.subNodes.size > 0) {
            result.subNodes = {};
            for (const [key, value] of node.subNodes) {
                result.subNodes[key] = this.serializeAnnotations(value);
            }
        }
        return result;
    }

    private deserializeAnnotations(data: any): AnnotationNode {
        const node: AnnotationNode = { type: data.type, subNodes: new Map() };
        if (data.annotation !== undefined) {
            node.annotation = data.annotation;
        }
        if (data.subNodes) {
            for (const [key, value] of Object.entries(data.subNodes)) {
                node.subNodes.set(key, this.deserializeAnnotations(value as any));
            }
        }
        return node;
    }
}