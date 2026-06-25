import { pipeline } from '@xenova/transformers';

let embedPipeline: any = null;

async function getEmbedder(): Promise<any> {
  if (!embedPipeline) {
    embedPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return embedPipeline;
}

export async function embedText(text: string): Promise<number[]> {
  const embedder = await getEmbedder();
  const result = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(result.data as Float32Array);
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const embedder = await getEmbedder();
  const results: number[][] = [];
  for (const text of texts) {
    const result = await embedder(text, { pooling: 'mean', normalize: true });
    results.push(Array.from(result.data as Float32Array));
  }
  return results;
}
