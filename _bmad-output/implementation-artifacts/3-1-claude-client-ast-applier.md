# Story 3.1: Claude Client, Prompt Builder & AST Applier

Status: ready-for-dev

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

- [ ] Task 1: Types & Prompt Builder
  - [ ] AstAction, AstActionList types
  - [ ] prompt-builder.ts: build message từ finding + sliced context

- [ ] Task 2: Claude Client
  - [ ] @anthropic-ai/sdk integration
  - [ ] AST_DIFF_TOOL schema definition
  - [ ] analyzeIssue(prompt) → AstActionList
  - [ ] Error handling: no tool_use → throw

- [ ] Task 3: AST Applier
  - [ ] Copy project → temp dir (sandbox)
  - [ ] extract_class: create new file, move methods, update deps
  - [ ] replace_node: swap AST node with transformed code
  - [ ] rename_symbol: rename + update all references
  - [ ] Cleanup temp dir in finally block

- [ ] Task 4: Unit tests
  - [ ] Mock SDK → verify request params
  - [ ] AST Applier: extract_class → new file exists, methods moved
  - [ ] AST Applier: sandbox isolation (original unchanged)

## Dev Notes

- tool_use thay thế text parsing — response đã validated JSON, chỉ cast type
- Sandbox pattern: copy → manipulate → validate → diff → cleanup
- ts-morph manipulation: `.addSourceFile()`, `.getClass()`, `.addMethod()`, `.remove()`
- ANTHROPIC_API_KEY: SDK auto-reads from process.env

### References

- [Source: docs/system-architecture.md#11. Chi tiết Module LLM]
- [Source: docs/system-architecture.md#11.3. Tool Schema]
- [Source: docs/example-god-class-walkthrough.md#Bước 4, 5, 6a]
