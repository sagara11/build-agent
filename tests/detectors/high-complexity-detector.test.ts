import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import * as path from 'node:path';
import { HighComplexityDetector } from '../../src/detectors/high-complexity-detector.js';
import { buildDependencyGraph } from '../../src/analyzers/dependency-graph-builder.js';
import { buildSymbolTable } from '../../src/analyzers/symbol-table-builder.js';
import { calculateFileMetrics } from '../../src/analyzers/metrics-calculator.js';
import { DEFAULT_THRESHOLDS } from '../../src/common/types.js';
import { DetectorContext } from '../../src/detectors/base-detector.js';

const GOD_CLASS_FIXTURES = path.resolve(__dirname, '../fixtures/god-class-project');
const CLEAN_FIXTURES = path.resolve(__dirname, '../fixtures/valid-project');

describe('HighComplexityDetector', () => {
  const detector = new HighComplexityDetector();

  function buildContext(fixturePath: string, thresholdOverride?: number): DetectorContext {
    const project = new Project({ tsConfigFilePath: path.join(fixturePath, 'tsconfig.json') });
    const sourceFiles = project.getSourceFiles();
    const symbolTable = buildSymbolTable(sourceFiles);
    const dependencyGraph = buildDependencyGraph(sourceFiles);
    const fileMetrics = sourceFiles.map(sf => calculateFileMetrics(sf, dependencyGraph));
    const thresholds = { ...DEFAULT_THRESHOLDS };
    if (thresholdOverride) thresholds.highComplexity = thresholdOverride;
    return { symbolTable, dependencyGraph, fileMetrics, thresholds };
  }

  it('detects high complexity methods with low threshold', () => {
    const context = buildContext(GOD_CLASS_FIXTURES, 3);
    const findings = detector.detect(context);

    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(f.smellType).toBe('high-complexity');
      expect(f.metrics.cyclomaticComplexity).toBeGreaterThan(3);
    }
  });

  it('does NOT detect in clean project with default threshold', () => {
    const context = buildContext(CLEAN_FIXTURES);
    const findings = detector.detect(context);

    expect(findings).toHaveLength(0);
  });

  it('returns correct severity levels', () => {
    const context = buildContext(GOD_CLASS_FIXTURES, 2);
    const findings = detector.detect(context);

    if (findings.length > 0) {
      expect(['medium', 'high', 'critical']).toContain(findings[0].severity);
    }
  });
});
