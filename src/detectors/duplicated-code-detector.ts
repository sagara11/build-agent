import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { Finding, Severity } from '../common/types.js';
import { Detector, DetectorContext } from './base-detector.js';

interface JscpdClone {
  firstFile: { name: string; start: number; end: number };
  secondFile: { name: string; start: number; end: number };
  lines: number;
  tokens: number;
}

export class DuplicatedCodeDetector implements Detector {
  constructor(private projectPath: string) {}

  detect(_context: DetectorContext): Finding[] {
    return this.runJscpd();
  }

  private runJscpd(): Finding[] {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jscpd-'));

    try {
      const jscpdBin = path.resolve('node_modules/.bin/jscpd');

      execFileSync(jscpdBin, [
        this.projectPath,
        '--min-lines', '5',
        '--format', 'typescript,javascript',
        '--ignore', '**/node_modules/**,**/dist/**,**/*.test.*,**/*.spec.*',
        '--reporters', 'json',
        '--output', tmpDir,
      ], { encoding: 'utf-8', stdio: 'pipe' });
    } catch {
      // jscpd exits non-zero when duplicates found, that's expected
    }

    const reportPath = path.join(tmpDir, 'jscpd-report.json');
    if (!fs.existsSync(reportPath)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      return [];
    }

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    fs.rmSync(tmpDir, { recursive: true, force: true });

    const clones: JscpdClone[] = report.duplicates || [];
    return this.clonesToFindings(clones);
  }

  private clonesToFindings(clones: JscpdClone[]): Finding[] {
    const findings: Finding[] = [];

    for (const clone of clones) {
      const severity = this.calculateSeverity(clone.lines);

      findings.push({
        smellType: 'duplicated-code',
        file: clone.firstFile.name,
        lineStart: clone.firstFile.start,
        lineEnd: clone.firstFile.end,
        severity,
        confidence: 1,
        metrics: { lines: clone.lines, tokens: clone.tokens },
        message: `Duplicated code block (${clone.lines} lines) found in ${clone.firstFile.name} and ${clone.secondFile.name}`,
      });
    }

    return findings;
  }

  private calculateSeverity(lines: number): Severity {
    if (lines > 50) return 'critical';
    if (lines > 20) return 'high';
    return 'medium';
  }
}
