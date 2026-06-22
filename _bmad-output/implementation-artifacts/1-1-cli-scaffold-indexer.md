# Story 1.1: CLI Scaffold & Project Indexer

Status: review

## Story

As a developer,
I want to run `npx refactor-agent analyze ./src` from terminal,
so that the tool parses my TypeScript/JS project and prepares AST data for analysis.

## Acceptance Criteria

1. CLI entry point chạy được: `npx refactor-agent analyze <path>`
2. Parse arguments: path (required), --format (json|pretty, default: pretty), --threshold-loc, --threshold-methods, --threshold-coupling
3. TypeScript project scaffolded: tsconfig strict, ESLint, Vitest
4. `project-indexer.ts` scan folder, parse .ts/.tsx/.js/.jsx files bằng ts-morph (có tsconfig) hoặc @typescript-eslint/parser (không tsconfig)
5. Skip file có syntax error (log warning, tiếp tục)
6. Output: parsed source files sẵn sàng cho downstream

## Tasks / Subtasks

- [x] Task 1: CLI project setup
  - [x] Init TypeScript project (strict mode)
  - [x] Install deps: ts-morph, @typescript-eslint/parser, commander (CLI), chalk (colors)
  - [x] Tạo `src/cli.ts` — entry point dùng commander
  - [x] Tạo bin entry trong package.json
  - [x] Vitest config cơ bản

- [x] Task 2: Project Indexer
  - [x] Tạo `src/indexer/project-indexer.ts`
  - [x] Scan directory → filter .ts/.tsx/.js/.jsx
  - [x] Detect tsconfig.json → route parser
  - [x] ts-morph: khởi tạo Project, load source files
  - [x] @typescript-eslint/parser: fallback cho plain JS
  - [x] Error handling per-file (skip + warn)

- [x] Task 3: Unit test
  - [x] Test fixture: mini TS project (3-5 files)
  - [x] Test: parse thành công, trả về source files
  - [x] Test: file lỗi syntax → skip gracefully

## Dev Notes

- CLI framework: `commander` (lightweight, standard)
- Không cần NestJS — plain TypeScript + DI thủ công (đơn giản cho CLI tool)
- ts-morph wrap TypeScript Compiler API — type-aware parsing
- Output format cuối cùng (Epic 4) sẽ render kết quả ra terminal

### References

- [Source: docs/system-architecture.md#8. Tech Stack]
- [Source: docs/system-architecture.md#2. Tổng quan Kiến trúc 4 Tầng — Tầng 1]

## Dev Agent Record

### Implementation Notes
- Node 20 (via .nvmrc), ESM project (`"type": "module"`)
- commander v12 (v15 requires Node 22+)
- ts-morph for tsconfig-based projects, @typescript-eslint/typescript-estree as fallback
- JSON output serializes only filePath + parser (ts-morph SourceFile has circular refs)

### Tests Created
- `tests/indexer/project-indexer.test.ts` — 4 tests (ts-morph parse, estree fallback, syntax error skip, nonexistent path)
- `tests/cli.test.ts` — 3 tests (pretty output, json output, missing arg error)

### File List
- `package.json`
- `.nvmrc`
- `tsconfig.json`
- `vitest.config.ts`
- `src/cli.ts`
- `src/indexer/project-indexer.ts`
- `tests/cli.test.ts`
- `tests/indexer/project-indexer.test.ts`
- `tests/fixtures/valid-project/tsconfig.json`
- `tests/fixtures/valid-project/hello.ts`
- `tests/fixtures/valid-project/math.ts`
- `tests/fixtures/valid-project/types.ts`
- `tests/fixtures/valid-project/index.tsx`
- `tests/fixtures/no-tsconfig-project/app.js`
- `tests/fixtures/no-tsconfig-project/utils.jsx`
- `tests/fixtures/syntax-error-project/valid.ts`
- `tests/fixtures/syntax-error-project/broken.ts`

### Change Log
- 2026-06-22: Story 1-1 implemented — CLI scaffold, project indexer, all tests passing (7/7)
