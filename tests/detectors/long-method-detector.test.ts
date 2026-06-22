import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import * as path from 'node:path';
import { LongMethodDetector } from '../../src/detectors/long-method-detector.js';
import { buildDependencyGraph } from '../../src/analyzers/dependency-graph-builder.js';
import { buildSymbolTable } from '../../src/analyzers/symbol-table-builder.js';
import { calculateFileMetrics } from '../../src/analyzers/metrics-calculator.js';
import { DEFAULT_THRESHOLDS } from '../../src/common/types.js';
import { DetectorContext } from '../../src/detectors/base-detector.js';

const GOD_CLASS_FIXTURES = path.resolve(__dirname, '../fixtures/god-class-project');
const CLEAN_FIXTURES = path.resolve(__dirname, '../fixtures/valid-project');

describe('LongMethodDetector', () => {
  const detector = new LongMethodDetector();

  function buildContext(fixturePath: string, thresholdOverride?: number): DetectorContext {
    const project = new Project({ tsConfigFilePath: path.join(fixturePath, 'tsconfig.json') });
    const sourceFiles = project.getSourceFiles();
    const symbolTable = buildSymbolTable(sourceFiles);
    const dependencyGraph = buildDependencyGraph(sourceFiles);
    const fileMetrics = sourceFiles.map(sf => calculateFileMetrics(sf, dependencyGraph));
    const thresholds = { ...DEFAULT_THRESHOLDS };
    if (thresholdOverride) thresholds.longMethodLoc = thresholdOverride;
    return { symbolTable, dependencyGraph, fileMetrics, thresholds };
  }

  it('detects long methods when threshold is low', () => {
    const context = buildContext(GOD_CLASS_FIXTURES, 15);
    const findings = detector.detect(context);

    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(f.smellType).toBe('long-method');
      expect(f.metrics.loc).toBeGreaterThan(15);
    }
  });

  it('does NOT detect methods in clean small project', () => {
    const context = buildContext(CLEAN_FIXTURES);
    const findings = detector.detect(context);

    expect(findings).toHaveLength(0);
  });

  it('assigns severity based on threshold ratio', () => {
    const context = buildContext(GOD_CLASS_FIXTURES, 10);
    const findings = detector.detect(context);

    if (findings.length > 0) {
      expect(['medium', 'high', 'critical']).toContain(findings[0].severity);
    }
  });
});
