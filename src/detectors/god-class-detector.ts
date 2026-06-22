import { Finding, Severity, ClassMetrics, ClassSymbol, ResponsibilityGroup } from '../common/types.js';
import { Detector, DetectorContext } from './base-detector.js';

export class GodClassDetector implements Detector {
  detect(context: DetectorContext): Finding[] {
    const findings: Finding[] = [];

    for (const fileMetrics of context.fileMetrics) {
      for (const classMetrics of fileMetrics.classes) {
        const classSymbol = context.symbolTable.classes.find(
          c => c.name === classMetrics.name && c.filePath.endsWith(fileMetrics.filePath)
        );

        if (!this.isGodClass(classMetrics, context)) continue;

        const severity = this.calculateSeverity(classMetrics, context);
        const confidence = this.calculateConfidence(classMetrics, context);
        const responsibilityGroups = classSymbol
          ? this.groupByResponsibility(classSymbol)
          : [];

        findings.push({
          smellType: 'god-class',
          file: fileMetrics.filePath,
          lineStart: 1,
          lineEnd: classMetrics.loc,
          severity,
          confidence,
          metrics: {
            loc: classMetrics.loc,
            methodCount: classMetrics.methodCount,
            coupling: classMetrics.coupling,
            avgComplexity: classMetrics.avgComplexity,
          },
          message: `Class "${classMetrics.name}" is a God Class: ${classMetrics.loc} LOC, ${classMetrics.methodCount} methods, coupling ${classMetrics.coupling}`,
          responsibilityGroups,
        });
      }
    }

    return findings;
  }

  private isGodClass(metrics: ClassMetrics, context: DetectorContext): boolean {
    const { thresholds } = context;
    return (
      metrics.loc > thresholds.godClassLoc &&
      metrics.methodCount > thresholds.godClassMethods &&
      metrics.coupling > thresholds.godClassCoupling
    );
  }

  private calculateSeverity(metrics: ClassMetrics, context: DetectorContext): Severity {
    const { thresholds } = context;
    const locRatio = metrics.loc / thresholds.godClassLoc;
    const methodRatio = metrics.methodCount / thresholds.godClassMethods;

    if (locRatio > 3 || methodRatio > 3) return 'critical';
    if (locRatio > 2 || methodRatio > 2) return 'high';
    return 'medium';
  }

  private calculateConfidence(metrics: ClassMetrics, context: DetectorContext): number {
    let score = 0;
    const { thresholds } = context;

    if (metrics.loc > thresholds.godClassLoc) score += 0.33;
    if (metrics.methodCount > thresholds.godClassMethods) score += 0.33;
    if (metrics.coupling > thresholds.godClassCoupling) score += 0.34;

    return Math.min(score, 1);
  }

  private groupByResponsibility(classSymbol: ClassSymbol): ResponsibilityGroup[] {
    if (classSymbol.constructorDeps.length === 0) {
      return [{ name: 'general', methods: classSymbol.methods.map(m => m.name) }];
    }

    const groups = new Map<string, string[]>();
    for (const dep of classSymbol.constructorDeps) {
      groups.set(dep, []);
    }

    const depPatterns = new Map<string, string[]>();
    for (const dep of classSymbol.constructorDeps) {
      depPatterns.set(dep, this.getSemanticPatterns(dep));
    }

    for (const method of classSymbol.methods) {
      const methodLower = method.name.toLowerCase();
      let assigned = false;

      for (const [dep, patterns] of depPatterns) {
        if (patterns.some(p => methodLower.includes(p))) {
          groups.get(dep)!.push(method.name);
          assigned = true;
          break;
        }
      }

      if (!assigned) {
        const smallest = [...groups.entries()].sort((a, b) => a[1].length - b[1].length)[0];
        smallest[1].push(method.name);
      }
    }

    const result: ResponsibilityGroup[] = [];
    for (const [dep, methods] of groups) {
      if (methods.length > 0) {
        result.push({ name: dep, methods });
      }
    }
    return result;
  }

  private getSemanticPatterns(typeName: string): string[] {
    const lower = typeName.toLowerCase();

    if (lower.includes('email') || lower.includes('mail') || lower.includes('notification')) {
      return ['send', 'notify', 'mail', 'email', 'bulk'];
    }
    if (lower.includes('cache')) {
      return ['cache', 'invalidat'];
    }
    if (lower.includes('log')) {
      return ['log', 'warn', 'debug', 'trace'];
    }
    if (lower.includes('database') || lower.includes('db') || lower.includes('repo')) {
      return ['create', 'get', 'update', 'delete', 'find', 'list', 'search', 'query'];
    }

    const cleaned = typeName.replace(/Service|Interface|Impl/g, '');
    return cleaned.length >= 3 ? [cleaned.toLowerCase()] : [];
  }
}
