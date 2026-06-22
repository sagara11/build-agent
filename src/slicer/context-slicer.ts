import { SourceFile } from 'ts-morph';
import { Finding, SymbolTable, DependencyGraph, FileMetrics } from '../common/types.js';
import { extractDependencySignatures } from './type-signature-extractor.js';

const MAX_FILE_LINES = 1000;
const TARGET_TOKENS = 600;

export interface SlicedContext {
  finding: Finding;
  sourceCode: string;
  dependencySignatures: string;
  metricsJson: string;
  estimatedTokens: number;
}

export function sliceContext(
  finding: Finding,
  sourceFiles: SourceFile[],
  symbolTable: SymbolTable,
  dependencyGraph: DependencyGraph,
  fileMetrics: FileMetrics[]
): SlicedContext {
  const sourceFile = sourceFiles.find(sf => sf.getFilePath().endsWith(finding.file));
  const sourceCode = sourceFile ? getRelevantSource(sourceFile, finding) : '';

  const classSymbol = symbolTable.classes.find(
    c => finding.message.includes(c.name)
  );
  const dependencySignatures = classSymbol
    ? extractDependencySignatures(classSymbol, symbolTable)
    : '';

  const metrics = fileMetrics.find(fm => fm.filePath.endsWith(finding.file));
  const metricsJson = metrics
    ? JSON.stringify({ loc: metrics.loc, coupling: metrics.coupling, classes: metrics.classes.map(c => ({ name: c.name, methodCount: c.methodCount, avgComplexity: c.avgComplexity })) })
    : '{}';

  const fullContent = [sourceCode, dependencySignatures, metricsJson].join('\n\n');
  const estimatedTokens = estimateTokens(fullContent);

  return { finding, sourceCode, dependencySignatures, metricsJson, estimatedTokens };
}

function getRelevantSource(sourceFile: SourceFile, finding: Finding): string {
  const fullText = sourceFile.getFullText();
  const lines = fullText.split('\n');

  if (lines.length <= MAX_FILE_LINES) {
    return fullText;
  }

  const targetClass = sourceFile.getClasses().find(cls => {
    const start = cls.getStartLineNumber();
    const end = cls.getEndLineNumber();
    return finding.lineStart >= start && finding.lineStart <= end;
  });

  if (targetClass) {
    return targetClass.getFullText();
  }

  const targetFunction = sourceFile.getFunctions().find(fn => {
    const start = fn.getStartLineNumber();
    const end = fn.getEndLineNumber();
    return finding.lineStart >= start && finding.lineStart <= end;
  });

  if (targetFunction) {
    return targetFunction.getFullText();
  }

  const start = Math.max(0, finding.lineStart - 1);
  const end = Math.min(lines.length, finding.lineEnd);
  return lines.slice(start, end).join('\n');
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
