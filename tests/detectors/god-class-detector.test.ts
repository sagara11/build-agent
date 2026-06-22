import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import * as path from 'node:path';
import { GodClassDetector } from '../../src/detectors/god-class-detector.js';
import { buildSymbolTable } from '../../src/analyzers/symbol-table-builder.js';
import { buildDependencyGraph } from '../../src/analyzers/dependency-graph-builder.js';
import { calculateFileMetrics } from '../../src/analyzers/metrics-calculator.js';
import { DEFAULT_THRESHOLDS } from '../../src/common/types.js';
import { DetectorContext } from '../../src/detectors/base-detector.js';

const GOD_CLASS_FIXTURES = path.resolve(__dirname, '../fixtures/god-class-project');
const CLEAN_FIXTURES = path.resolve(__dirname, '../fixtures/valid-project');

describe('GodClassDetector', () => {
  const detector = new GodClassDetector();

  function buildContext(fixturePath: string): DetectorContext {
    const project = new Project({ tsConfigFilePath: path.join(fixturePath, 'tsconfig.json') });
    const sourceFiles = project.getSourceFiles();
    const symbolTable = buildSymbolTable(sourceFiles);
    const dependencyGraph = buildDependencyGraph(sourceFiles);
    const fileMetrics = sourceFiles.map(sf => calculateFileMetrics(sf, dependencyGraph));
    return { symbolTable, dependencyGraph, fileMetrics, thresholds: DEFAULT_THRESHOLDS };
  }

  it('detects UserService as God Class', () => {
    const context = buildContext(GOD_CLASS_FIXTURES);
    const findings = detector.detect(context);

    expect(findings.length).toBeGreaterThanOrEqual(1);
    const godClass = findings.find(f => f.message.includes('UserService'));
    expect(godClass).toBeDefined();
    expect(godClass!.smellType).toBe('god-class');
    expect(godClass!.metrics.methodCount).toBe(18);
    expect(godClass!.metrics.coupling).toBe(4);
  });

  it('includes responsibility groups', () => {
    const context = buildContext(GOD_CLASS_FIXTURES);
    const findings = detector.detect(context);
    const godClass = findings.find(f => f.message.includes('UserService'));

    expect(godClass!.responsibilityGroups).toBeDefined();
    expect(godClass!.responsibilityGroups!.length).toBeGreaterThanOrEqual(2);
  });

  it('does NOT detect clean small classes', () => {
    const context = buildContext(CLEAN_FIXTURES);
    const findings = detector.detect(context);

    expect(findings).toHaveLength(0);
  });

  it('assigns appropriate severity', () => {
    const context = buildContext(GOD_CLASS_FIXTURES);
    const findings = detector.detect(context);
    const godClass = findings.find(f => f.message.includes('UserService'));

    expect(['medium', 'high', 'critical']).toContain(godClass!.severity);
  });
});
