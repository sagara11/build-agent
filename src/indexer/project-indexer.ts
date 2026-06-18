import { Project, SourceFile } from 'ts-morph';
import { parse } from '@typescript-eslint/typescript-estree';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface IndexedFile {
  filePath: string;
  sourceFile?: SourceFile;
  ast?: ReturnType<typeof parse>;
  parser: 'ts-morph' | 'typescript-estree';
}

export interface IndexResult {
  files: IndexedFile[];
  errors: Array<{ filePath: string; error: string }>;
}

const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

function scanDirectory(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      results.push(...scanDirectory(fullPath));
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }

  return results;
}

function detectTsConfig(targetPath: string): string | null {
  const candidate = path.join(targetPath, 'tsconfig.json');
  return fs.existsSync(candidate) ? candidate : null;
}

function indexWithTsMorph(targetPath: string, tsConfigPath: string, filePaths: string[]): IndexResult {
  const project = new Project({ tsConfigFilePath: tsConfigPath });

  for (const fp of filePaths) {
    if (!project.getSourceFile(fp)) {
      project.addSourceFileAtPath(fp);
    }
  }

  const files: IndexedFile[] = [];
  const errors: IndexResult['errors'] = [];

  for (const fp of filePaths) {
    try {
      const sourceFile = project.getSourceFileOrThrow(fp);
      files.push({
        filePath: path.relative(targetPath, fp),
        sourceFile,
        parser: 'ts-morph',
      });
    } catch (e) {
      errors.push({
        filePath: path.relative(targetPath, fp),
        error: e instanceof Error ? e.message : String(e),
      });
      console.warn(`[WARN] Skipping ${fp}: ${e instanceof Error ? e.message : e}`);
    }
  }

  return { files, errors };
}

function indexWithEstree(targetPath: string, filePaths: string[]): IndexResult {
  const files: IndexedFile[] = [];
  const errors: IndexResult['errors'] = [];

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
    } catch (e) {
      errors.push({
        filePath: path.relative(targetPath, fp),
        error: e instanceof Error ? e.message : String(e),
      });
      console.warn(`[WARN] Skipping ${fp}: ${e instanceof Error ? e.message : e}`);
    }
  }

  return { files, errors };
}

export async function indexProject(targetPath: string): Promise<IndexResult> {
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
