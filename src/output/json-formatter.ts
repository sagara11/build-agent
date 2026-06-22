import { PipelineOutput } from '../pipeline/orchestrator.js';

export function formatJson(output: PipelineOutput): string {
  const serializable = {
    findings: output.findings.map(f => ({
      smellType: f.smellType,
      file: f.file,
      lineStart: f.lineStart,
      lineEnd: f.lineEnd,
      severity: f.severity,
      confidence: f.confidence,
      metrics: f.metrics,
      message: f.message,
      responsibilityGroups: f.responsibilityGroups,
    })),
    diff: output.diff,
    stats: output.stats,
    processingMs: output.processingMs,
  };
  return JSON.stringify(serializable, null, 2);
}
