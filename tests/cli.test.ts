import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import * as path from 'node:path';

const CLI_PATH = path.resolve(__dirname, '../dist/cli.js');
const FIXTURES = path.resolve(__dirname, 'fixtures');

describe('CLI entry point', () => {
  it('runs analyze --dry-run with pretty format', () => {
    const output = execFileSync('node', [CLI_PATH, 'analyze', path.join(FIXTURES, 'valid-project'), '--dry-run'], {
      encoding: 'utf-8',
    });
    expect(output).toContain('Analysis Results');
    expect(output).toContain('Summary');
  });

  it('runs analyze --dry-run with json format', () => {
    const output = execFileSync('node', [CLI_PATH, 'analyze', path.join(FIXTURES, 'valid-project'), '--dry-run', '--format', 'json'], {
      encoding: 'utf-8',
    });
    const parsed = JSON.parse(output);
    expect(parsed.findings).toBeInstanceOf(Array);
    expect(parsed.stats).toBeDefined();
    expect(parsed.stats.filesAnalyzed).toBeGreaterThanOrEqual(3);
  });

  it('exits with error for missing path argument', () => {
    expect(() => {
      execFileSync('node', [CLI_PATH, 'analyze'], { encoding: 'utf-8', stdio: 'pipe' });
    }).toThrow();
  });
});
