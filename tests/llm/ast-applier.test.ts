import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AstApplier } from '../../src/llm/ast-applier.js';
import { AstActionList } from '../../src/llm/types.js';

const GOD_CLASS_FIXTURES = path.resolve(__dirname, '../fixtures/god-class-project');

describe('AstApplier', () => {
  const applier = new AstApplier();

  afterEach(() => {
    applier.cleanup();
  });

  it('extract_class creates new file with moved methods', async () => {
    const actionList: AstActionList = {
      reasoning: 'Extract notification responsibility',
      actions: [
        {
          action: 'extract_class',
          sourceFile: 'UserService.ts',
          className: 'UserService',
          methodNames: ['sendNotification', 'bulkNotify'],
          newFileName: 'NotificationService.ts',
          newClassName: 'NotificationService',
        },
      ],
    };

    const result = await applier.apply(GOD_CLASS_FIXTURES, actionList);

    expect(result.appliedActions).toBe(1);
    expect(result.errors).toHaveLength(0);

    const newFilePath = path.join(result.sandboxPath, 'NotificationService.ts');
    expect(fs.existsSync(newFilePath)).toBe(true);

    const newContent = fs.readFileSync(newFilePath, 'utf-8');
    expect(newContent).toContain('NotificationService');
    expect(newContent).toContain('sendNotification');
    expect(newContent).toContain('bulkNotify');
  });

  it('sandbox isolation: original project unchanged', async () => {
    const originalContent = fs.readFileSync(
      path.join(GOD_CLASS_FIXTURES, 'UserService.ts'),
      'utf-8'
    );

    const actionList: AstActionList = {
      reasoning: 'Test sandbox isolation',
      actions: [
        {
          action: 'rename_symbol',
          sourceFile: 'UserService.ts',
          oldName: 'UserService',
          newName: 'RenamedService',
        },
      ],
    };

    await applier.apply(GOD_CLASS_FIXTURES, actionList);

    const afterContent = fs.readFileSync(
      path.join(GOD_CLASS_FIXTURES, 'UserService.ts'),
      'utf-8'
    );
    expect(afterContent).toBe(originalContent);
  });

  it('rename_symbol updates references across project', async () => {
    const actionList: AstActionList = {
      reasoning: 'Rename for clarity',
      actions: [
        {
          action: 'rename_symbol',
          sourceFile: 'UserService.ts',
          oldName: 'createUser',
          newName: 'registerUser',
        },
      ],
    };

    const result = await applier.apply(GOD_CLASS_FIXTURES, actionList);

    expect(result.appliedActions).toBe(1);
    const content = fs.readFileSync(
      path.join(result.sandboxPath, 'UserService.ts'),
      'utf-8'
    );
    expect(content).toContain('registerUser');
    expect(content).not.toContain('createUser');
  });

  it('handles errors gracefully', async () => {
    const actionList: AstActionList = {
      reasoning: 'Test error handling',
      actions: [
        {
          action: 'extract_class',
          sourceFile: 'NonExistent.ts',
          className: 'Foo',
          methodNames: ['bar'],
          newFileName: 'Baz.ts',
          newClassName: 'Baz',
        },
      ],
    };

    const result = await applier.apply(GOD_CLASS_FIXTURES, actionList);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.appliedActions).toBe(0);
  });
});
