import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { DuplicatedCodeDetector } from '../../src/detectors/duplicated-code-detector.js';
import { DEFAULT_THRESHOLDS } from '../../src/common/types.js';
import { DetectorContext } from '../../src/detectors/base-detector.js';

const FIXTURES = path.resolve(__dirname, '../fixtures');

describe('DuplicatedCodeDetector', () => {
  const dupFixture = path.join(FIXTURES, 'duplicated-project');

  function createDupFixture() {
    fs.mkdirSync(dupFixture, { recursive: true });

    const sharedBlock = Array.from({ length: 10 }, (_, i) =>
      `  const value${i} = computeValue(${i});`
    ).join('\n');

    fs.writeFileSync(path.join(dupFixture, 'fileA.ts'), `
export function processA() {
${sharedBlock}
  return 'A';
}
`);

    fs.writeFileSync(path.join(dupFixture, 'fileB.ts'), `
export function processB() {
${sharedBlock}
  return 'B';
}
`);
  }

  function cleanDupFixture() {
    if (fs.existsSync(dupFixture)) {
      fs.rmSync(dupFixture, { recursive: true, force: true });
    }
  }

  it('detects duplicated code blocks', () => {
    createDupFixture();
    try {
      const detector = new DuplicatedCodeDetector(dupFixture);
      const context: DetectorContext = {
        symbolTable: { classes: [], functions: [], interfaces: [] },
        dependencyGraph: { adjacency: new Map(), edges: [] },
        fileMetrics: [],
        thresholds: DEFAULT_THRESHOLDS,
      };
      const findings = detector.detect(context);

      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings[0].smellType).toBe('duplicated-code');
      expect(findings[0].metrics.lines).toBeGreaterThanOrEqual(5);
    } finally {
      cleanDupFixture();
    }
  });

  it('returns empty for project with no duplicates', () => {
    const cleanPath = path.join(FIXTURES, 'valid-project');
    const detector = new DuplicatedCodeDetector(cleanPath);
    const context: DetectorContext = {
      symbolTable: { classes: [], functions: [], interfaces: [] },
      dependencyGraph: { adjacency: new Map(), edges: [] },
      fileMetrics: [],
      thresholds: DEFAULT_THRESHOLDS,
    };
    const findings = detector.detect(context);

    expect(findings).toHaveLength(0);
  });
});
