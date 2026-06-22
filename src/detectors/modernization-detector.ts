import { SourceFile, SyntaxKind, Node, VariableDeclarationKind } from 'ts-morph';
import { Finding, Severity } from '../common/types.js';

export type ModernizationType =
  | 'callback-hell'
  | 'promise-chain'
  | 'commonjs'
  | 'var-usage'
  | 'console-log'
  | 'untyped-catch';

export interface ModernizationFinding extends Finding {
  modernizationType: ModernizationType;
  modernAlternative: string;
}

export function detectModernizationIssues(sourceFiles: SourceFile[]): ModernizationFinding[] {
  const findings: ModernizationFinding[] = [];

  for (const sf of sourceFiles) {
    const filePath = sf.getFilePath();
    if (filePath.includes('node_modules') || filePath.includes('.test.') || filePath.includes('.spec.')) continue;

    findings.push(...detectVarUsage(sf, filePath));
    findings.push(...detectConsoleLog(sf, filePath));
    findings.push(...detectPromiseChains(sf, filePath));
    findings.push(...detectCommonJS(sf, filePath));
    findings.push(...detectUntypedCatch(sf, filePath));
  }

  return findings;
}

function detectVarUsage(sf: SourceFile, filePath: string): ModernizationFinding[] {
  const findings: ModernizationFinding[] = [];

  for (const decl of sf.getVariableStatements()) {
    if (decl.getDeclarationKind() === VariableDeclarationKind.Var) {
      findings.push({
        smellType: 'god-class',
        modernizationType: 'var-usage',
        file: filePath,
        lineStart: decl.getStartLineNumber(),
        lineEnd: decl.getEndLineNumber(),
        severity: 'medium',
        confidence: 1,
        metrics: {},
        message: `\`var\` usage detected — use \`const\` or \`let\` with proper TypeScript types`,
        modernAlternative: 'const/let with TypeScript types',
      });
    }
  }

  return findings;
}

function detectConsoleLog(sf: SourceFile, filePath: string): ModernizationFinding[] {
  const findings: ModernizationFinding[] = [];

  sf.forEachDescendant(node => {
    if (node.getKind() === SyntaxKind.CallExpression) {
      const text = node.getText();
      if (/^console\.(log|warn|error|info|debug)\(/.test(text)) {
        findings.push({
          smellType: 'god-class',
          modernizationType: 'console-log',
          file: filePath,
          lineStart: node.getStartLineNumber(),
          lineEnd: node.getEndLineNumber(),
          severity: 'medium',
          confidence: 0.8,
          metrics: {},
          message: `\`${text.slice(0, 30)}...\` — use structured logging (e.g. pino) instead of console`,
          modernAlternative: 'Structured logging (pino/winston)',
        });
      }
    }
  });

  return findings;
}

function detectPromiseChains(sf: SourceFile, filePath: string): ModernizationFinding[] {
  const findings: ModernizationFinding[] = [];
  const text = sf.getFullText();

  const thenMatches = text.match(/\.then\s*\(/g);
  if (thenMatches && thenMatches.length >= 3) {
    const lines = text.split('\n');
    let firstThenLine = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('.then(')) {
        firstThenLine = i + 1;
        break;
      }
    }

    findings.push({
      smellType: 'god-class',
      modernizationType: 'promise-chain',
      file: filePath,
      lineStart: firstThenLine,
      lineEnd: firstThenLine,
      severity: 'medium',
      confidence: 0.85,
      metrics: { thenCount: thenMatches.length },
      message: `Promise chain with ${thenMatches.length} .then() calls — convert to async/await`,
      modernAlternative: 'async/await',
    });
  }

  return findings;
}

function detectCommonJS(sf: SourceFile, filePath: string): ModernizationFinding[] {
  const findings: ModernizationFinding[] = [];
  const text = sf.getFullText();

  if (/\brequire\s*\(/.test(text) || /module\.exports/.test(text)) {
    findings.push({
      smellType: 'god-class',
      modernizationType: 'commonjs',
      file: filePath,
      lineStart: 1,
      lineEnd: 1,
      severity: 'medium',
      confidence: 0.9,
      metrics: {},
      message: `CommonJS syntax detected (require/module.exports) — migrate to ES Modules (import/export)`,
      modernAlternative: 'ES Modules (import/export)',
    });
  }

  return findings;
}

function detectUntypedCatch(sf: SourceFile, filePath: string): ModernizationFinding[] {
  const findings: ModernizationFinding[] = [];

  sf.forEachDescendant(node => {
    if (node.getKind() === SyntaxKind.CatchClause) {
      const catchText = node.getText();
      if (catchText.includes(': any') || (catchText.includes('(err)') && !catchText.includes(': unknown'))) {
        findings.push({
          smellType: 'god-class',
          modernizationType: 'untyped-catch',
          file: filePath,
          lineStart: node.getStartLineNumber(),
          lineEnd: node.getEndLineNumber(),
          severity: 'medium',
          confidence: 0.75,
          metrics: {},
          message: `Untyped catch clause — use typed error handling with custom error classes`,
          modernAlternative: 'Typed Error Hierarchy (custom AppError classes)',
        });
      }
    }
  });

  return findings;
}
