#!/usr/bin/env node
import { Command } from 'commander';
import { indexProject } from './indexer/project-indexer.js';
const program = new Command();
program
    .name('refactor-agent')
    .description('TypeScript/JS refactoring analysis tool')
    .version('1.0.0');
program
    .command('analyze')
    .description('Analyze a TypeScript/JS project')
    .argument('<path>', 'Path to the project directory')
    .option('--format <format>', 'Output format: json | pretty', 'pretty')
    .option('--threshold-loc <number>', 'LOC threshold', parseInt)
    .option('--threshold-methods <number>', 'Methods threshold', parseInt)
    .option('--threshold-coupling <number>', 'Coupling threshold', parseInt)
    .action(async (targetPath, options) => {
    const result = await indexProject(targetPath);
    if (options.format === 'json') {
        const serializable = {
            files: result.files.map(f => ({ filePath: f.filePath, parser: f.parser })),
            errors: result.errors,
        };
        console.log(JSON.stringify(serializable, null, 2));
    }
    else {
        console.log(`Indexed ${result.files.length} files from ${targetPath}`);
        for (const file of result.files) {
            console.log(`  ${file.filePath}`);
        }
    }
});
program.parse();
//# sourceMappingURL=cli.js.map