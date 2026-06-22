import { SlicedContext } from '../slicer/context-slicer.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

const KNOWLEDGE_DIR = path.resolve(import.meta.url.replace('file://', '').replace('/src/llm/prompt-builder.ts', ''), 'knowledge-agent');

function loadKnowledgeContext(): string {
  try {
    const files = ['01-code-smells-rulebook.md', '02-design-patterns-rulebook.md', '03-modernization-rulebook.md'];
    const sections: string[] = [];
    for (const file of files) {
      const filePath = path.join(KNOWLEDGE_DIR, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const triggerSection = extractTriggerTable(content);
        if (triggerSection) sections.push(triggerSection);
      }
    }
    return sections.length > 0 ? `\n## Reference Rules\n${sections.join('\n')}` : '';
  } catch {
    return '';
  }
}

function extractTriggerTable(content: string): string {
  const lines = content.split('\n');
  const tableLines: string[] = [];
  let inTable = false;
  for (const line of lines) {
    if (line.includes('Trigger') && line.includes('Pattern') && line.includes('|')) {
      inTable = true;
    }
    if (inTable) {
      if (line.trim().startsWith('|')) {
        tableLines.push(line);
      } else if (tableLines.length > 0) {
        break;
      }
    }
  }
  return tableLines.join('\n');
}

export function buildPrompt(slicedContext: SlicedContext): string {
  const { finding, sourceCode, dependencySignatures, metricsJson } = slicedContext;

  const knowledgeContext = loadKnowledgeContext();

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
