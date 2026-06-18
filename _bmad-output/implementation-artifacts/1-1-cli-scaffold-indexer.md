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

- [ ] Task 1: CLI project setup
  - [ ] Init TypeScript project (strict mode)
  - [ ] Install deps: ts-morph, @typescript-eslint/parser, commander (CLI), chalk (colors)
  - [ ] Tạo `src/cli.ts` — entry point dùng commander
  - [ ] Tạo bin entry trong package.json
  - [ ] Vitest config cơ bản

- [ ] Task 2: Project Indexer
  - [ ] Tạo `src/indexer/project-indexer.ts`
  - [ ] Scan directory → filter .ts/.tsx/.js/.jsx
  - [ ] Detect tsconfig.json → route parser
  - [ ] ts-morph: khởi tạo Project, load source files
  - [ ] @typescript-eslint/parser: fallback cho plain JS
  - [ ] Error handling per-file (skip + warn)

- [ ] Task 3: Unit test
  - [ ] Test fixture: mini TS project (3-5 files)
  - [ ] Test: parse thành công, trả về source files
  - [ ] Test: file lỗi syntax → skip gracefully

## Dev Notes

- CLI framework: `commander` (lightweight, standard)
- Không cần NestJS — plain TypeScript + DI thủ công (đơn giản cho CLI tool)
- ts-morph wrap TypeScript Compiler API — type-aware parsing
- Output format cuối cùng (Epic 4) sẽ render kết quả ra terminal

### References

- [Source: docs/system-architecture.md#8. Tech Stack]
- [Source: docs/system-architecture.md#2. Tổng quan Kiến trúc 4 Tầng — Tầng 1]
