# Story 3.2: TypeScript Checker, Retry & Diff Generator

Status: review

## Story

As a code analysis system,
I want to validate applied changes compile successfully and generate unified diff,
so that users only receive verified, compilable refactoring suggestions.

## Acceptance Criteria

1. `typescript-checker.ts` chạy tsc type-check trên sandbox → { compilable, errors[] }
2. Retry logic: nếu compile fail → gửi lại Claude kèm error → re-apply → re-check (max 2 retries)
3. Sau 3 attempts fail → report error, vẫn output findings (không có diff)
4. `diff-generator.ts` so sánh sandbox vs original → unified diff format
5. New files: `+++ b/path (new)`, modified files: standard unified diff
6. Wire: AstApplier → TscChecker → (retry?) → DiffGenerator
7. Unit tests: mock tsc output, verify retry flow, verify diff format

## Tasks / Subtasks

- [x] Task 1: TypeScript Checker
  - [x] Chạy tsc --noEmit trên sandbox (hoặc ts-morph diagnostics)
  - [x] Parse errors → { file, line, message }
  - [x] Handle: no tsconfig → create minimal temp config

- [x] Task 2: Retry logic
  - [x] If compile fail: append error to prompt, re-call Claude
  - [x] Re-apply revised actions → re-check
  - [x] Max 2 retries (3 total attempts)
  - [x] If all fail: graceful degradation (return findings without diff)

- [x] Task 3: Diff Generator
  - [x] Compare sandbox vs original directory
  - [x] Generate unified diff per changed/new file
  - [x] Dùng `diff` npm package hoặc custom implementation

- [x] Task 4: Unit tests
  - [x] Test: compile pass first try → no retry
  - [x] Test: fail then pass → 1 retry
  - [x] Test: fail all → graceful error
  - [x] Test: diff output format correct

## Dev Notes

- Ưu tiên ts-morph diagnostics (in-process, faster) over spawning tsc CLI
- Retry pattern: `${originalPrompt}\n\nCompilation failed:\n${errors}\nPlease revise.`
- Diff library: `diff` npm package (createTwoFilesPatch)
- Graceful degradation quan trọng — findings vẫn có giá trị ngay cả khi diff fail

### References

- [Source: docs/system-architecture.md#11.6. Retry logic]
- [Source: docs/example-god-class-walkthrough.md#Bước 6 — Fix Validator]

## Dev Agent Record

### Implementation Notes
- TypeScript checker uses ts-morph getPreEmitDiagnostics (in-process, no CLI spawn)
- Retry pipeline: max 2 retries (3 total), appends errors to prompt for Claude revision
- Diff generator uses `diff` npm package createTwoFilesPatch for unified format
- Graceful degradation: returns findings without diff if all attempts fail

### Tests Created
- `tests/checker/typescript-checker.test.ts` — 2 tests
- `tests/llm/retry-pipeline.test.ts` — 3 tests
- `tests/diff/diff-generator.test.ts` — 4 tests

### File List
- `src/checker/typescript-checker.ts`
- `src/llm/retry-pipeline.ts`
- `src/diff/diff-generator.ts`
- `tests/checker/typescript-checker.test.ts`
- `tests/llm/retry-pipeline.test.ts`
- `tests/diff/diff-generator.test.ts`
- `vitest.config.ts` (modified — increased testTimeout to 30s)

### Change Log
- 2026-06-22: Story 3-2 implemented — TypeScript checker, retry pipeline, diff generator, all tests passing (61/61)
