import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { generateDiff, formatUnifiedDiff } from '../../src/diff/diff-generator.js';

describe('diff-generator', () => {
  let tmpOriginal: string;
  let tmpSandbox: string;

  function setup() {
    tmpOriginal = fs.mkdtempSync(path.join(os.tmpdir(), 'diff-orig-'));
    tmpSandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'diff-sandbox-'));
  }

  afterEach(() => {
    if (tmpOriginal) fs.rmSync(tmpOriginal, { recursive: true, force: true });
    if (tmpSandbox) fs.rmSync(tmpSandbox, { recursive: true, force: true });
  });

  it('detects modified files', () => {
    setup();
    fs.writeFileSync(path.join(tmpOriginal, 'file.ts'), 'const a = 1;\n');
    fs.writeFileSync(path.join(tmpSandbox, 'file.ts'), 'const a = 2;\n');

    const diffs = generateDiff(tmpOriginal, tmpSandbox);

    expect(diffs).toHaveLength(1);
    expect(diffs[0].filePath).toBe('file.ts');
    expect(diffs[0].isNew).toBe(false);
    expect(diffs[0].patch).toContain('const a = 1');
    expect(diffs[0].patch).toContain('const a = 2');
  });

  it('detects new files', () => {
    setup();
    fs.writeFileSync(path.join(tmpOriginal, 'existing.ts'), 'export const x = 1;\n');
    fs.writeFileSync(path.join(tmpSandbox, 'existing.ts'), 'export const x = 1;\n');
    fs.writeFileSync(path.join(tmpSandbox, 'new-file.ts'), 'export class NewClass {}\n');

    const diffs = generateDiff(tmpOriginal, tmpSandbox);

    expect(diffs).toHaveLength(1);
    expect(diffs[0].filePath).toBe('new-file.ts');
    expect(diffs[0].isNew).toBe(true);
    expect(diffs[0].patch).toContain('b/new-file.ts');
  });

  it('returns empty for identical directories', () => {
    setup();
    fs.writeFileSync(path.join(tmpOriginal, 'same.ts'), 'const x = 1;\n');
    fs.writeFileSync(path.join(tmpSandbox, 'same.ts'), 'const x = 1;\n');

    const diffs = generateDiff(tmpOriginal, tmpSandbox);
    expect(diffs).toHaveLength(0);
  });

  it('formatUnifiedDiff concatenates patches', () => {
    setup();
    fs.writeFileSync(path.join(tmpOriginal, 'a.ts'), 'old\n');
    fs.writeFileSync(path.join(tmpSandbox, 'a.ts'), 'new\n');
    fs.writeFileSync(path.join(tmpSandbox, 'b.ts'), 'brand new\n');

    const diffs = generateDiff(tmpOriginal, tmpSandbox);
    const unified = formatUnifiedDiff(diffs);

    expect(unified).toContain('a.ts');
    expect(unified).toContain('b.ts');
  });
});
