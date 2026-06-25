import pg from 'pg';
import pgvector from 'pgvector/pg';
import { DocChunk } from './chunker.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/refactor_agent',
    });
  }
  return pool;
}

export async function initVectorStore(): Promise<void> {
  const client = await getPool().connect();
  try {
    await pgvector.registerTypes(client);
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    await client.query(`
      CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        source TEXT NOT NULL,
        section TEXT NOT NULL,
        category TEXT NOT NULL,
        embedding vector(384)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
      ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 10)
    `);
  } finally {
    client.release();
  }
}

export async function upsertChunks(chunks: DocChunk[], embeddings: number[][]): Promise<void> {
  const client = await getPool().connect();
  try {
    await pgvector.registerTypes(client);
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = pgvector.toSql(embeddings[i]);
      await client.query(
        `INSERT INTO knowledge_chunks (id, text, source, section, category, embedding)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET text = $2, embedding = $6`,
        [chunk.id, chunk.text, chunk.metadata.source, chunk.metadata.section, chunk.metadata.category, embedding]
      );
    }
  } finally {
    client.release();
  }
}

export interface SearchResult {
  id: string;
  text: string;
  section: string;
  category: string;
  score: number;
}

export async function searchSimilar(queryEmbedding: number[], topK = 3): Promise<SearchResult[]> {
  const client = await getPool().connect();
  try {
    await pgvector.registerTypes(client);
    const embedding = pgvector.toSql(queryEmbedding);
    const result = await client.query(
      `SELECT id, text, section, category,
              1 - (embedding <=> $1) AS score
       FROM knowledge_chunks
       ORDER BY embedding <=> $1
       LIMIT $2`,
      [embedding, topK]
    );
    return result.rows.map(row => ({
      id: row.id,
      text: row.text,
      section: row.section,
      category: row.category,
      score: row.score,
    }));
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
