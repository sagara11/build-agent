import { SourceFile, SyntaxKind, MethodDeclaration, FunctionDeclaration, Node } from 'ts-morph';
import { DependencyGraph, FileMetrics, ClassMetrics, MethodMetrics } from '../common/types.js';
import { getCouplingScore } from './dependency-graph-builder.js';

export function calculateFileMetrics(sourceFile: SourceFile, graph: DependencyGraph): FileMetrics {
  const filePath = sourceFile.getFilePath();
  const loc = countLoc(sourceFile.getFullText());
  const coupling = getCouplingScore(filePath, graph);
  const classes: ClassMetrics[] = [];

  for (const cls of sourceFile.getClasses()) {
    const classText = cls.getFullText();
    const classLoc = countLoc(classText);
    const methods: MethodMetrics[] = [];

    for (const method of cls.getMethods()) {
      const methodLoc = countLoc(method.getFullText());
      const complexity = calculateCyclomaticComplexity(method);
      methods.push({ name: method.getName(), cyclomaticComplexity: complexity, loc: methodLoc });
    }

    const methodCount = methods.length;
    const avgComplexity = methodCount > 0
      ? methods.reduce((sum, m) => sum + m.cyclomaticComplexity, 0) / methodCount
      : 0;
    const maxComplexity = methodCount > 0
      ? Math.max(...methods.map(m => m.cyclomaticComplexity))
      : 0;

    classes.push({
      name: cls.getName() || '(anonymous)',
      filePath,
      loc: classLoc,
      methodCount,
      methods,
      avgComplexity,
      maxComplexity,
      coupling,
    });
  }

  return { filePath, loc, classes, coupling };
}

export function countLoc(text: string): number {
  return text
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('//');
    })
    .length;
}

export function calculateCyclomaticComplexity(node: MethodDeclaration | FunctionDeclaration): number {
  let complexity = 1;

  node.forEachDescendant((child: Node) => {
    switch (child.getKind()) {
      case SyntaxKind.IfStatement:
      case SyntaxKind.ForStatement:
      case SyntaxKind.ForInStatement:
      case SyntaxKind.ForOfStatement:
      case SyntaxKind.WhileStatement:
      case SyntaxKind.DoStatement:
      case SyntaxKind.CaseClause:
      case SyntaxKind.CatchClause:
      case SyntaxKind.ConditionalExpression:
        complexity++;
        break;
      case SyntaxKind.BinaryExpression: {
        const opToken = child.getChildAtIndex(1);
        if (opToken) {
          const kind = opToken.getKind();
          if (kind === SyntaxKind.AmpersandAmpersandToken || kind === SyntaxKind.BarBarToken) {
            complexity++;
          }
        }
        break;
      }
    }
  });

  return complexity;
}
