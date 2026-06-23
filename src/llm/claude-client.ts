import OpenAI from 'openai';
import { AstActionList } from './types.js';

const AST_DIFF_TOOL: OpenAI.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'apply_ast_changes',
    description: 'Apply AST transformations to refactor code. Specify a list of actions to perform.',
    parameters: {
      type: 'object',
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
  },
};

export interface LlmClientOptions {
  apiKey?: string;
  baseURL?: string;
  model?: string;
}

export class ClaudeClient {
  private client: OpenAI;
  private model: string;

  constructor(options?: LlmClientOptions | any) {
    if (options && 'chat' in options) {
      this.client = options;
      this.model = 'anthropic/claude-sonnet-4-5';
      return;
    }

    const opts = options as LlmClientOptions | undefined;
    const apiKey = opts?.apiKey || process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY;
    const baseURL = opts?.baseURL || process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    this.model = opts?.model || process.env.LLM_MODEL || 'anthropic/claude-sonnet-4-5';

    if (!apiKey) {
      throw new Error('No API key found. Set OPENROUTER_API_KEY env variable.');
    }

    this.client = new OpenAI({ apiKey, baseURL });
  }

  async analyzeIssue(prompt: string): Promise<AstActionList> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 4096,
      tools: [AST_DIFF_TOOL],
      tool_choice: { type: 'function', function: { name: 'apply_ast_changes' } },
      messages: [{ role: 'user', content: prompt }],
    });

    const message = response.choices[0]?.message;
    const toolCall = message?.tool_calls?.[0];

    if (!toolCall || toolCall.type !== 'function') {
      throw new Error('LLM did not return a tool_use response');
    }

    const input = JSON.parse(toolCall.function.arguments) as { actions: AstActionList['actions']; reasoning: string };
    return { actions: input.actions, reasoning: input.reasoning };
  }

  getToolSchema(): OpenAI.ChatCompletionTool {
    return AST_DIFF_TOOL;
  }
}
