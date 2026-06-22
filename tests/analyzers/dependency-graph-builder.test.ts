import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import * as path from 'node:path';
import { buildDependencyGraph, getCouplingScore } from '../../src/analyzers/dependency-graph-builder.js';

const FIXTURES = path.resolve(__dirname, '../fixtures/god-class-project');

describe('dependency-graph-builder', () => {
  const project = new Project({ tsConfigFilePath: path.join(FIXTURES, 'tsconfig.json') });
  const sourceFiles = project.getSourceFiles();

  it('builds adjacency map from imports', () => {
    const graph = buildDependencyGraph(sourceFiles);

    expect(graph.adjacency.size).toBeGreaterThan(0);
  });

  it('detects correct coupling for UserService (4 imports)', () => {
    const graph = buildDependencyGraph(sourceFiles);
    const userServicePath = sourceFiles.find(sf =>
      sf.getFilePath().endsWith('UserService.ts')
    )!.getFilePath();

    const coupling = getCouplingScore(userServicePath, graph);
    expect(coupling).toBe(4);
  });

  it('returns 0 coupling for files with no local imports', () => {
    const graph = buildDependencyGraph(sourceFiles);
    const dbPath = sourceFiles.find(sf =>
      sf.getFilePath().endsWith('database.ts')
    )!.getFilePath();

    const coupling = getCouplingScore(dbPath, graph);
    expect(coupling).toBe(0);
  });

  it('stores edges for dependency relationships', () => {
    const graph = buildDependencyGraph(sourceFiles);

    expect(graph.edges.length).toBeGreaterThanOrEqual(4);
    const userServiceEdges = graph.edges.filter(e => e.from.endsWith('UserService.ts'));
    expect(userServiceEdges).toHaveLength(4);
  });
});
