import { SourceFile, SyntaxKind, ClassDeclaration, MethodDeclaration, Node } from 'ts-morph';
import { Finding, Severity } from '../common/types.js';
import { PatternFinding } from './if-else-chain-detector.js';

export function detectDesignPatternOpportunities(sourceFiles: SourceFile[]): PatternFinding[] {
  const findings: PatternFinding[] = [];

  for (const sf of sourceFiles) {
    const filePath = sf.getFilePath();
    if (filePath.includes('node_modules') || filePath.includes('.test.')) continue;

    for (const cls of sf.getClasses()) {
      findings.push(...detectObserverNeed(cls, filePath));
      findings.push(...detectBuilderNeed(cls, filePath));
      findings.push(...detectFacadeNeed(cls, filePath));
    }
  }

  return findings;
}

function detectObserverNeed(cls: ClassDeclaration, filePath: string): PatternFinding[] {
  const findings: PatternFinding[] = [];

  for (const method of cls.getMethods()) {
    const body = method.getBody();
    if (!body) continue;

    let awaitCount = 0;
    body.forEachDescendant(node => {
      if (node.getKind() === SyntaxKind.AwaitExpression) {
        awaitCount++;
      }
    });

    if (awaitCount >= 4) {
      const methodText = method.getText();
      const hasSideEffects = /email|notify|log|track|analytics|slack|webhook/i.test(methodText);
      if (hasSideEffects) {
        findings.push({
          smellType: 'god-class',
          file: filePath,
          lineStart: method.getStartLineNumber(),
          lineEnd: method.getEndLineNumber(),
          severity: 'medium',
          confidence: 0.75,
          metrics: { awaitCalls: awaitCount },
          message: `Method "${method.getName()}" has ${awaitCount} await calls with side effects — consider Observer/Event Bus Pattern`,
          patternSuggestion: 'Observer Pattern (Event Bus)',
        });
      }
    }
  }

  return findings;
}

function detectBuilderNeed(cls: ClassDeclaration, filePath: string): PatternFinding[] {
  const findings: PatternFinding[] = [];
  const ctor = cls.getConstructors()[0];
  if (!ctor) return findings;

  const paramCount = ctor.getParameters().length;
  if (paramCount > 4) {
    findings.push({
      smellType: 'god-class',
      file: filePath,
      lineStart: ctor.getStartLineNumber(),
      lineEnd: ctor.getEndLineNumber(),
      severity: paramCount > 7 ? 'high' : 'medium',
      confidence: 0.8,
      metrics: { constructorParams: paramCount },
      message: `Class "${cls.getName()}" constructor has ${paramCount} parameters — consider Builder Pattern`,
      patternSuggestion: 'Builder Pattern',
    });
  }

  return findings;
}

function detectFacadeNeed(cls: ClassDeclaration, filePath: string): PatternFinding[] {
  const findings: PatternFinding[] = [];
  const ctor = cls.getConstructors()[0];
  if (!ctor) return findings;

  const depCount = ctor.getParameters().length;
  if (depCount < 5) return findings;

  for (const method of cls.getMethods()) {
    const body = method.getBody();
    if (!body) continue;

    let serviceCallCount = 0;
    body.forEachDescendant(node => {
      if (node.getKind() === SyntaxKind.PropertyAccessExpression) {
        const text = node.getText();
        if (/^this\.\w+\.\w+/.test(text)) {
          serviceCallCount++;
        }
      }
    });

    if (serviceCallCount >= 5) {
      findings.push({
        smellType: 'god-class',
        file: filePath,
        lineStart: method.getStartLineNumber(),
        lineEnd: method.getEndLineNumber(),
        severity: 'medium',
        confidence: 0.7,
        metrics: { serviceCalls: serviceCallCount, dependencies: depCount },
        message: `Method "${method.getName()}" orchestrates ${serviceCallCount} service calls — consider Facade Pattern`,
        patternSuggestion: 'Facade Pattern',
      });
    }
  }

  return findings;
}
