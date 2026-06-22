import { SourceFile } from 'ts-morph';
import * as path from 'node:path';
import { DependencyGraph } from '../common/types.js';

export function buildDependencyGraph(sourceFiles: SourceFile[]): DependencyGraph {
  const adjacency = new Map<string, string[]>();
  const edges: Array<{ from: string; to: string }> = [];

  const fileSet = new Set(sourceFiles.map(sf => sf.getFilePath()));

  for (const sf of sourceFiles) {
    const filePath = sf.getFilePath();
    const deps: string[] = [];

    for (const imp of sf.getImportDeclarations()) {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      if (moduleSpecifier.startsWith('.')) {
        const resolvedPath = resolveImportPath(filePath, moduleSpecifier, fileSet);
        if (resolvedPath) {
          deps.push(resolvedPath);
          edges.push({ from: filePath, to: resolvedPath });
        }
      }
    }

    adjacency.set(filePath, deps);
  }

  return { adjacency, edges };
}

export function getCouplingScore(filePath: string, graph: DependencyGraph): number {
  const deps = graph.adjacency.get(filePath);
  if (!deps) return 0;
  return new Set(deps).size;
}

function resolveImportPath(fromFile: string, specifier: string, fileSet: Set<string>): string | null {
  const dir = path.dirname(fromFile);
  const base = path.resolve(dir, specifier);

  const candidates = [
    base,
    base + '.ts',
    base + '.tsx',
    base + '.js',
    base + '.jsx',
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
    path.join(base, 'index.js'),
  ];

  for (const candidate of candidates) {
    if (fileSet.has(candidate)) return candidate;
  }

  return null;
}
