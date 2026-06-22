import { SourceFile, SyntaxKind, NewExpression } from 'ts-morph';
import { Severity } from '../common/types.js';
import { PatternFinding } from './if-else-chain-detector.js';

export function detectManualFactory(sourceFiles: SourceFile[], minInstances = 3, minFiles = 2): PatternFinding[] {
  const classInstantiations = new Map<string, Array<{ file: string; line: number }>>();

  for (const sf of sourceFiles) {
    const filePath = sf.getFilePath();

    sf.forEachDescendant(node => {
      if (node.getKind() === SyntaxKind.NewExpression) {
        const newExpr = node as NewExpression;
        const className = newExpr.getExpression().getText();
        if (!classInstantiations.has(className)) {
          classInstantiations.set(className, []);
        }
        classInstantiations.get(className)!.push({
          file: filePath,
          line: newExpr.getStartLineNumber(),
        });
      }
    });
  }

  const findings: PatternFinding[] = [];

  for (const [className, instances] of classInstantiations) {
    const uniqueFiles = new Set(instances.map(i => i.file));
    if (instances.length >= minInstances && uniqueFiles.size >= minFiles) {
      const severity = calculateSeverity(instances.length, minInstances);
      findings.push({
        smellType: 'god-class',
        file: instances[0].file,
        lineStart: instances[0].line,
        lineEnd: instances[0].line,
        severity,
        confidence: 0.8,
        metrics: { instances: instances.length, files: uniqueFiles.size },
        message: `Class "${className}" instantiated ${instances.length} times across ${uniqueFiles.size} files — suggest Factory Pattern`,
        patternSuggestion: 'Factory Pattern',
      });
    }
  }

  return findings;
}

function calculateSeverity(instances: number, threshold: number): Severity {
  const ratio = instances / threshold;
  if (ratio > 4) return 'critical';
  if (ratio > 2) return 'high';
  return 'medium';
}
