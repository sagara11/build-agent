import { Project } from 'ts-morph';
import { parse } from '@typescript-eslint/typescript-estree';
import * as fs from 'node:fs';
import * as path from 'node:path';
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
function scanDirectory(dir) {
    const results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === '.git')
                continue;
            results.push(...scanDirectory(fullPath));
        }
        else if (EXTENSIONS.has(path.extname(entry.name))) {
            results.push(fullPath);
        }
    }
    return results;
}
function detectTsConfig(targetPath) {
    const candidate = path.join(targetPath, 'tsconfig.json');
    return fs.existsSync(candidate) ? candidate : null;
}
function indexWithTsMorph(targetPath, tsConfigPath, filePaths) {
    const project = new Project({ tsConfigFilePath: tsConfigPath });
    for (const fp of filePaths) {
        if (!project.getSourceFile(fp)) {
            project.addSourceFileAtPath(fp);
        }
    }
    const files = [];
    const errors = [];
    for (const fp of filePaths) {
        try {
            const sourceFile = project.getSourceFileOrThrow(fp);
            files.push({
                filePath: path.relative(targetPath, fp),
                sourceFile,
                parser: 'ts-morph',
            });
        }
        catch (e) {
            errors.push({
                filePath: path.relative(targetPath, fp),
                error: e instanceof Error ? e.message : String(e),
            });
            console.warn(`[WARN] Skipping ${fp}: ${e instanceof Error ? e.message : e}`);
        }
    }
    return { files, errors };
}
function indexWithEstree(targetPath, filePaths) {
    const files = [];
    const errors = [];
    for (const fp of filePaths) {
        try {
            const code = fs.readFileSync(fp, 'utf-8');
            const isTsx = fp.endsWith('.tsx') || fp.endsWith('.jsx');
            const ast = parse(code, {
                loc: true,
                range: true,
                jsx: isTsx,
            });
            files.push({
                filePath: path.relative(targetPath, fp),
                ast,
                parser: 'typescript-estree',
            });
        }
        catch (e) {
            errors.push({
                filePath: path.relative(targetPath, fp),
                error: e instanceof Error ? e.message : String(e),
            });
            console.warn(`[WARN] Skipping ${fp}: ${e instanceof Error ? e.message : e}`);
        }
    }
    return { files, errors };
}
export async function indexProject(targetPath) {
    const resolvedPath = path.resolve(targetPath);
    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Path does not exist: ${resolvedPath}`);
    }
    const filePaths = scanDirectory(resolvedPath);
    const tsConfigPath = detectTsConfig(resolvedPath);
    if (tsConfigPath) {
        return indexWithTsMorph(resolvedPath, tsConfigPath, filePaths);
    }
    return indexWithEstree(resolvedPath, filePaths);
}
//# sourceMappingURL=project-indexer.js.map