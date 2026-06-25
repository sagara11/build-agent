import { SlicedContext } from '../slicer/context-slicer.js';
import { retrieveContext } from '../rag/retriever.js';
import { querySmellDocs, queryPatternDocs, disconnectMcp } from '../mcp/knowledge-client.js';
import { logStep, logDone } from '../pipeline/logger.js';

export async function buildPrompt(slicedContext: SlicedContext): Promise<string> {
  const { finding, sourceCode, dependencySignatures, metricsJson } = slicedContext;

  const knowledgeContext = await loadKnowledgeContext(finding.smellType, finding.message);

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

async function loadKnowledgeContext(smellType: string, message: string): Promise<string> {
  const query = `${smellType} ${message}`;

  if (process.env.DATABASE_URL) {
    logStep('Retrieving context via RAG (pgvector)');
    const ragContext = await retrieveContext(query);
    if (ragContext) {
      logDone('RAG context retrieved');
      return ragContext;
    }
  }

  logStep('Querying MCP knowledge server');
  try {
    const sections: string[] = [];
    const smellDocs = await querySmellDocs(mapSmellType(message));
    if (smellDocs) sections.push(smellDocs);

    const patternName = detectPatternFromMessage(message);
    if (patternName) {
      const patternDocs = await queryPatternDocs(patternName);
      if (patternDocs) sections.push(patternDocs);
    }

    await disconnectMcp();
    logDone('MCP context loaded');

    if (sections.length === 0) return '';
    return `\n## Reference Documentation\n${sections.join('\n\n---\n\n')}\n`;
  } catch {
    return '';
  }
}

function mapSmellType(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('god class')) return 'god-class';
  if (lower.includes('too long')) return 'long-method';
  if (lower.includes('complexity')) return 'high-complexity';
  if (lower.includes('duplicat')) return 'duplicated-code';
  return 'god-class';
}

function detectPatternFromMessage(message: string): string | null {
  const lower = message.toLowerCase();
  if (lower.includes('strategy')) return 'strategy';
  if (lower.includes('factory')) return 'factory';
  if (lower.includes('observer') || lower.includes('event bus')) return 'observer';
  if (lower.includes('builder')) return 'builder';
  if (lower.includes('facade')) return 'facade';
  if (lower.includes('god class')) return 'facade';
  if (lower.includes('too long')) return 'strategy';
  return null;
}
