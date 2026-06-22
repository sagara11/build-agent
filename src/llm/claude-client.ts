import Anthropic from '@anthropic-ai/sdk';
import { AstActionList } from './types.js';

const AST_DIFF_TOOL: Anthropic.Tool = {
  name: 'apply_ast_changes',
  description: 'Apply AST transformations to refactor code. Specify a list of actions to perform.',
  input_schema: {
    type: 'object' as const,
    properties: {
      reasoning: {
        type: 'string',
        description: 'Explanation of why these changes are suggested',
      },
      actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['extract_class', 'extract_method', 'replace_node', 'convert_async', 'rename_symbol'],
            },
            sourceFile: { type: 'string' },
            className: { type: 'string' },
            methodNames: { type: 'array', items: { type: 'string' } },
            newFileName: { type: 'string' },
            newClassName: { type: 'string' },
            methodName: { type: 'string' },
            startLine: { type: 'number' },
            endLine: { type: 'number' },
            newMethodName: { type: 'string' },
            newCode: { type: 'string' },
            oldName: { type: 'string' },
            newName: { type: 'string' },
          },
          required: ['action', 'sourceFile'],
        },
      },
    },
    required: ['actions', 'reasoning'],
  },
};

export class ClaudeClient {
  private client: Anthropic;

  constructor(client?: Anthropic) {
    this.client = client || new Anthropic();
  }

  async analyzeIssue(prompt: string): Promise<AstActionList> {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 4096,
      tools: [AST_DIFF_TOOL],
      tool_choice: { type: 'any' },
      messages: [{ role: 'user', content: prompt }],
    });

    const toolUseBlock = response.content.find(block => block.type === 'tool_use');
    if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
      throw new Error('Claude did not return a tool_use response');
    }

    const input = toolUseBlock.input as { actions: AstActionList['actions']; reasoning: string };
    return { actions: input.actions, reasoning: input.reasoning };
  }

  getToolSchema(): Anthropic.Tool {
    return AST_DIFF_TOOL;
  }
}
