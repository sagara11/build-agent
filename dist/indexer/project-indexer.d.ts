import { SourceFile } from 'ts-morph';
import { parse } from '@typescript-eslint/typescript-estree';
export interface IndexedFile {
    filePath: string;
    sourceFile?: SourceFile;
    ast?: ReturnType<typeof parse>;
    parser: 'ts-morph' | 'typescript-estree';
}
export interface IndexResult {
    files: IndexedFile[];
    errors: Array<{
        filePath: string;
        error: string;
    }>;
}
export declare function indexProject(targetPath: string): Promise<IndexResult>;
//# sourceMappingURL=project-indexer.d.ts.map