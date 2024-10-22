import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

export class AnnotationListProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'annotationList';
    private _view?: vscode.WebviewView;
    private fileSystemWatcher: vscode.FileSystemWatcher;
    private annotationFilePath: string;
    private workspaceRoot: string;
    private debounceTimer: NodeJS.Timeout | null = null;
    private lastRefreshTime: number = 0;

    constructor(private readonly _extensionUri: vscode.Uri, private workspaceRootParam: string) {
        this.workspaceRoot = workspaceRootParam;
        this.annotationFilePath = path.join(this.workspaceRoot, '.codebasenotes-annotations.json');
        this.fileSystemWatcher = this.createFileSystemWatcher();
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
        this.loadAnnotations().then(annotations => {
            webviewView.webview.html = this._getHtmlForWebview(webviewView.webview, annotations);
        });
        this.setupWebviewMessageListener(webviewView);
    }

    private async loadAnnotations(): Promise<string> {
        try {
            const data = await fs.readFile(this.annotationFilePath, 'utf8');
            const parsedData = JSON.parse(data);
            return JSON.stringify(this.flattenAnnotations(parsedData));
        } catch (error) {
            console.error('Error loading annotations:', error);
            return '[]';
        }
    }

    private flattenAnnotations(node: any, path: string = ''): any[] {
        let result: any[] = [];
        if (node.annotation) {
            result.push({ path, annotation: node.annotation });
        }
        if (node.subNodes) {
            for (const [key, value] of Object.entries(node.subNodes)) {
                result = result.concat(this.flattenAnnotations(value, path ? `${path}/${key}` : key));
            }
        }
        return result;
    }

    private _getHtmlForWebview(webview: vscode.Webview, annotations: string): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'annotationList.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'annotationList.css'));

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${styleUri}" rel="stylesheet">
            <title>Annotation List</title>
        </head>
        <body>
            <ul id="annotationList"></ul>
            <script>
                var annotations = ${annotations};
            </script>
            <script src="${scriptUri}"></script>
        </body>
        </html>`;
    }

    private setupWebviewMessageListener(webviewView: vscode.WebviewView) {
        webviewView.webview.onDidReceiveMessage(async data => {
            if (data.type === 'revealItem') {
                const fullPath = path.join(this.workspaceRoot, data.path);
                try {
                    const stats = await fs.stat(fullPath);
                    const isDirectory = stats.isDirectory();
                    vscode.commands.executeCommand('codebaseNotes.clearAndOpenItem', fullPath, isDirectory);
                } catch (error) {
                    console.error('Error checking if path is directory:', error);
                    // Fallback to assuming it's not a directory if there's an error
                    vscode.commands.executeCommand('codebaseNotes.clearAndOpenItem', fullPath, false);
                }
            }
        });
    }

    private createFileSystemWatcher(): vscode.FileSystemWatcher {
        const watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(this.workspaceRoot, '.codebasenotes-annotations.json')
        );
        watcher.onDidChange(() => this.refresh());
        watcher.onDidCreate(() => this.refresh());
        watcher.onDidDelete(() => this.refresh());
        return watcher;
    }

    private refresh(): void {
        const currentTime = Date.now();
        if (currentTime - this.lastRefreshTime < 5000) {
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
            }
            this.debounceTimer = setTimeout(() => {
                this.performRefresh();
            }, 5000);
        } else {
            this.performRefresh();
        }
    }

    private performRefresh(): void {
        if (this._view) {
            this.loadAnnotations().then(annotations => {
                if (this._view) {
                    this._view.webview.html = this._getHtmlForWebview(this._view.webview, annotations);
                }
            });
        }
        this.lastRefreshTime = Date.now();
    }

    public dispose() {
        this.fileSystemWatcher.dispose();
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
    }
}
