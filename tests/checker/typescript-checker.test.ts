import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { checkTypeScript } from '../../src/checker/typescript-checker.js';

const FIXTURES = path.resolve(__dirname, '../fixtures');

describe('typescript-checker', () => {
  it('returns compilable=true for valid project', () => {
    const result = checkTypeScript(path.join(FIXTURES, 'valid-project'));
    expect(result.compilable).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns compilable=false with errors for broken project', () => {
    const result = checkTypeScript(path.join(FIXTURES, 'syntax-error-project'));
    expect(result.compilable).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toBeDefined();
  });
});
