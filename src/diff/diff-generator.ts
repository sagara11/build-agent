import { createTwoFilesPatch } from 'diff';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface FileDiff {
  filePath: string;
  isNew: boolean;
  patch: string;
}

export function generateDiff(originalPath: string, sandboxPath: string): FileDiff[] {
  const diffs: FileDiff[] = [];
  const originalFiles = collectFiles(originalPath);
  const sandboxFiles = collectFiles(sandboxPath);

  for (const relPath of sandboxFiles) {
    const sandboxContent = fs.readFileSync(path.join(sandboxPath, relPath), 'utf-8');

    if (!originalFiles.has(relPath)) {
      const patch = createTwoFilesPatch(
        `/dev/null`,
        `b/${relPath}`,
        '',
        sandboxContent,
      );
      diffs.push({ filePath: relPath, isNew: true, patch });
      continue;
    }

    const originalContent = fs.readFileSync(path.join(originalPath, relPath), 'utf-8');
    if (originalContent !== sandboxContent) {
      const patch = createTwoFilesPatch(
        `a/${relPath}`,
        `b/${relPath}`,
        originalContent,
        sandboxContent,
      );
      diffs.push({ filePath: relPath, isNew: false, patch });
    }
  }

  return diffs;
}

export function formatUnifiedDiff(diffs: FileDiff[]): string {
  return diffs.map(d => d.patch).join('\n');
}

function collectFiles(dir: string, base = ''): Set<string> {
  const result = new Set<string>();
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const relPath = base ? `${base}/${entry.name}` : entry.name;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      for (const child of collectFiles(fullPath, relPath)) {
        result.add(child);
      }
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      result.add(relPath);
    }
  }

  return result;
}
