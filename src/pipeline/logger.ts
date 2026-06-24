import chalk from 'chalk';

let enabled = true;

export function setLogEnabled(value: boolean) {
  enabled = value;
}

export function logStep(step: string) {
  if (!enabled) return;
  process.stderr.write(chalk.dim(`  ⏳ ${step}...\n`));
}

export function logDone(step: string, detail?: string) {
  if (!enabled) return;
  const suffix = detail ? chalk.dim(` (${detail})`) : '';
  process.stderr.write(`  ${chalk.green('✓')} ${step}${suffix}\n`);
}

export function logInfo(msg: string) {
  if (!enabled) return;
  process.stderr.write(chalk.dim(`  ℹ ${msg}\n`));
}

export function logHeader(title: string) {
  if (!enabled) return;
  process.stderr.write(`\n${chalk.bold(title)}\n`);
}
