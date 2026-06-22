# Story 4.1: Full Pipeline & CLI Output Formatting

Status: review

## Story

As a developer running the tool from terminal,
I want to see formatted analysis results (findings, suggestions, diff) in my terminal,
so that I can quickly understand what needs refactoring and how.

## Acceptance Criteria

1. CLI command `analyze <path>` runs full pipeline: index → detect → slice → Claude → validate → output
2. `--format json` → raw JSON output (cho CI/CD integration)
3. `--format pretty` (default) → colored terminal output với sections rõ ràng
4. Pretty output: severity badges, file:line locations, pattern suggestions, code diff highlighted
5. Summary ở cuối: total findings, files analyzed, processing time
6. Exit code: 0 (no critical findings), 1 (has critical findings) — cho CI gate usage
7. `--dry-run` flag: chỉ detect + report, không gọi Claude (fast, free)
8. Error handling: missing ANTHROPIC_API_KEY → clear error message + suggest --dry-run

## Tasks / Subtasks

- [x] Task 1: Pipeline orchestrator
  - [x] Wire tất cả modules: Indexer → Detectors → Slicer → Claude → Validator → Output
  - [x] Handle --dry-run: skip Claude + Validator steps
  - [x] Measure total processing time

- [x] Task 2: JSON output formatter
  - [x] Output raw JSON: { findings[], diff?, stats, processingMs }
  - [x] Pipe-friendly (stdout only, errors → stderr)

- [x] Task 3: Pretty terminal output
  - [x] Chalk colors: red=critical, yellow=high, blue=medium
  - [x] Section headers: "🔍 Findings", "💡 Suggestions", "📝 Diff"
  - [x] File:line clickable format (terminal link)
  - [x] Diff: syntax-highlighted unified diff
  - [x] Summary footer

- [x] Task 4: Exit codes & error handling
  - [x] Exit 0: no critical findings
  - [x] Exit 1: has critical/high findings
  - [x] Missing API key: helpful error + suggest dry-run
  - [x] Empty project / no files: clear message

- [x] Task 5: Integration test
  - [x] Test: sample project → full output (mock Claude)
  - [x] Test: --dry-run → findings only, no Claude call
  - [x] Test: --format json → valid JSON output

## Dev Notes

- Commander.js handles CLI args + flags
- Chalk for terminal colors (auto-detects color support)
- Exit codes important cho CI/CD integration (GitHub Actions, GitLab CI)
- --dry-run mode rất hữu ích: detect smells miễn phí, không cần API key

### References

- [Source: docs/business-overview.md#7. Mô hình Phân phối — CLI tool]
- [Source: docs/example-god-class-walkthrough.md#Bước 7 — Response]

## Dev Agent Record

### Implementation Notes
- Pipeline orchestrator wires all modules: indexer → symbol table → dependency graph → metrics → detectors → slicer → Claude → validator → diff → output
- Knowledge-agent rulebook (3 files) integrated into prompt-builder for Claude context
- --dry-run skips Claude/validator steps (free, fast analysis)
- Exit codes: 0 = clean, 1 = critical/high findings, 2 = missing API key
- Pretty formatter uses chalk for colored terminal output with severity badges

### Tests Created
- `tests/pipeline/orchestrator.test.ts` — 4 tests (dry-run, clean project, missing key, nonexistent path)
- `tests/output/formatters.test.ts` — 3 tests (JSON validity, pretty sections, empty findings)

### File List
- `src/pipeline/orchestrator.ts`
- `src/output/json-formatter.ts`
- `src/output/pretty-formatter.ts`
- `src/cli.ts` (rewritten — full pipeline integration)
- `src/llm/prompt-builder.ts` (modified — knowledge-agent integration)
- `tests/pipeline/orchestrator.test.ts`
- `tests/output/formatters.test.ts`

### Change Log
- 2026-06-22: Story 4-1 implemented — full pipeline, CLI output, knowledge-agent integration, all tests passing (68/68)
