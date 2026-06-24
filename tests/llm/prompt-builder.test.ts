import { describe, it, expect } from 'vitest';
import { buildPrompt } from '../../src/llm/prompt-builder.js';
import { SlicedContext } from '../../src/slicer/context-slicer.js';

describe('prompt-builder', () => {
  it('builds prompt with all sections', async () => {
    const slicedContext: SlicedContext = {
      finding: {
        smellType: 'god-class',
        file: 'UserService.ts',
        lineStart: 1,
        lineEnd: 420,
        severity: 'high',
        confidence: 1,
        metrics: { loc: 420, methodCount: 18, coupling: 4 },
        message: 'Class "UserService" is a God Class',
      },
      sourceCode: 'export class UserService { }',
      dependencySignatures: 'interface Database { query(): void; }',
      metricsJson: '{"loc":420}',
      estimatedTokens: 200,
    };

    const prompt = await buildPrompt(slicedContext);

    expect(prompt).toContain('## Issue Summary');
    expect(prompt).toContain('god-class');
    expect(prompt).toContain('UserService.ts');
    expect(prompt).toContain('## Source Code');
    expect(prompt).toContain('export class UserService');
    expect(prompt).toContain('## Dependency Type Signatures');
    expect(prompt).toContain('interface Database');
    expect(prompt).toContain('## Instructions');
    expect(prompt).toContain('apply_ast_changes');
  });
});
