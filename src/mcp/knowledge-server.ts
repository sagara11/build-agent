#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';

const KNOWLEDGE_DIR = path.resolve(import.meta.url.replace('file://', '').replace('/src/mcp/knowledge-server.ts', '').replace('/dist/mcp/knowledge-server.js', ''), 'knowledge-agent');

const server = new McpServer({
  name: 'refactor-knowledge',
  version: '1.0.0',
});

server.tool(
  'get_smell_docs',
  'Get documentation for a specific code smell type with detection rules, thresholds, and before/after examples',
  { smellType: z.string().describe('Code smell type: god-class, duplicated-code, long-method, high-complexity, feature-envy, data-clumps, primitive-obsession, shotgun-surgery, dead-code, magic-values') },
  async ({ smellType }) => {
    const content = loadFile('01-code-smells-rulebook.md');
    const section = extractSection(content, smellType);
    return { content: [{ type: 'text' as const, text: section || `No documentation found for smell: ${smellType}` }] };
  }
);

server.tool(
  'get_pattern_docs',
  'Get documentation for a design pattern with triggers, when NOT to use, and TypeScript before/after examples',
  { pattern: z.string().describe('Pattern name: strategy, factory, observer, repository, decorator, command, builder, singleton, facade, chain-of-responsibility') },
  async ({ pattern }) => {
    const content = loadFile('02-design-patterns-rulebook.md');
    const section = extractSection(content, pattern);
    return { content: [{ type: 'text' as const, text: section || `No documentation found for pattern: ${pattern}` }] };
  }
);

server.tool(
  'get_modernization_docs',
  'Get documentation for modernizing legacy code patterns with migration steps',
  { legacyType: z.string().describe('Legacy pattern: callback-hell, promise-chain, commonjs, var-usage, class-component, untyped-error, express-callbacks, flat-config, manual-type-assertions, console-log') },
  async ({ legacyType }) => {
    const content = loadFile('03-modernization-rulebook.md');
    const section = extractSection(content, legacyType);
    return { content: [{ type: 'text' as const, text: section || `No documentation found for: ${legacyType}` }] };
  }
);

server.tool(
  'get_trigger_matrix',
  'Get the full trigger-to-pattern mapping table for quick reference',
  {},
  async () => {
    const content = loadFile('02-design-patterns-rulebook.md');
    const lines = content.split('\n');
    const tableLines: string[] = [];
    let found = false;
    for (const line of lines) {
      if (line.includes('Dấu hiệu trong code') && line.includes('Pattern')) {
        found = true;
      }
      if (found && line.trim().startsWith('|')) {
        tableLines.push(line);
      } else if (found && tableLines.length > 0 && !line.trim().startsWith('|')) {
        break;
      }
    }
    return { content: [{ type: 'text' as const, text: tableLines.join('\n') || 'Trigger matrix not found' }] };
  }
);

server.tool(
  'get_severity_rules',
  'Get severity classification rules (ERROR/WARNING/INFO thresholds)',
  {},
  async () => {
    const content = loadFile('00-index.md');
    const lines = content.split('\n');
    const sections: string[] = [];
    let capture = false;
    for (const line of lines) {
      if (line.includes('Severity Rules') || line.includes('ERROR') && line.includes('phải fix')) {
        capture = true;
      }
      if (capture) {
        sections.push(line);
        if (sections.length > 60) break;
      }
    }
    return { content: [{ type: 'text' as const, text: sections.join('\n') || 'Severity rules not found' }] };
  }
);

function loadFile(filename: string): string {
  const filePath = path.join(KNOWLEDGE_DIR, filename);
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf-8');
}

function extractSection(content: string, keyword: string): string {
  const normalized = keyword.toLowerCase().replace(/[-_\s]/g, '');
  const lines = content.split('\n');
  let startIdx = -1;
  let endIdx = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## ') && line.toLowerCase().replace(/[-_\s]/g, '').includes(normalized)) {
      startIdx = i;
    } else if (startIdx >= 0 && line.startsWith('## ') && i > startIdx) {
      endIdx = i;
      break;
    }
  }

  if (startIdx < 0) return '';
  return lines.slice(startIdx, endIdx).join('\n');
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
