# Story 4.1: Full Pipeline & CLI Output Formatting

Status: ready-for-dev

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

- [ ] Task 1: Pipeline orchestrator
  - [ ] Wire tất cả modules: Indexer → Detectors → Slicer → Claude → Validator → Output
  - [ ] Handle --dry-run: skip Claude + Validator steps
  - [ ] Measure total processing time

- [ ] Task 2: JSON output formatter
  - [ ] Output raw JSON: { findings[], diff?, stats, processingMs }
  - [ ] Pipe-friendly (stdout only, errors → stderr)

- [ ] Task 3: Pretty terminal output
  - [ ] Chalk colors: red=critical, yellow=high, blue=medium
  - [ ] Section headers: "🔍 Findings", "💡 Suggestions", "📝 Diff"
  - [ ] File:line clickable format (terminal link)
  - [ ] Diff: syntax-highlighted unified diff
  - [ ] Summary footer

- [ ] Task 4: Exit codes & error handling
  - [ ] Exit 0: no critical findings
  - [ ] Exit 1: has critical/high findings
  - [ ] Missing API key: helpful error + suggest dry-run
  - [ ] Empty project / no files: clear message

- [ ] Task 5: Integration test
  - [ ] Test: sample project → full output (mock Claude)
  - [ ] Test: --dry-run → findings only, no Claude call
  - [ ] Test: --format json → valid JSON output

## Dev Notes

- Commander.js handles CLI args + flags
- Chalk for terminal colors (auto-detects color support)
- Exit codes important cho CI/CD integration (GitHub Actions, GitLab CI)
- --dry-run mode rất hữu ích: detect smells miễn phí, không cần API key

### References

- [Source: docs/business-overview.md#7. Mô hình Phân phối — CLI tool]
- [Source: docs/example-god-class-walkthrough.md#Bước 7 — Response]
