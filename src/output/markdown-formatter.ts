import { PipelineOutput } from '../pipeline/orchestrator.js';
import { Finding } from '../common/types.js';

type Category = 'code-smell' | 'design-pattern' | 'modernization';

interface CategorizedFinding {
  finding: Finding;
  category: Category;
  suggestion?: string;
}

export function formatMarkdown(output: PipelineOutput): string {
  const lines: string[] = [];

  lines.push('# Code Analysis Report');
  lines.push('');
  lines.push(`> Generated: ${new Date().toISOString()}  `);
  lines.push(`> Processing time: ${output.processingMs}ms`);
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Files analyzed | ${output.stats.filesAnalyzed} |`);
  lines.push(`| Total findings | ${output.stats.totalFindings} |`);
  lines.push(`| 🔴 Critical | ${output.stats.critical} |`);
  lines.push(`| 🟡 High | ${output.stats.high} |`);
  lines.push(`| 🔵 Medium | ${output.stats.medium} |`);
  lines.push('');

  if (output.findings.length === 0) {
    lines.push('## ✅ No issues found');
    lines.push('');
    lines.push('Code looks clean!');
    lines.push('');
    return lines.join('\n');
  }

  const categorized = output.findings.map(classify);

  const smells = categorized.filter(c => c.category === 'code-smell');
  const patterns = categorized.filter(c => c.category === 'design-pattern');
  const modernizations = categorized.filter(c => c.category === 'modernization');

  lines.push('## Overview');
  lines.push('');
  lines.push('| Category | Count |');
  lines.push('|----------|-------|');
  lines.push(`| 🐛 Code Smells | ${smells.length} |`);
  lines.push(`| 💡 Design Pattern Suggestions | ${patterns.length} |`);
  lines.push(`| 🔄 Modernization | ${modernizations.length} |`);
  lines.push('');

  if (smells.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## 🐛 Part 1: Code Smells');
    lines.push('');
    lines.push('| # | Severity | Type | File | Line | Message |');
    lines.push('|---|----------|------|------|------|---------|');
    smells.forEach((c, i) => {
      lines.push(formatTableRow(i + 1, c.finding));
    });
    lines.push('');
    smells.forEach((c, i) => {
      lines.push(formatDetail(i + 1, c.finding));
    });
  }

  if (patterns.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## 💡 Part 2: Design Pattern Suggestions');
    lines.push('');
    lines.push('| # | Severity | Pattern | File | Line | Message |');
    lines.push('|---|----------|---------|------|------|---------|');
    patterns.forEach((c, i) => {
      const pattern = c.suggestion || 'N/A';
      lines.push(`| ${i + 1} | ${severityIcon(c.finding.severity)} | **${pattern}** | \`${shortenPath(c.finding.file)}\` | ${c.finding.lineStart} | ${c.finding.message} |`);
    });
    lines.push('');
    patterns.forEach((c, i) => {
      lines.push(formatPatternDetail(i + 1, c));
    });
  }

  if (modernizations.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## 🔄 Part 3: Modernization');
    lines.push('');
    lines.push('| # | Severity | Issue | File | Line | Alternative |');
    lines.push('|---|----------|-------|------|------|-------------|');
    modernizations.forEach((c, i) => {
      const alt = c.suggestion || '';
      lines.push(`| ${i + 1} | ${severityIcon(c.finding.severity)} | ${c.finding.message} | \`${shortenPath(c.finding.file)}\` | ${c.finding.lineStart} | ${alt} |`);
    });
    lines.push('');
    modernizations.forEach((c, i) => {
      lines.push(formatModernizationDetail(i + 1, c));
    });
  }

  if (output.diff) {
    lines.push('---');
    lines.push('');
    lines.push('## 📝 Part 4: Suggested Changes (Diff)');
    lines.push('');
    lines.push('```diff');
    lines.push(output.diff);
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

function classify(finding: Finding): CategorizedFinding {
  const msg = finding.message.toLowerCase();
  const hasPattern = 'patternSuggestion' in finding;
  const hasModern = 'modernizationType' in finding || 'modernAlternative' in finding;

  if (hasModern || msg.includes('var') && msg.includes('const') ||
      msg.includes('console') && msg.includes('logging') ||
      msg.includes('commonjs') || msg.includes('es modules') ||
      msg.includes('promise chain') || msg.includes('async/await') ||
      msg.includes('untyped catch')) {
    return {
      finding,
      category: 'modernization',
      suggestion: (finding as any).modernAlternative,
    };
  }

  if (hasPattern || msg.includes('strategy pattern') || msg.includes('factory pattern') ||
      msg.includes('observer') || msg.includes('event bus') ||
      msg.includes('builder pattern') || msg.includes('facade pattern') ||
      msg.includes('chain of responsibility')) {
    return {
      finding,
      category: 'design-pattern',
      suggestion: (finding as any).patternSuggestion,
    };
  }

  return { finding, category: 'code-smell' };
}

function formatTableRow(idx: number, f: Finding): string {
  const type = getSmellLabel(f);
  return `| ${idx} | ${severityIcon(f.severity)} | ${type} | \`${shortenPath(f.file)}\` | ${f.lineStart} | ${f.message} |`;
}

function formatDetail(idx: number, f: Finding): string {
  const lines: string[] = [];
  lines.push(`### ${idx}. ${severityIcon(f.severity)} ${f.message}`);
  lines.push('');
  lines.push(`- **File:** \`${f.file}\``);
  lines.push(`- **Location:** line ${f.lineStart}–${f.lineEnd}`);
  lines.push(`- **Severity:** ${f.severity}`);
  lines.push(`- **Confidence:** ${(f.confidence * 100).toFixed(0)}%`);
  if (Object.keys(f.metrics).length > 0) {
    lines.push(`- **Metrics:** ${formatMetrics(f)}`);
  }
  if (f.responsibilityGroups && f.responsibilityGroups.length > 0) {
    lines.push('');
    lines.push('**Suggested split (Responsibility Groups):**');
    lines.push('');
    lines.push('| Group | Methods |');
    lines.push('|-------|---------|');
    for (const g of f.responsibilityGroups) {
      lines.push(`| ${g.name} | ${g.methods.join(', ')} |`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function formatPatternDetail(idx: number, c: CategorizedFinding): string {
  const f = c.finding;
  const lines: string[] = [];
  lines.push(`### ${idx}. 💡 ${c.suggestion || 'Pattern Suggestion'}`);
  lines.push('');
  lines.push(`- **File:** \`${f.file}\``);
  lines.push(`- **Location:** line ${f.lineStart}–${f.lineEnd}`);
  lines.push(`- **Confidence:** ${(f.confidence * 100).toFixed(0)}%`);
  if (Object.keys(f.metrics).length > 0) {
    lines.push(`- **Metrics:** ${formatMetrics(f)}`);
  }
  lines.push(`- **Reason:** ${f.message}`);
  lines.push('');
  return lines.join('\n');
}

function formatModernizationDetail(idx: number, c: CategorizedFinding): string {
  const f = c.finding;
  const lines: string[] = [];
  lines.push(`### ${idx}. 🔄 ${c.suggestion || 'Modernization'}`);
  lines.push('');
  lines.push(`- **File:** \`${f.file}\``);
  lines.push(`- **Location:** line ${f.lineStart}–${f.lineEnd}`);
  lines.push(`- **Issue:** ${f.message}`);
  if (c.suggestion) {
    lines.push(`- **Migration to:** ${c.suggestion}`);
  }
  lines.push('');
  return lines.join('\n');
}

function getSmellLabel(f: Finding): string {
  if (f.message.includes('God Class')) return 'God Class';
  if (f.message.includes('too long')) return 'Long Method';
  if (f.message.includes('high complexity') || f.message.includes('High complexity')) return 'High Complexity';
  if (f.message.includes('Duplicated')) return 'Duplicated Code';
  return f.smellType;
}

function severityIcon(severity: string): string {
  switch (severity) {
    case 'critical': return '🔴 Critical';
    case 'high': return '🟡 High';
    case 'medium': return '🔵 Medium';
    default: return severity;
  }
}

function shortenPath(filePath: string): string {
  const parts = filePath.split('/');
  if (parts.length <= 3) return filePath;
  return '…/' + parts.slice(-2).join('/');
}

function formatMetrics(f: Finding): string {
  return Object.entries(f.metrics)
    .map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed(v % 1 === 0 ? 0 : 1) : v}`)
    .join(', ');
}
