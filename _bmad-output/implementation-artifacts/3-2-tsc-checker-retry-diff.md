# Story 3.2: TypeScript Checker, Retry & Diff Generator

Status: ready-for-dev

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

- [ ] Task 1: TypeScript Checker
  - [ ] Chạy tsc --noEmit trên sandbox (hoặc ts-morph diagnostics)
  - [ ] Parse errors → { file, line, message }
  - [ ] Handle: no tsconfig → create minimal temp config

- [ ] Task 2: Retry logic
  - [ ] If compile fail: append error to prompt, re-call Claude
  - [ ] Re-apply revised actions → re-check
  - [ ] Max 2 retries (3 total attempts)
  - [ ] If all fail: graceful degradation (return findings without diff)

- [ ] Task 3: Diff Generator
  - [ ] Compare sandbox vs original directory
  - [ ] Generate unified diff per changed/new file
  - [ ] Dùng `diff` npm package hoặc custom implementation

- [ ] Task 4: Unit tests
  - [ ] Test: compile pass first try → no retry
  - [ ] Test: fail then pass → 1 retry
  - [ ] Test: fail all → graceful error
  - [ ] Test: diff output format correct

## Dev Notes

- Ưu tiên ts-morph diagnostics (in-process, faster) over spawning tsc CLI
- Retry pattern: `${originalPrompt}\n\nCompilation failed:\n${errors}\nPlease revise.`
- Diff library: `diff` npm package (createTwoFilesPatch)
- Graceful degradation quan trọng — findings vẫn có giá trị ngay cả khi diff fail

### References

- [Source: docs/system-architecture.md#11.6. Retry logic]
- [Source: docs/example-god-class-walkthrough.md#Bước 6 — Fix Validator]
