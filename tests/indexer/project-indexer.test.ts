import { describe, it, expect } from 'vitest';
import { indexProject } from '../../src/indexer/project-indexer.js';
import * as path from 'node:path';

const FIXTURES = path.resolve(__dirname, '../fixtures');

describe('project-indexer', () => {
  describe('with tsconfig (ts-morph)', () => {
    it('parses valid TS/TSX project and returns source files', async () => {
      const result = await indexProject(path.join(FIXTURES, 'valid-project'));

      expect(result.files.length).toBeGreaterThanOrEqual(3);
      expect(result.errors).toHaveLength(0);

      const filePaths = result.files.map(f => f.filePath);
      expect(filePaths).toContain('hello.ts');
      expect(filePaths).toContain('math.ts');
      expect(filePaths).toContain('types.ts');

      for (const file of result.files) {
        expect(file.parser).toBe('ts-morph');
        expect(file.sourceFile).toBeDefined();
      }
    });
  });

  describe('without tsconfig (typescript-estree fallback)', () => {
    it('parses JS/JSX files using estree parser', async () => {
      const result = await indexProject(path.join(FIXTURES, 'no-tsconfig-project'));

      expect(result.files.length).toBeGreaterThanOrEqual(2);
      expect(result.errors).toHaveLength(0);

      for (const file of result.files) {
        expect(file.parser).toBe('typescript-estree');
        expect(file.ast).toBeDefined();
      }
    });
  });

  describe('error handling', () => {
    it('skips files with syntax errors gracefully', async () => {
      const result = await indexProject(path.join(FIXTURES, 'syntax-error-project'));

      const validFiles = result.files.filter(f => f.filePath === 'valid.ts');
      expect(validFiles).toHaveLength(1);

      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      const brokenError = result.errors.find(e => e.filePath === 'broken.ts');
      expect(brokenError).toBeDefined();
    });

    it('throws when path does not exist', async () => {
      await expect(indexProject('/nonexistent/path')).rejects.toThrow('Path does not exist');
    });
  });
});
