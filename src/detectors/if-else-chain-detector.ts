import { SourceFile, SyntaxKind, IfStatement, SwitchStatement, Node } from 'ts-morph';
import { Finding, Severity } from '../common/types.js';

export interface PatternFinding extends Finding {
  patternSuggestion: string;
}

export function detectIfElseChains(sourceFiles: SourceFile[], minBranches = 4): PatternFinding[] {
  const findings: PatternFinding[] = [];

  for (const sf of sourceFiles) {
    const filePath = sf.getFilePath();

    sf.forEachDescendant((node: Node) => {
      if (node.getKind() === SyntaxKind.IfStatement) {
        const ifStmt = node as IfStatement;
        if (isTopLevelIf(ifStmt)) {
          const branchCount = countIfElseBranches(ifStmt);
          if (branchCount >= minBranches) {
            const startLine = ifStmt.getStartLineNumber();
            const endLine = ifStmt.getEndLineNumber();
            findings.push({
              smellType: 'god-class',
              file: filePath,
              lineStart: startLine,
              lineEnd: endLine,
              severity: calculateSeverity(branchCount, minBranches),
              confidence: 0.85,
              metrics: { branches: branchCount },
              message: `If-else chain with ${branchCount} branches suggests Strategy Pattern`,
              patternSuggestion: 'Strategy Pattern',
            });
          }
        }
      }

      if (node.getKind() === SyntaxKind.SwitchStatement) {
        const switchStmt = node as SwitchStatement;
        const caseCount = switchStmt.getClauses().filter(
          c => c.getKind() === SyntaxKind.CaseClause
        ).length;
        if (caseCount >= minBranches) {
          const startLine = switchStmt.getStartLineNumber();
          const endLine = switchStmt.getEndLineNumber();
          findings.push({
            smellType: 'god-class',
            file: filePath,
            lineStart: startLine,
            lineEnd: endLine,
            severity: calculateSeverity(caseCount, minBranches),
            confidence: 0.9,
            metrics: { cases: caseCount },
            message: `Switch with ${caseCount} cases suggests Strategy Pattern`,
            patternSuggestion: 'Strategy Pattern',
          });
        }
      }
    });
  }

  return findings;
}

function isTopLevelIf(node: IfStatement): boolean {
  const parent = node.getParent();
  if (!parent) return true;
  return parent.getKind() !== SyntaxKind.IfStatement;
}

function countIfElseBranches(ifStmt: IfStatement): number {
  let count = 1;
  let current: IfStatement | undefined = ifStmt;
  while (current) {
    const elseStmt = current.getElseStatement();
    if (!elseStmt) break;
    count++;
    if (elseStmt.getKind() === SyntaxKind.IfStatement) {
      current = elseStmt as IfStatement;
    } else {
      break;
    }
  }
  return count;
}

function calculateSeverity(count: number, threshold: number): Severity {
  const ratio = count / threshold;
  if (ratio > 3) return 'critical';
  if (ratio > 2) return 'high';
  return 'medium';
}
