import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import * as path from 'node:path';
import { buildSymbolTable } from '../../src/analyzers/symbol-table-builder.js';

const FIXTURES = path.resolve(__dirname, '../fixtures/god-class-project');

describe('symbol-table-builder', () => {
  const project = new Project({ tsConfigFilePath: path.join(FIXTURES, 'tsconfig.json') });
  const sourceFiles = project.getSourceFiles();

  it('extracts classes with correct method count', () => {
    const table = buildSymbolTable(sourceFiles);
    const userService = table.classes.find(c => c.name === 'UserService');

    expect(userService).toBeDefined();
    expect(userService!.methods.length).toBe(18);
  });

  it('extracts constructor dependencies', () => {
    const table = buildSymbolTable(sourceFiles);
    const userService = table.classes.find(c => c.name === 'UserService');

    expect(userService!.constructorDeps).toHaveLength(4);
  });

  it('extracts interfaces', () => {
    const table = buildSymbolTable(sourceFiles);

    const dbInterface = table.interfaces.find(i => i.name === 'Database');
    expect(dbInterface).toBeDefined();
    expect(dbInterface!.isExported).toBe(true);
  });

  it('extracts exported status correctly', () => {
    const table = buildSymbolTable(sourceFiles);
    const userService = table.classes.find(c => c.name === 'UserService');

    expect(userService!.isExported).toBe(true);
  });

  it('extracts async method info', () => {
    const table = buildSymbolTable(sourceFiles);
    const userService = table.classes.find(c => c.name === 'UserService');
    const createUser = userService!.methods.find(m => m.name === 'createUser');

    expect(createUser).toBeDefined();
    expect(createUser!.isAsync).toBe(true);
  });
});
