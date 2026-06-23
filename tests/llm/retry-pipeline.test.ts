import { describe, it, expect, vi } from 'vitest';
import { RetryPipeline } from '../../src/llm/retry-pipeline.js';
import { ClaudeClient } from '../../src/llm/claude-client.js';
import * as path from 'node:path';

const FIXTURES = path.resolve(__dirname, '../fixtures/god-class-project');

function mockOpenAIResponse(actions: any[], reasoning = 'test') {
  return {
    choices: [{
      message: {
        tool_calls: [{
          id: 'call-1',
          type: 'function',
          function: {
            name: 'apply_ast_changes',
            arguments: JSON.stringify({ reasoning, actions }),
          },
        }],
      },
    }],
  };
}

describe('RetryPipeline', () => {
  it('succeeds on first try when changes compile', async () => {
    const mockCreate = vi.fn().mockResolvedValue(
      mockOpenAIResponse([{
        action: 'rename_symbol',
        sourceFile: 'database.ts',
        oldName: 'Database',
        newName: 'DatabaseClient',
      }])
    );
    const mockOpenAI = { chat: { completions: { create: mockCreate } } } as any;
    const client = new ClaudeClient(mockOpenAI);

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
        return Promise.resolve(mockOpenAIResponse([{
          action: 'replace_node',
          sourceFile: 'database.ts',
          startLine: 1,
          endLine: 4,
          newCode: 'const broken: = invalid syntax;',
        }], 'Bad code'));
      }
      return Promise.resolve(mockOpenAIResponse([{
        action: 'rename_symbol',
        sourceFile: 'database.ts',
        oldName: 'Database',
        newName: 'DB',
      }], 'Fixed'));
    });

    const mockOpenAI = { chat: { completions: { create: mockCreate } } } as any;
    const client = new ClaudeClient(mockOpenAI);

    const pipeline = new RetryPipeline(client, FIXTURES);
    const result = await pipeline.run('test prompt');

    expect(result.attempts).toBeGreaterThan(1);
  });

  it('fails gracefully after max retries', async () => {
    const mockCreate = vi.fn().mockResolvedValue(
      mockOpenAIResponse([{
        action: 'replace_node',
        sourceFile: 'database.ts',
        startLine: 1,
        endLine: 4,
        newCode: 'const broken: = invalid;',
      }], 'Always bad')
    );

    const mockOpenAI = { chat: { completions: { create: mockCreate } } } as any;
    const client = new ClaudeClient(mockOpenAI);

    const pipeline = new RetryPipeline(client, FIXTURES);
    const result = await pipeline.run('test prompt');

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(3);
    expect(result.sandboxPath).toBeNull();
  });
});
