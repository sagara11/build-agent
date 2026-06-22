import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import * as path from 'node:path';
import { sliceContext, estimateTokens } from '../../src/slicer/context-slicer.js';
import { buildSymbolTable } from '../../src/analyzers/symbol-table-builder.js';
import { buildDependencyGraph } from '../../src/analyzers/dependency-graph-builder.js';
import { calculateFileMetrics } from '../../src/analyzers/metrics-calculator.js';
import { Finding } from '../../src/common/types.js';

const GOD_CLASS_FIXTURES = path.resolve(__dirname, '../fixtures/god-class-project');

describe('Context Slicer', () => {
  const project = new Project({ tsConfigFilePath: path.join(GOD_CLASS_FIXTURES, 'tsconfig.json') });
  const sourceFiles = project.getSourceFiles();
  const symbolTable = buildSymbolTable(sourceFiles);
  const dependencyGraph = buildDependencyGraph(sourceFiles);
  const fileMetrics = sourceFiles.map(sf => calculateFileMetrics(sf, dependencyGraph));

  const godClassFinding: Finding = {
    smellType: 'god-class',
    file: 'UserService.ts',
    lineStart: 1,
    lineEnd: 420,
    severity: 'high',
    confidence: 1,
    metrics: { loc: 420, methodCount: 18, coupling: 4 },
    message: 'Class "UserService" is a God Class',
  };

  it('produces sliced context with source, signatures, and metrics', () => {
    const sliced = sliceContext(godClassFinding, sourceFiles, symbolTable, dependencyGraph, fileMetrics);

    expect(sliced.sourceCode).toContain('class UserService');
    expect(sliced.dependencySignatures).toContain('interface');
    expect(sliced.metricsJson).toContain('loc');
    expect(sliced.estimatedTokens).toBeGreaterThan(0);
  });

  it('targets ~600 tokens for god class context', () => {
    const sliced = sliceContext(godClassFinding, sourceFiles, symbolTable, dependencyGraph, fileMetrics);

    expect(sliced.estimatedTokens).toBeGreaterThan(100);
    expect(sliced.estimatedTokens).toBeLessThan(5000);
  });

  describe('estimateTokens', () => {
    it('estimates tokens as chars/4', () => {
      const text = 'a'.repeat(400);
      expect(estimateTokens(text)).toBe(100);
    });
  });
});
