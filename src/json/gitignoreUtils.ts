import * as fs from 'fs/promises';
import * as path from 'path';
import ignore from 'ignore';

// Custom type for Node.js errors
interface NodeJSError extends Error {
    code?: string;
}

export class GitignoreParser {
    private ignorer: ReturnType<typeof ignore>;
    private ignoredCache: Set<string> = new Set();

    constructor(private workspaceRoot: string) {
        this.ignorer = ignore();
        this.loadGitignore();
    }

    private async loadGitignore() {
        const gitignorePath = path.join(this.workspaceRoot, '.gitignore');
        try {
            const gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
            this.ignorer.add(gitignoreContent);
        } catch (error) {
            if (error instanceof Error) {
                const nodeError = error as NodeJSError;
                if (nodeError.code !== 'ENOENT') {
                    console.error('Error loading .gitignore:', nodeError.message);
                }
            } else {
                console.error('Unknown error loading .gitignore:', error);
            }
        }
    }

    isIgnored(filePath: string): boolean {
        if (this.ignoredCache.has(filePath)) {
            return true;
        }
        const isIgnored = this.ignorer.ignores(filePath);
        if (isIgnored) {
            this.ignoredCache.add(filePath);
        }
        return isIgnored;
    }
}