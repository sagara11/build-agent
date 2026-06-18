import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import * as path from 'node:path';

const CLI_PATH = path.resolve(__dirname, '../dist/cli.js');
const FIXTURES = path.resolve(__dirname, 'fixtures');

describe('CLI entry point', () => {
  it('runs analyze command with pretty format', () => {
    const output = execFileSync('node', [CLI_PATH, 'analyze', path.join(FIXTURES, 'valid-project')], {
      encoding: 'utf-8',
    });
    expect(output).toContain('Indexed');
    expect(output).toContain('hello.ts');
  });

  it('runs analyze command with json format', () => {
    const output = execFileSync('node', [CLI_PATH, 'analyze', path.join(FIXTURES, 'valid-project'), '--format', 'json'], {
      encoding: 'utf-8',
    });
    const parsed = JSON.parse(output);
    expect(parsed.files).toBeInstanceOf(Array);
    expect(parsed.files.length).toBeGreaterThanOrEqual(3);
  });

  it('exits with error for missing path argument', () => {
    expect(() => {
      execFileSync('node', [CLI_PATH, 'analyze'], { encoding: 'utf-8', stdio: 'pipe' });
    }).toThrow();
  });
});
