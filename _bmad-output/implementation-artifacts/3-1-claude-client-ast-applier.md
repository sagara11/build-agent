# Story 3.1: Claude Client, Prompt Builder & AST Applier

Status: review

## Story

As a code analysis system,
I want to send findings to Claude API and apply returned AST transformations to a sandbox,
so that refactoring suggestions are generated and applied structurally.

## Acceptance Criteria

1. `claude-client.ts` dùng @anthropic-ai/sdk, đọc ANTHROPIC_API_KEY từ env
2. Tool schema `apply_ast_changes`: 5 actions (extract_class, extract_method, replace_node, convert_async, rename_symbol)
3. `tool_choice: { type: 'any' }` — force tool_use response
4. `prompt-builder.ts` format: issue summary + source + type signatures + instruction
5. `ast-applier.ts` apply actions vào temp sandbox (không đụng source gốc)
6. extract_class: move methods → new file, update constructors, add imports
7. rename_symbol: update tất cả references across project
8. Model: claude-sonnet-4-5, max_tokens: 4096
9. Unit tests (mock SDK): verify request structure, verify apply logic

## Tasks / Subtasks

- [x] Task 1: Types & Prompt Builder
  - [x] AstAction, AstActionList types
  - [x] prompt-builder.ts: build message từ finding + sliced context

- [x] Task 2: Claude Client
  - [x] @anthropic-ai/sdk integration
  - [x] AST_DIFF_TOOL schema definition
  - [x] analyzeIssue(prompt) → AstActionList
  - [x] Error handling: no tool_use → throw

- [x] Task 3: AST Applier
  - [x] Copy project → temp dir (sandbox)
  - [x] extract_class: create new file, move methods, update deps
  - [x] replace_node: swap AST node with transformed code
  - [x] rename_symbol: rename + update all references
  - [x] Cleanup temp dir in finally block

- [x] Task 4: Unit tests
  - [x] Mock SDK → verify request params
  - [x] AST Applier: extract_class → new file exists, methods moved
  - [x] AST Applier: sandbox isolation (original unchanged)

## Dev Notes

- tool_use thay thế text parsing — response đã validated JSON, chỉ cast type
- Sandbox pattern: copy → manipulate → validate → diff → cleanup
- ts-morph manipulation: `.addSourceFile()`, `.getClass()`, `.addMethod()`, `.remove()`
- ANTHROPIC_API_KEY: SDK auto-reads from process.env

### References

- [Source: docs/system-architecture.md#11. Chi tiết Module LLM]
- [Source: docs/system-architecture.md#11.3. Tool Schema]
- [Source: docs/example-god-class-walkthrough.md#Bước 4, 5, 6a]

## Dev Agent Record

### Implementation Notes
- ClaudeClient wraps @anthropic-ai/sdk with tool_choice: { type: 'any' }
- AST_DIFF_TOOL schema with 5 actions: extract_class, extract_method, replace_node, convert_async, rename_symbol
- AstApplier: copies project to tmp sandbox, applies ts-morph transforms, never touches original
- Prompt builder: sections for issue summary, metrics, source code, dep signatures, instructions

### Tests Created
- `tests/llm/claude-client.test.ts` — 3 tests (request params, no tool_use error, schema exposure)
- `tests/llm/ast-applier.test.ts` — 4 tests (extract_class, sandbox isolation, rename, error handling)
- `tests/llm/prompt-builder.test.ts` — 1 test (all sections present)

### File List
- `src/llm/types.ts`
- `src/llm/prompt-builder.ts`
- `src/llm/claude-client.ts`
- `src/llm/ast-applier.ts`
- `tests/llm/claude-client.test.ts`
- `tests/llm/ast-applier.test.ts`
- `tests/llm/prompt-builder.test.ts`

### Change Log
- 2026-06-22: Story 3-1 implemented — Claude client, prompt builder, AST applier, all tests passing (52/52 total)
