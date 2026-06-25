#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import * as fs from 'node:fs';
import { runPipeline, MissingApiKeyError } from './pipeline/orchestrator.js';
import { formatJson } from './output/json-formatter.js';
import { formatPretty } from './output/pretty-formatter.js';
import { formatMarkdown } from './output/markdown-formatter.js';
import { DEFAULT_THRESHOLDS } from './common/types.js';

const program = new Command();

program
  .name('refactor-agent')
  .description('TypeScript/JS refactoring analysis tool')
  .version('1.0.0');

program
  .command('analyze')
  .description('Analyze a TypeScript/JS project for code smells and suggest refactoring')
  .argument('<path>', 'Path to the project directory')
  .option('--format <format>', 'Output format: json | pretty | md', 'pretty')
  .option('--dry-run', 'Detect only, skip Claude suggestions', false)
  .option('--output <file>', 'Write report to file (default: stdout)')
  .option('--threshold-loc <number>', 'God Class LOC threshold', parseInt)
  .option('--threshold-methods <number>', 'God Class methods threshold', parseInt)
  .option('--threshold-coupling <number>', 'God Class coupling threshold', parseInt)
  .action(async (targetPath: string, options) => {
    const thresholds = {
      ...DEFAULT_THRESHOLDS,
      ...(options.thresholdLoc && { godClassLoc: options.thresholdLoc }),
      ...(options.thresholdMethods && { godClassMethods: options.thresholdMethods }),
      ...(options.thresholdCoupling && { godClassCoupling: options.thresholdCoupling }),
    };

    try {
      const output = await runPipeline(targetPath, {
        format: options.format,
        dryRun: options.dryRun,
        thresholds,
      });

      let result: string;
      if (options.format === 'json') {
        result = formatJson(output);
      } else if (options.format === 'md') {
        result = formatMarkdown(output);
      } else {
        result = formatPretty(output);
      }

      if (options.output) {
        fs.writeFileSync(options.output, result, 'utf-8');
        process.stderr.write(`Report written to ${options.output}\n`);
      } else {
        process.stdout.write(result + '\n');
      }

      const hasCritical = output.stats.critical > 0 || output.stats.high > 0;
      process.exitCode = hasCritical ? 1 : 0;
    } catch (e) {
      if (e instanceof MissingApiKeyError) {
        process.stderr.write(`\nError: ${e.message}\n\n`);
        process.exitCode = 2;
      } else {
        process.stderr.write(`\nError: ${e instanceof Error ? e.message : String(e)}\n`);
        process.exitCode = 1;
      }
    }
  });

program
  .command('index-knowledge')
  .description('Index knowledge-agent docs into pgvector for RAG retrieval')
  .action(async () => {
    try {
      const { indexKnowledge } = await import('./rag/retriever.js');
      const count = await indexKnowledge();
      process.stderr.write(`\n✅ Indexed ${count} chunks into pgvector\n`);
    } catch (e) {
      process.stderr.write(`\nError: ${e instanceof Error ? e.message : String(e)}\n`);
      process.stderr.write('Make sure DATABASE_URL is set and PostgreSQL with pgvector extension is running.\n');
      process.exitCode = 1;
    }
  });

program.parse();
