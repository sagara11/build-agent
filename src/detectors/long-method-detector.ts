import { Finding, Severity } from '../common/types.js';
import { Detector, DetectorContext } from './base-detector.js';

export class LongMethodDetector implements Detector {
  detect(context: DetectorContext): Finding[] {
    const findings: Finding[] = [];

    for (const fileMetrics of context.fileMetrics) {
      for (const classMetrics of fileMetrics.classes) {
        for (const method of classMetrics.methods) {
          if (method.loc > context.thresholds.longMethodLoc) {
            const severity = this.calculateSeverity(method.loc, context.thresholds.longMethodLoc);
            findings.push({
              smellType: 'long-method',
              file: fileMetrics.filePath,
              lineStart: 1,
              lineEnd: method.loc,
              severity,
              confidence: 1,
              metrics: { loc: method.loc, threshold: context.thresholds.longMethodLoc },
              message: `Method "${method.name}" in class "${classMetrics.name}" is too long: ${method.loc} LOC (threshold: ${context.thresholds.longMethodLoc})`,
            });
          }
        }
      }
    }

    return findings;
  }

  private calculateSeverity(loc: number, threshold: number): Severity {
    const ratio = loc / threshold;
    if (ratio > 4) return 'critical';
    if (ratio > 2) return 'high';
    return 'medium';
  }
}
