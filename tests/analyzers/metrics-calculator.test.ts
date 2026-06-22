import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import * as path from 'node:path';
import { calculateFileMetrics, countLoc, calculateCyclomaticComplexity } from '../../src/analyzers/metrics-calculator.js';
import { buildDependencyGraph } from '../../src/analyzers/dependency-graph-builder.js';

const FIXTURES = path.resolve(__dirname, '../fixtures/god-class-project');

describe('metrics-calculator', () => {
  const project = new Project({ tsConfigFilePath: path.join(FIXTURES, 'tsconfig.json') });
  const sourceFiles = project.getSourceFiles();
  const graph = buildDependencyGraph(sourceFiles);
  const userServiceFile = sourceFiles.find(sf => sf.getFilePath().endsWith('UserService.ts'))!;

  describe('countLoc', () => {
    it('counts non-empty, non-comment lines', () => {
      const loc = countLoc(userServiceFile.getFullText());
      expect(loc).toBe(420);
    });
  });

  describe('calculateFileMetrics', () => {
    it('returns correct metrics for UserService', () => {
      const metrics = calculateFileMetrics(userServiceFile, graph);

      expect(metrics.loc).toBe(420);
      expect(metrics.coupling).toBe(4);
      expect(metrics.classes).toHaveLength(1);

      const classMetrics = metrics.classes[0];
      expect(classMetrics.name).toBe('UserService');
      expect(classMetrics.methodCount).toBe(18);
    });

    it('calculates cyclomatic complexity per method', () => {
      const metrics = calculateFileMetrics(userServiceFile, graph);
      const classMetrics = metrics.classes[0];

      for (const method of classMetrics.methods) {
        expect(method.cyclomaticComplexity).toBeGreaterThanOrEqual(1);
      }

      expect(classMetrics.avgComplexity).toBeGreaterThan(1);
      expect(classMetrics.maxComplexity).toBeGreaterThanOrEqual(classMetrics.avgComplexity);
    });
  });

  describe('calculateCyclomaticComplexity', () => {
    it('returns 1 for simple method (no branches)', () => {
      const simpleProject = new Project({ useInMemoryFileSystem: true });
      const sf = simpleProject.createSourceFile('test.ts', `
        class Test {
          simple(): string {
            return 'hello';
          }
        }
      `);
      const method = sf.getClasses()[0].getMethods()[0];
      expect(calculateCyclomaticComplexity(method)).toBe(1);
    });

    it('increments for if/for/while/catch/ternary/&&/||', () => {
      const complexProject = new Project({ useInMemoryFileSystem: true });
      const sf = complexProject.createSourceFile('test.ts', `
        class Test {
          complex(x: number): string {
            if (x > 0) {
              for (let i = 0; i < x; i++) {
                while (i > 0) {
                  break;
                }
              }
            }
            return x > 0 ? 'pos' : 'neg';
          }
        }
      `);
      const method = sf.getClasses()[0].getMethods()[0];
      const complexity = calculateCyclomaticComplexity(method);
      expect(complexity).toBeGreaterThan(1);
    });
  });
});
