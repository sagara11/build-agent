import { describe, it, expect } from 'vitest';
import { formatJson } from '../../src/output/json-formatter.js';
import { formatPretty } from '../../src/output/pretty-formatter.js';
import { PipelineOutput } from '../../src/pipeline/orchestrator.js';

const mockOutput: PipelineOutput = {
  findings: [
    {
      smellType: 'god-class',
      file: 'UserService.ts',
      lineStart: 1,
      lineEnd: 420,
      severity: 'high',
      confidence: 1,
      metrics: { loc: 420, methodCount: 18, coupling: 4 },
      message: 'Class "UserService" is a God Class',
    },
  ],
  diff: '--- a/UserService.ts\n+++ b/UserService.ts\n@@ -1 +1 @@\n-old\n+new\n',
  stats: {
    filesAnalyzed: 5,
    totalFindings: 1,
    critical: 0,
    high: 1,
    medium: 0,
  },
  processingMs: 1234,
};

describe('Formatters', () => {
  describe('JSON formatter', () => {
    it('produces valid JSON', () => {
      const json = formatJson(mockOutput);
      const parsed = JSON.parse(json);

      expect(parsed.findings).toHaveLength(1);
      expect(parsed.stats.filesAnalyzed).toBe(5);
      expect(parsed.processingMs).toBe(1234);
      expect(parsed.diff).toContain('UserService.ts');
    });
  });

  describe('Pretty formatter', () => {
    it('includes all sections', () => {
      const pretty = formatPretty(mockOutput);

      expect(pretty).toContain('Analysis Results');
      expect(pretty).toContain('UserService.ts');
      expect(pretty).toContain('Summary');
      expect(pretty).toContain('1234ms');
    });

    it('shows no issues message for empty findings', () => {
      const emptyOutput: PipelineOutput = {
        findings: [],
        stats: { filesAnalyzed: 3, totalFindings: 0, critical: 0, high: 0, medium: 0 },
        processingMs: 100,
      };
      const pretty = formatPretty(emptyOutput);
      expect(pretty).toContain('No issues found');
    });
  });
});
