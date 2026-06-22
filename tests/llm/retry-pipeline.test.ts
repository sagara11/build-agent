import { describe, it, expect, vi } from 'vitest';
import { RetryPipeline } from '../../src/llm/retry-pipeline.js';
import { ClaudeClient } from '../../src/llm/claude-client.js';
import * as path from 'node:path';

const FIXTURES = path.resolve(__dirname, '../fixtures/god-class-project');

describe('RetryPipeline', () => {
  it('succeeds on first try when changes compile', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{
        type: 'tool_use',
        id: 'id',
        name: 'apply_ast_changes',
        input: {
          reasoning: 'Rename for clarity',
          actions: [{
            action: 'rename_symbol',
            sourceFile: 'database.ts',
            oldName: 'Database',
            newName: 'DatabaseClient',
          }],
        },
      }],
    });
    const mockClient = { messages: { create: mockCreate } } as any;
    const client = new ClaudeClient(mockClient);

    const pipeline = new RetryPipeline(client, FIXTURES);
    const result = await pipeline.run('test prompt');

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.sandboxPath).not.toBeNull();
  });

  it('retries on compile failure then succeeds', async () => {
    let callCount = 0;
    const mockCreate = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          content: [{
            type: 'tool_use',
            id: 'id',
            name: 'apply_ast_changes',
            input: {
              reasoning: 'Bad code',
              actions: [{
                action: 'replace_node',
                sourceFile: 'database.ts',
                startLine: 1,
                endLine: 4,
                newCode: 'const broken: = invalid syntax;',
              }],
            },
          }],
        });
      }
      return Promise.resolve({
        content: [{
          type: 'tool_use',
          id: 'id2',
          name: 'apply_ast_changes',
          input: {
            reasoning: 'Fixed',
            actions: [{
              action: 'rename_symbol',
              sourceFile: 'database.ts',
              oldName: 'Database',
              newName: 'DB',
            }],
          },
        }],
      });
    });

    const mockClient = { messages: { create: mockCreate } } as any;
    const client = new ClaudeClient(mockClient);

    const pipeline = new RetryPipeline(client, FIXTURES);
    const result = await pipeline.run('test prompt');

    expect(result.attempts).toBeGreaterThan(1);
  });

  it('fails gracefully after max retries', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{
        type: 'tool_use',
        id: 'id',
        name: 'apply_ast_changes',
        input: {
          reasoning: 'Always bad',
          actions: [{
            action: 'replace_node',
            sourceFile: 'database.ts',
            startLine: 1,
            endLine: 4,
            newCode: 'const broken: = invalid;',
          }],
        },
      }],
    });

    const mockClient = { messages: { create: mockCreate } } as any;
    const client = new ClaudeClient(mockClient);

    const pipeline = new RetryPipeline(client, FIXTURES);
    const result = await pipeline.run('test prompt');

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(3);
    expect(result.sandboxPath).toBeNull();
  });
});
