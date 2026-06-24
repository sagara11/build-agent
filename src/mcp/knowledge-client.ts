import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as path from 'node:path';

let clientInstance: Client | null = null;
let transportInstance: StdioClientTransport | null = null;

async function getClient(): Promise<Client> {
  if (clientInstance) return clientInstance;

  const serverPath = path.resolve(
    import.meta.url.replace('file://', '').replace('/src/mcp/knowledge-client.ts', '').replace('/dist/mcp/knowledge-client.js', ''),
    'dist/mcp/knowledge-server.js'
  );

  transportInstance = new StdioClientTransport({
    command: 'node',
    args: [serverPath],
  });

  clientInstance = new Client({ name: 'refactor-agent', version: '1.0.0' });
  await clientInstance.connect(transportInstance);
  return clientInstance;
}

export async function querySmellDocs(smellType: string): Promise<string> {
  try {
    const client = await getClient();
    const result = await client.callTool({ name: 'get_smell_docs', arguments: { smellType } });
    return extractText(result);
  } catch {
    return '';
  }
}

export async function queryPatternDocs(pattern: string): Promise<string> {
  try {
    const client = await getClient();
    const result = await client.callTool({ name: 'get_pattern_docs', arguments: { pattern } });
    return extractText(result);
  } catch {
    return '';
  }
}

export async function queryModernizationDocs(legacyType: string): Promise<string> {
  try {
    const client = await getClient();
    const result = await client.callTool({ name: 'get_modernization_docs', arguments: { legacyType } });
    return extractText(result);
  } catch {
    return '';
  }
}

export async function queryTriggerMatrix(): Promise<string> {
  try {
    const client = await getClient();
    const result = await client.callTool({ name: 'get_trigger_matrix', arguments: {} });
    return extractText(result);
  } catch {
    return '';
  }
}

export async function disconnectMcp(): Promise<void> {
  if (clientInstance) {
    await clientInstance.close();
    clientInstance = null;
  }
  if (transportInstance) {
    await transportInstance.close();
    transportInstance = null;
  }
}

function extractText(result: any): string {
  if (result?.content && Array.isArray(result.content)) {
    return result.content.map((c: any) => c.text || '').join('\n');
  }
  return '';
}
