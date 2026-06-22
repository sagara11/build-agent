import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import * as path from 'node:path';
import { detectIfElseChains } from '../../src/detectors/if-else-chain-detector.js';
import { detectManualFactory } from '../../src/detectors/manual-factory-detector.js';

const FIXTURES = path.resolve(__dirname, '../fixtures/pattern-project');

describe('Pattern Detectors', () => {
  const project = new Project({ tsConfigFilePath: path.join(FIXTURES, 'tsconfig.json') });
  const sourceFiles = project.getSourceFiles();

  describe('If-Else Chain Detector', () => {
    it('detects switch with 6 cases → Strategy suggested', () => {
      const findings = detectIfElseChains(sourceFiles, 4);
      const switchFinding = findings.find(f => f.metrics.cases !== undefined);

      expect(switchFinding).toBeDefined();
      expect(switchFinding!.metrics.cases).toBe(6);
      expect(switchFinding!.patternSuggestion).toBe('Strategy Pattern');
    });

    it('detects if-else chain with 5+ branches', () => {
      const findings = detectIfElseChains(sourceFiles, 4);
      const ifFinding = findings.find(f => f.metrics.branches !== undefined);

      expect(ifFinding).toBeDefined();
      expect(ifFinding!.metrics.branches).toBeGreaterThanOrEqual(4);
      expect(ifFinding!.patternSuggestion).toBe('Strategy Pattern');
    });

    it('does NOT detect chains below threshold', () => {
      const findings = detectIfElseChains(sourceFiles, 10);

      expect(findings).toHaveLength(0);
    });
  });

  describe('Manual Factory Detector', () => {
    it('detects Connection instantiated across multiple files', () => {
      const findings = detectManualFactory(sourceFiles, 3, 2);

      expect(findings.length).toBeGreaterThanOrEqual(1);
      const connFinding = findings.find(f => f.message.includes('Connection'));
      expect(connFinding).toBeDefined();
      expect(connFinding!.patternSuggestion).toBe('Factory Pattern');
      expect(connFinding!.metrics.files).toBeGreaterThanOrEqual(2);
    });

    it('does NOT detect with high threshold', () => {
      const findings = detectManualFactory(sourceFiles, 100, 10);

      expect(findings).toHaveLength(0);
    });
  });
});
