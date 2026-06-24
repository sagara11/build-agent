import { Project } from 'ts-morph';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { indexProject } from '../indexer/project-indexer.js';
import { buildSymbolTable } from '../analyzers/symbol-table-builder.js';
import { buildDependencyGraph } from '../analyzers/dependency-graph-builder.js';
import { calculateFileMetrics } from '../analyzers/metrics-calculator.js';
import { GodClassDetector } from '../detectors/god-class-detector.js';
import { LongMethodDetector } from '../detectors/long-method-detector.js';
import { HighComplexityDetector } from '../detectors/high-complexity-detector.js';
import { DuplicatedCodeDetector } from '../detectors/duplicated-code-detector.js';
import { detectIfElseChains } from '../detectors/if-else-chain-detector.js';
import { detectManualFactory } from '../detectors/manual-factory-detector.js';
import { detectModernizationIssues } from '../detectors/modernization-detector.js';
import { detectDesignPatternOpportunities } from '../detectors/design-pattern-detector.js';
import { sliceContext } from '../slicer/context-slicer.js';
import { buildPrompt } from '../llm/prompt-builder.js';
import { ClaudeClient } from '../llm/claude-client.js';
import { RetryPipeline } from '../llm/retry-pipeline.js';
import { generateDiff, formatUnifiedDiff, FileDiff } from '../diff/diff-generator.js';
import { DetectorContext } from '../detectors/base-detector.js';
import { logStep, logDone, logHeader, logInfo, setLogEnabled } from './logger.js';
import {
  Finding,
  FileMetrics,
  SymbolTable,
  DependencyGraph,
  DetectorThresholds,
  DEFAULT_THRESHOLDS,
} from '../common/types.js';

export interface PipelineOptions {
  format: 'json' | 'pretty';
  dryRun: boolean;
  thresholds: DetectorThresholds;
}

export interface PipelineOutput {
  findings: Finding[];
  diff?: string;
  diffs?: FileDiff[];
  stats: {
    filesAnalyzed: number;
    totalFindings: number;
    critical: number;
    high: number;
    medium: number;
  };
  processingMs: number;
}

export async function runPipeline(targetPath: string, options: PipelineOptions): Promise<PipelineOutput> {
  const startTime = Date.now();
  const resolvedPath = path.resolve(targetPath);

  setLogEnabled(options.format !== 'json');

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Path does not exist: ${resolvedPath}`);
  }

  const stat = fs.statSync(resolvedPath);
  if (stat.isFile()) {
    return runSingleFilePipeline(resolvedPath, options, startTime);
  }

  return runDirectoryPipeline(resolvedPath, options, startTime);
}

async function runSingleFilePipeline(filePath: string, options: PipelineOptions, startTime: number): Promise<PipelineOutput> {
  const ext = path.extname(filePath);
  if (!['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    throw new Error(`Unsupported file type: ${ext}. Supported: .ts, .tsx, .js, .jsx`);
  }

  logHeader('🔍 Refactor Agent — Single File Analysis');
  logInfo(`Target: ${filePath}`);
  logInfo(`Mode: ${options.dryRun ? 'dry-run (no LLM)' : 'full (with LLM)'}`);

  logStep('Parsing file');
  const dir = path.dirname(filePath);
  const tsconfigPath = findTsconfigUp(dir);

  let project: Project;
  if (tsconfigPath) {
    project = new Project({ tsConfigFilePath: tsconfigPath });
    if (!project.getSourceFile(filePath)) {
      project.addSourceFileAtPath(filePath);
    }
  } else {
    project = new Project({ compilerOptions: { strict: true } });
    project.addSourceFileAtPath(filePath);
  }
  logDone('Parsed', tsconfigPath ? 'with tsconfig' : 'standalone');

  logStep('Building symbol table & metrics');
  const sourceFiles = project.getSourceFiles();
  const targetSourceFile = project.getSourceFileOrThrow(filePath);
  const symbolTable = buildSymbolTable([targetSourceFile]);
  const dependencyGraph = buildDependencyGraph(sourceFiles);
  const fileMetrics = [calculateFileMetrics(targetSourceFile, dependencyGraph)];
  logDone('Symbol table & metrics built');

  logStep('Running detectors');
  const context: DetectorContext = {
    symbolTable,
    dependencyGraph,
    fileMetrics,
    thresholds: options.thresholds,
  };

  const findings: Finding[] = [
    ...new GodClassDetector().detect(context),
    ...new LongMethodDetector().detect(context),
    ...new HighComplexityDetector().detect(context),
    ...detectIfElseChains([targetSourceFile]),
    ...detectDesignPatternOpportunities([targetSourceFile]),
    ...detectModernizationIssues([targetSourceFile]),
  ];
  logDone('Detection complete', `${findings.length} findings`);

  let diff: string | undefined;
  let diffs: FileDiff[] | undefined;

  if (!options.dryRun && findings.length > 0) {
    if (!process.env.OPENROUTER_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      throw new MissingApiKeyError();
    }

    logStep('Sending to LLM for refactoring suggestions');
    const projectDir = tsconfigPath ? path.dirname(tsconfigPath) : dir;
    const topFinding = findings.sort((a, b) => severityOrder(b.severity) - severityOrder(a.severity))[0];
    const sliced = sliceContext(topFinding, [targetSourceFile], symbolTable, dependencyGraph, fileMetrics);
    const prompt = await buildPrompt(sliced);

    const client = new ClaudeClient();
    const pipeline = new RetryPipeline(client, projectDir);
    const result = await pipeline.run(prompt);
    logDone('LLM response received', `${result.attempts} attempt(s)`);

    if (result.success && result.sandboxPath) {
      logStep('Generating diff');
      diffs = generateDiff(projectDir, result.sandboxPath);
      diff = formatUnifiedDiff(diffs);
      fs.rmSync(result.sandboxPath, { recursive: true, force: true });
      logDone('Diff generated', `${diffs.length} file(s) changed`);
    }
  }

  const processingMs = Date.now() - startTime;

  return {
    findings,
    diff,
    diffs,
    stats: {
      filesAnalyzed: 1,
      totalFindings: findings.length,
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
    },
    processingMs,
  };
}

function findTsconfigUp(dir: string): string | null {
  let current = dir;
  while (true) {
    const candidate = path.join(current, 'tsconfig.json');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

async function runDirectoryPipeline(resolvedPath: string, options: PipelineOptions, startTime: number): Promise<PipelineOutput> {
  logHeader('🔍 Refactor Agent — Directory Analysis');
  logInfo(`Target: ${resolvedPath}`);
  logInfo(`Mode: ${options.dryRun ? 'dry-run (no LLM)' : 'full (with LLM)'}`);

  logStep('Indexing project files');
  const indexResult = await indexProject(resolvedPath);
  if (indexResult.files.length === 0) {
    logDone('No source files found');
    return emptyOutput(startTime);
  }
  logDone('Indexed', `${indexResult.files.length} files`);

  logStep('Parsing AST');
  const tsconfigPath = path.join(resolvedPath, 'tsconfig.json');
  let project: Project;
  if (fs.existsSync(tsconfigPath)) {
    project = new Project({ tsConfigFilePath: tsconfigPath });
  } else {
    project = new Project({ compilerOptions: { strict: true } });
    for (const f of indexResult.files) {
      if (f.parser === 'ts-morph' && f.sourceFile) continue;
      project.addSourceFileAtPath(path.join(resolvedPath, f.filePath));
    }
  }
  logDone('AST parsed');

  logStep('Building symbol table & dependency graph');
  const sourceFiles = project.getSourceFiles();
  const symbolTable = buildSymbolTable(sourceFiles);
  const dependencyGraph = buildDependencyGraph(sourceFiles);
  const fileMetrics = sourceFiles.map(sf => calculateFileMetrics(sf, dependencyGraph));
  logDone('Analysis complete');

  logStep('Running detectors (smells, patterns, modernization)');
  const context: DetectorContext = {
    symbolTable,
    dependencyGraph,
    fileMetrics,
    thresholds: options.thresholds,
  };

  const findings: Finding[] = [
    ...new GodClassDetector().detect(context),
    ...new LongMethodDetector().detect(context),
    ...new HighComplexityDetector().detect(context),
    ...new DuplicatedCodeDetector(resolvedPath).detect(context),
    ...detectIfElseChains(sourceFiles),
    ...detectManualFactory(sourceFiles),
    ...detectDesignPatternOpportunities(sourceFiles),
    ...detectModernizationIssues(sourceFiles),
  ];
  logDone('Detection complete', `${findings.length} findings`);

  let diff: string | undefined;
  let diffs: FileDiff[] | undefined;

  if (!options.dryRun && findings.length > 0) {
    if (!process.env.OPENROUTER_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      throw new MissingApiKeyError();
    }

    logStep('Sending top finding to LLM for refactoring suggestions');
    const topFinding = findings.sort((a, b) => severityOrder(b.severity) - severityOrder(a.severity))[0];
    const sliced = sliceContext(topFinding, sourceFiles, symbolTable, dependencyGraph, fileMetrics);
    const prompt = await buildPrompt(sliced);

    const client = new ClaudeClient();
    const pipeline = new RetryPipeline(client, resolvedPath);
    const result = await pipeline.run(prompt);
    logDone('LLM response received', `${result.attempts} attempt(s)`);

    if (result.success && result.sandboxPath) {
      logStep('Generating diff');
      diffs = generateDiff(resolvedPath, result.sandboxPath);
      diff = formatUnifiedDiff(diffs);
      fs.rmSync(result.sandboxPath, { recursive: true, force: true });
      logDone('Diff generated', `${diffs.length} file(s) changed`);
    }
  }

  const processingMs = Date.now() - startTime;

  return {
    findings,
    diff,
    diffs,
    stats: {
      filesAnalyzed: indexResult.files.length,
      totalFindings: findings.length,
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
    },
    processingMs,
  };
}

function emptyOutput(startTime: number): PipelineOutput {
  return {
    findings: [],
    stats: { filesAnalyzed: 0, totalFindings: 0, critical: 0, high: 0, medium: 0 },
    processingMs: Date.now() - startTime,
  };
}

function severityOrder(severity: string): number {
  switch (severity) {
    case 'critical': return 3;
    case 'high': return 2;
    case 'medium': return 1;
    default: return 0;
  }
}

export class MissingApiKeyError extends Error {
  constructor() {
    super('OPENROUTER_API_KEY not set. Set it in .env file or env variable. Use --dry-run for free analysis without LLM.');
    this.name = 'MissingApiKeyError';
  }
}
