import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

export class AnnotationListProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'annotationList';
    private _view?: vscode.WebviewView;
    private annotationFilePath: string;

    constructor(private readonly _extensionUri: vscode.Uri, private workspaceRoot: string) {
        this.annotationFilePath = path.join(workspaceRoot, '.codebasenotes-annotations.json');
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
            <h2>All Annotations</h2>
            <ul id="annotationList"></ul>
            <script>
                var annotations = ${annotations};
            </script>
            <script src="${scriptUri}"></script>
        </body>
        </html>`;
    }

    private setupWebviewMessageListener(webviewView: vscode.WebviewView) {
        webviewView.webview.onDidReceiveMessage(data => {
            if (data.type === 'revealItem') {
                vscode.commands.executeCommand('codebaseNotes.revealItem', data.path);
            }
        });
    }
}
