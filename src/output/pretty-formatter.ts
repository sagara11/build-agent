import chalk from 'chalk';
import { PipelineOutput } from '../pipeline/orchestrator.js';
import { Finding, Severity } from '../common/types.js';

export function formatPretty(output: PipelineOutput): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.bold('🔍 Analysis Results'));
  lines.push(chalk.dim('─'.repeat(60)));

  if (output.findings.length === 0) {
    lines.push(chalk.green('  ✓ No issues found'));
  } else {
    lines.push('');
    lines.push(chalk.bold('  Findings:'));
    lines.push('');

    for (const finding of output.findings) {
      lines.push(formatFinding(finding));
    }
  }

  if (output.diff) {
    lines.push('');
    lines.push(chalk.bold('📝 Suggested Changes (Diff)'));
    lines.push(chalk.dim('─'.repeat(60)));
    lines.push(formatDiff(output.diff));
  }

  lines.push('');
  lines.push(chalk.bold('📊 Summary'));
  lines.push(chalk.dim('─'.repeat(60)));
  lines.push(`  Files analyzed: ${output.stats.filesAnalyzed}`);
  lines.push(`  Total findings: ${output.stats.totalFindings}`);
  if (output.stats.critical > 0) lines.push(`  ${chalk.red(`Critical: ${output.stats.critical}`)}`);
  if (output.stats.high > 0) lines.push(`  ${chalk.yellow(`High: ${output.stats.high}`)}`);
  if (output.stats.medium > 0) lines.push(`  ${chalk.blue(`Medium: ${output.stats.medium}`)}`);
  lines.push(`  Processing time: ${output.processingMs}ms`);
  lines.push('');

  return lines.join('\n');
}

function formatFinding(finding: Finding): string {
  const badge = severityBadge(finding.severity);
  const location = chalk.dim(`${finding.file}:${finding.lineStart}`);
  return `  ${badge} ${location}\n    ${finding.message}`;
}

function severityBadge(severity: Severity): string {
  switch (severity) {
    case 'critical': return chalk.bgRed.white(' CRITICAL ');
    case 'high': return chalk.bgYellow.black(' HIGH ');
    case 'medium': return chalk.bgBlue.white(' MEDIUM ');
  }
}

function formatDiff(diff: string): string {
  return diff.split('\n').map(line => {
    if (line.startsWith('+') && !line.startsWith('+++')) return chalk.green(line);
    if (line.startsWith('-') && !line.startsWith('---')) return chalk.red(line);
    if (line.startsWith('@@')) return chalk.cyan(line);
    return line;
  }).join('\n');
}
