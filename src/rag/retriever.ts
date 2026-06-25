import * as path from 'node:path';
import { chunkKnowledgeDocs } from './chunker.js';
import { embedText, embedTexts } from './embedder.js';
import { initVectorStore, upsertChunks, searchSimilar, closePool, SearchResult } from './vector-store.js';
import { logStep, logDone } from '../pipeline/logger.js';

const KNOWLEDGE_DIR = path.resolve(
  import.meta.url.replace('file://', '').replace('/src/rag/retriever.ts', '').replace('/dist/rag/retriever.js', ''),
  'knowledge-agent'
);

export async function indexKnowledge(): Promise<number> {
  logStep('Initializing vector store');
  await initVectorStore();

  logStep('Chunking knowledge docs');
  const chunks = chunkKnowledgeDocs(KNOWLEDGE_DIR);
  logDone('Chunked', `${chunks.length} chunks`);

  logStep('Generating embeddings (local model)');
  const texts = chunks.map(c => `${c.metadata.section}: ${c.text.slice(0, 500)}`);
  const embeddings = await embedTexts(texts);
  logDone('Embeddings generated');

  logStep('Storing in pgvector');
  await upsertChunks(chunks, embeddings);
  logDone('Indexed', `${chunks.length} chunks stored`);

  await closePool();
  return chunks.length;
}

export async function retrieveContext(query: string, topK = 3): Promise<string> {
  try {
    await initVectorStore();
    const queryEmbedding = await embedText(query);
    const results = await searchSimilar(queryEmbedding, topK);
    await closePool();

    if (results.length === 0) return '';

    return formatResults(results);
  } catch {
    return '';
  }
}

function formatResults(results: SearchResult[]): string {
  const sections = results
    .filter(r => r.score > 0.3)
    .map(r => `### ${r.section} (${r.category}, relevance: ${(r.score * 100).toFixed(0)}%)\n${truncate(r.text, 800)}`);

  if (sections.length === 0) return '';
  return `\n## Retrieved Knowledge (RAG)\n${sections.join('\n\n---\n\n')}\n`;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '\n[...truncated]';
}
