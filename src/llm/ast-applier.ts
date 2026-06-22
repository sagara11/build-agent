import { Project, SourceFile } from 'ts-morph';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { AstAction, AstActionList, ExtractClassAction, ReplaceNodeAction, RenameSymbolAction } from './types.js';

export interface ApplyResult {
  sandboxPath: string;
  appliedActions: number;
  errors: string[];
}

export class AstApplier {
  private sandboxPath: string | null = null;

  async apply(projectPath: string, actionList: AstActionList): Promise<ApplyResult> {
    this.sandboxPath = fs.mkdtempSync(path.join(os.tmpdir(), 'refactor-sandbox-'));
    const errors: string[] = [];
    let appliedActions = 0;

    try {
      this.copyProject(projectPath, this.sandboxPath);

      const tsconfigPath = path.join(this.sandboxPath, 'tsconfig.json');
      const project = fs.existsSync(tsconfigPath)
        ? new Project({ tsConfigFilePath: tsconfigPath })
        : new Project({ compilerOptions: { strict: true } });

      if (!fs.existsSync(tsconfigPath)) {
        const files = this.getSourceFiles(this.sandboxPath);
        for (const f of files) {
          project.addSourceFileAtPath(f);
        }
      }

      for (const action of actionList.actions) {
        try {
          this.applyAction(project, action);
          appliedActions++;
        } catch (e) {
          errors.push(`${action.action}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      project.saveSync();
    } catch (e) {
      errors.push(`Sandbox setup failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    return { sandboxPath: this.sandboxPath, appliedActions, errors };
  }

  cleanup(): void {
    if (this.sandboxPath && fs.existsSync(this.sandboxPath)) {
      fs.rmSync(this.sandboxPath, { recursive: true, force: true });
      this.sandboxPath = null;
    }
  }

  private applyAction(project: Project, action: AstAction): void {
    switch (action.action) {
      case 'extract_class':
        this.applyExtractClass(project, action);
        break;
      case 'replace_node':
        this.applyReplaceNode(project, action);
        break;
      case 'rename_symbol':
        this.applyRenameSymbol(project, action);
        break;
      case 'extract_method':
      case 'convert_async':
        break;
    }
  }

  private applyExtractClass(project: Project, action: ExtractClassAction): void {
    const sourceFile = this.findSourceFile(project, action.sourceFile);
    if (!sourceFile) throw new Error(`Source file not found: ${action.sourceFile}`);

    const cls = sourceFile.getClass(action.className);
    if (!cls) throw new Error(`Class not found: ${action.className}`);

    const newFilePath = path.join(path.dirname(sourceFile.getFilePath()), action.newFileName);
    const newSourceFile = project.createSourceFile(newFilePath, '', { overwrite: true });

    const methodTexts: string[] = [];
    for (const methodName of action.methodNames) {
      const method = cls.getMethod(methodName);
      if (method) {
        methodTexts.push(method.getFullText());
        method.remove();
      }
    }

    newSourceFile.addClass({
      name: action.newClassName,
      isExported: true,
      methods: [],
    });

    const newClass = newSourceFile.getClassOrThrow(action.newClassName);
    for (const text of methodTexts) {
      newClass.addMember(text.trim());
    }

    sourceFile.addImportDeclaration({
      moduleSpecifier: `./${path.basename(action.newFileName, '.ts')}`,
      namedImports: [action.newClassName],
    });
  }

  private applyReplaceNode(project: Project, action: ReplaceNodeAction): void {
    const sourceFile = this.findSourceFile(project, action.sourceFile);
    if (!sourceFile) throw new Error(`Source file not found: ${action.sourceFile}`);

    const fullText = sourceFile.getFullText();
    const lines = fullText.split('\n');
    const before = lines.slice(0, action.startLine - 1).join('\n');
    const after = lines.slice(action.endLine).join('\n');
    const newText = [before, action.newCode, after].filter(Boolean).join('\n');

    sourceFile.replaceWithText(newText);
  }

  private applyRenameSymbol(project: Project, action: RenameSymbolAction): void {
    const sourceFile = this.findSourceFile(project, action.sourceFile);
    if (!sourceFile) throw new Error(`Source file not found: ${action.sourceFile}`);

    const fullText = sourceFile.getFullText();
    const renamed = fullText.replaceAll(action.oldName, action.newName);
    sourceFile.replaceWithText(renamed);

    for (const sf of project.getSourceFiles()) {
      if (sf === sourceFile) continue;
      const text = sf.getFullText();
      if (text.includes(action.oldName)) {
        sf.replaceWithText(text.replaceAll(action.oldName, action.newName));
      }
    }
  }

  private findSourceFile(project: Project, filePath: string): SourceFile | undefined {
    return project.getSourceFiles().find(sf => sf.getFilePath().endsWith(filePath));
  }

  private copyProject(src: string, dest: string): void {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        this.copyProject(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  private getSourceFiles(dir: string): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...this.getSourceFiles(full));
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        results.push(full);
      }
    }
    return results;
  }
}
