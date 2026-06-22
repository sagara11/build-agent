import { describe, it, expect, vi } from 'vitest';
import { ClaudeClient } from '../../src/llm/claude-client.js';

describe('ClaudeClient', () => {
  it('sends correct request params to SDK', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          id: 'test-id',
          name: 'apply_ast_changes',
          input: {
            reasoning: 'Extract notification methods to separate service',
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
          },
        },
      ],
    });

    const mockClient = { messages: { create: mockCreate } } as any;
    const client = new ClaudeClient(mockClient);

    const result = await client.analyzeIssue('test prompt');

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 4096,
        tool_choice: { type: 'any' },
        tools: expect.arrayContaining([
          expect.objectContaining({ name: 'apply_ast_changes' }),
        ]),
        messages: [{ role: 'user', content: 'test prompt' }],
      })
    );

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].action).toBe('extract_class');
    expect(result.reasoning).toContain('notification');
  });

  it('throws when no tool_use in response', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Sorry, I cannot help.' }],
    });

    const mockClient = { messages: { create: mockCreate } } as any;
    const client = new ClaudeClient(mockClient);

    await expect(client.analyzeIssue('test')).rejects.toThrow('tool_use');
  });

  it('exposes tool schema', () => {
    const mockClient = { messages: { create: vi.fn() } } as any;
    const client = new ClaudeClient(mockClient);
    const schema = client.getToolSchema();

    expect(schema.name).toBe('apply_ast_changes');
    expect(schema.input_schema).toBeDefined();
  });
});
