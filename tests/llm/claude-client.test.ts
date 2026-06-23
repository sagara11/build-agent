import { describe, it, expect, vi } from 'vitest';
import { ClaudeClient } from '../../src/llm/claude-client.js';

describe('ClaudeClient', () => {
  it('sends correct request params to OpenRouter', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{
        message: {
          tool_calls: [{
            id: 'call-1',
            type: 'function',
            function: {
              name: 'apply_ast_changes',
              arguments: JSON.stringify({
                reasoning: 'Extract notification methods to separate service',
                actions: [{
                  action: 'extract_class',
                  sourceFile: 'UserService.ts',
                  className: 'UserService',
                  methodNames: ['sendNotification', 'bulkNotify'],
                  newFileName: 'NotificationService.ts',
                  newClassName: 'NotificationService',
                }],
              }),
            },
          }],
        },
      }],
    });

    const mockOpenAI = { chat: { completions: { create: mockCreate } } } as any;
    const client = new ClaudeClient(mockOpenAI);

    const result = await client.analyzeIssue('test prompt');

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        max_tokens: 4096,
        tool_choice: { type: 'function', function: { name: 'apply_ast_changes' } },
        tools: expect.arrayContaining([
          expect.objectContaining({ type: 'function' }),
        ]),
        messages: [{ role: 'user', content: 'test prompt' }],
      })
    );

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].action).toBe('extract_class');
    expect(result.reasoning).toContain('notification');
  });

  it('throws when no tool call in response', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: 'Sorry' } }],
    });

    const mockOpenAI = { chat: { completions: { create: mockCreate } } } as any;
    const client = new ClaudeClient(mockOpenAI);

    await expect(client.analyzeIssue('test')).rejects.toThrow('tool_use');
  });

  it('exposes tool schema', () => {
    const mockOpenAI = { chat: { completions: { create: vi.fn() } } } as any;
    const client = new ClaudeClient(mockOpenAI);
    const schema = client.getToolSchema();

    expect(schema.function.name).toBe('apply_ast_changes');
    expect(schema.function.parameters).toBeDefined();
  });
});
