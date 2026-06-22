import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { runPipeline, MissingApiKeyError } from '../../src/pipeline/orchestrator.js';
import { DEFAULT_THRESHOLDS } from '../../src/common/types.js';

const GOD_CLASS_FIXTURES = path.resolve(__dirname, '../fixtures/god-class-project');
const VALID_FIXTURES = path.resolve(__dirname, '../fixtures/valid-project');

describe('Pipeline Orchestrator', () => {
  it('dry-run detects findings without calling Claude', async () => {
    const output = await runPipeline(GOD_CLASS_FIXTURES, {
      format: 'pretty',
      dryRun: true,
      thresholds: DEFAULT_THRESHOLDS,
    });

    expect(output.findings.length).toBeGreaterThan(0);
    expect(output.diff).toBeUndefined();
    expect(output.stats.filesAnalyzed).toBeGreaterThan(0);
    expect(output.processingMs).toBeGreaterThan(0);
  });

  it('returns no findings for clean project', async () => {
    const output = await runPipeline(VALID_FIXTURES, {
      format: 'json',
      dryRun: true,
      thresholds: DEFAULT_THRESHOLDS,
    });

    expect(output.findings).toHaveLength(0);
    expect(output.stats.totalFindings).toBe(0);
  });

  it('throws MissingApiKeyError when not dry-run and no key', async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      await expect(
        runPipeline(GOD_CLASS_FIXTURES, {
          format: 'json',
          dryRun: false,
          thresholds: DEFAULT_THRESHOLDS,
        })
      ).rejects.toThrow(MissingApiKeyError);
    } finally {
      if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
    }
  });

  it('throws for nonexistent path', async () => {
    await expect(
      runPipeline('/nonexistent/path', {
        format: 'json',
        dryRun: true,
        thresholds: DEFAULT_THRESHOLDS,
      })
    ).rejects.toThrow('Path does not exist');
  });
});
