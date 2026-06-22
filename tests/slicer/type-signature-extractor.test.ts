import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import * as path from 'node:path';
import { extractTypeSignature, extractDependencySignatures } from '../../src/slicer/type-signature-extractor.js';
import { buildSymbolTable } from '../../src/analyzers/symbol-table-builder.js';

const GOD_CLASS_FIXTURES = path.resolve(__dirname, '../fixtures/god-class-project');

describe('Type Signature Extractor', () => {
  const project = new Project({ tsConfigFilePath: path.join(GOD_CLASS_FIXTURES, 'tsconfig.json') });
  const sourceFiles = project.getSourceFiles();
  const symbolTable = buildSymbolTable(sourceFiles);

  it('extracts interface-only representation for a class', () => {
    const sig = extractTypeSignature('UserService', symbolTable);

    expect(sig).toContain('interface UserService');
    expect(sig).toContain('createUser');
    expect(sig).toContain('getUserById');
    expect(sig).not.toContain('const');
    expect(sig).not.toContain('await');
  });

  it('extracts dependency signatures for UserService', () => {
    const cls = symbolTable.classes.find(c => c.name === 'UserService')!;
    const depSigs = extractDependencySignatures(cls, symbolTable);

    expect(depSigs).toContain('interface');
    expect(depSigs.length).toBeGreaterThan(0);
  });

  it('returns empty string for unknown class', () => {
    const sig = extractTypeSignature('NonExistent', symbolTable);
    expect(sig).toBe('');
  });
});
