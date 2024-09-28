import * as fs from 'fs/promises';
import * as path from 'path';
import ignore from 'ignore';

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
            if (error instanceof Error && 'code' in error && (error as any).code !== 'ENOENT') {
                console.error('Error loading .gitignore:', error.message);
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