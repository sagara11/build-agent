import { Project } from 'ts-morph';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface CompileError {
  file: string;
  line: number;
  message: string;
}

export interface CheckResult {
  compilable: boolean;
  errors: CompileError[];
}

export function checkTypeScript(sandboxPath: string): CheckResult {
  const tsconfigPath = path.join(sandboxPath, 'tsconfig.json');

  let project: Project;
  if (fs.existsSync(tsconfigPath)) {
    project = new Project({ tsConfigFilePath: tsconfigPath });
  } else {
    project = new Project({
      compilerOptions: { strict: true, noEmit: true, target: 2, module: 199 },
    });
    const files = findSourceFiles(sandboxPath);
    for (const f of files) {
      project.addSourceFileAtPath(f);
    }
  }

  const diagnostics = project.getPreEmitDiagnostics();
  const errors: CompileError[] = diagnostics
    .filter(d => d.getSourceFile() !== undefined)
    .map(d => ({
      file: path.relative(sandboxPath, d.getSourceFile()!.getFilePath()),
      line: d.getLineNumber() ?? 0,
      message: d.getMessageText().toString(),
    }));

  return { compilable: errors.length === 0, errors };
}

function findSourceFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      results.push(full);
    }
  }
  return results;
}
