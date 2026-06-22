import { ClaudeClient } from './claude-client.js';
import { AstApplier, ApplyResult } from './ast-applier.js';
import { AstActionList } from './types.js';
import { checkTypeScript, CheckResult } from '../checker/typescript-checker.js';

const MAX_RETRIES = 2;

export interface PipelineResult {
  success: boolean;
  sandboxPath: string | null;
  attempts: number;
  lastCheckResult: CheckResult | null;
  actionList: AstActionList | null;
}

export class RetryPipeline {
  constructor(
    private claudeClient: ClaudeClient,
    private projectPath: string,
  ) {}

  async run(prompt: string): Promise<PipelineResult> {
    let currentPrompt = prompt;
    let attempts = 0;
    let lastCheckResult: CheckResult | null = null;
    let lastActionList: AstActionList | null = null;

    while (attempts <= MAX_RETRIES) {
      attempts++;
      const applier = new AstApplier();

      try {
        const actionList = await this.claudeClient.analyzeIssue(currentPrompt);
        lastActionList = actionList;

        const applyResult = await applier.apply(this.projectPath, actionList);

        if (applyResult.errors.length > 0) {
          applier.cleanup();
          currentPrompt = this.buildRetryPrompt(prompt, applyResult.errors.join('\n'));
          continue;
        }

        const checkResult = checkTypeScript(applyResult.sandboxPath);
        lastCheckResult = checkResult;

        if (checkResult.compilable) {
          return {
            success: true,
            sandboxPath: applyResult.sandboxPath,
            attempts,
            lastCheckResult: checkResult,
            actionList,
          };
        }

        applier.cleanup();
        currentPrompt = this.buildRetryPrompt(prompt, this.formatErrors(checkResult));
      } catch (e) {
        applier.cleanup();
        if (attempts > MAX_RETRIES) break;
        currentPrompt = this.buildRetryPrompt(prompt, e instanceof Error ? e.message : String(e));
      }
    }

    return {
      success: false,
      sandboxPath: null,
      attempts,
      lastCheckResult,
      actionList: lastActionList,
    };
  }

  private buildRetryPrompt(originalPrompt: string, errors: string): string {
    return `${originalPrompt}\n\n## Compilation Failed\nThe previous attempt produced errors:\n\`\`\`\n${errors}\n\`\`\`\nPlease revise your AST changes to fix these compilation errors.`;
  }

  private formatErrors(checkResult: CheckResult): string {
    return checkResult.errors
      .map(e => `${e.file}:${e.line} - ${e.message}`)
      .join('\n');
  }
}
