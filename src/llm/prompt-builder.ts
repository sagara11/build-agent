import { SlicedContext } from '../slicer/context-slicer.js';
import { querySmellDocs, queryPatternDocs, queryTriggerMatrix, disconnectMcp } from '../mcp/knowledge-client.js';
import { logStep, logDone } from '../pipeline/logger.js';

export async function buildPrompt(slicedContext: SlicedContext): Promise<string> {
  const { finding, sourceCode, dependencySignatures, metricsJson } = slicedContext;

  logStep('Querying MCP knowledge server for relevant docs');
  const knowledgeContext = await loadMcpContext(finding.smellType, finding.message);
  logDone('Knowledge context loaded');

  return `## Issue Summary
Type: ${finding.smellType}
File: ${finding.file}
Severity: ${finding.severity}
${finding.message}

## Metrics
${metricsJson}

## Source Code
\`\`\`typescript
${sourceCode}
\`\`\`

## Dependency Type Signatures
\`\`\`typescript
${dependencySignatures}
\`\`\`
${knowledgeContext}
## Instructions
Analyze the code issue above and suggest AST transformations to fix it.
Use the apply_ast_changes tool to specify the exact changes needed.
Prefer extract_class for God Classes, extract_method for Long Methods, and replace_node for pattern replacements.
Keep changes minimal and focused on the specific issue.`;
}

async function loadMcpContext(smellType: string, message: string): Promise<string> {
  const sections: string[] = [];

  try {
    const smellDocs = await querySmellDocs(mapSmellType(smellType, message));
    if (smellDocs) sections.push(smellDocs);

    const patternName = detectPatternFromMessage(message);
    if (patternName) {
      const patternDocs = await queryPatternDocs(patternName);
      if (patternDocs) sections.push(patternDocs);
    }

    const triggerMatrix = await queryTriggerMatrix();
    if (triggerMatrix) sections.push(`\n### Pattern Trigger Matrix\n${triggerMatrix}`);

    await disconnectMcp();
  } catch {
    // MCP unavailable — continue without knowledge context
  }

  if (sections.length === 0) return '';
  return `\n## Reference Documentation (from Knowledge Base)\n${sections.join('\n\n---\n\n')}\n`;
}

function mapSmellType(smellType: string, message: string): string {
  if (message.toLowerCase().includes('god class')) return 'god-class';
  if (message.toLowerCase().includes('too long')) return 'long-method';
  if (message.toLowerCase().includes('complexity')) return 'high-complexity';
  if (message.toLowerCase().includes('duplicat')) return 'duplicated-code';
  return smellType;
}

function detectPatternFromMessage(message: string): string | null {
  const lower = message.toLowerCase();
  if (lower.includes('strategy')) return 'strategy';
  if (lower.includes('factory')) return 'factory';
  if (lower.includes('observer') || lower.includes('event bus')) return 'observer';
  if (lower.includes('builder')) return 'builder';
  if (lower.includes('facade')) return 'facade';
  if (lower.includes('decorator')) return 'decorator';
  if (lower.includes('command')) return 'command';
  if (lower.includes('chain of responsibility')) return 'chain-of-responsibility';

  if (lower.includes('god class')) return 'facade';
  if (lower.includes('too long')) return 'strategy';
  return null;
}
