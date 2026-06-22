import { Finding, Severity } from '../common/types.js';
import { Detector, DetectorContext } from './base-detector.js';

export class HighComplexityDetector implements Detector {
  detect(context: DetectorContext): Finding[] {
    const findings: Finding[] = [];

    for (const fileMetrics of context.fileMetrics) {
      for (const classMetrics of fileMetrics.classes) {
        for (const method of classMetrics.methods) {
          if (method.cyclomaticComplexity > context.thresholds.highComplexity) {
            const severity = this.calculateSeverity(method.cyclomaticComplexity, context.thresholds.highComplexity);
            findings.push({
              smellType: 'high-complexity',
              file: fileMetrics.filePath,
              lineStart: 1,
              lineEnd: method.loc,
              severity,
              confidence: 1,
              metrics: {
                cyclomaticComplexity: method.cyclomaticComplexity,
                threshold: context.thresholds.highComplexity,
              },
              message: `Method "${method.name}" in class "${classMetrics.name}" has high complexity: ${method.cyclomaticComplexity} (threshold: ${context.thresholds.highComplexity})`,
            });
          }
        }
      }
    }

    return findings;
  }

  private calculateSeverity(complexity: number, threshold: number): Severity {
    const ratio = complexity / threshold;
    if (ratio > 3) return 'critical';
    if (ratio > 2) return 'high';
    return 'medium';
  }
}
