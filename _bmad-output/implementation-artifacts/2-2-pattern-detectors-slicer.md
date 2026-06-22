# Story 2.2: Pattern Detectors & Context Slicer

Status: review

## Story

As a code analysis system,
I want to detect design pattern opportunities and prepare minimal context for Claude,
so that the LLM receives focused prompts (~600 tokens) instead of raw code dumps.

## Acceptance Criteria

1. If-Else Chain detector: ≥4 branches → suggest Strategy Pattern
2. Manual Factory detector: same class instantiated ≥3 times across ≥2 files → suggest Factory Pattern
3. Context Slicer: per finding → full source of problematic file + type signatures of dependencies + metrics
4. Type Signature Extractor: extract interface-only representation (no implementation bodies)
5. Token budget target: ~600 tokens per issue (file source + dep signatures + metrics)
6. Truncation: file > 1000 lines → include relevant class/function only
7. Unit tests verify token budget and content correctness

## Tasks / Subtasks

- [x] Task 1: Pattern Detectors
  - [x] If-Else Chain: traverse IfStatement chains (≥4) và SwitchStatement (≥4 cases)
  - [x] Manual Factory: aggregate NewExpression per class across files
  - [x] Output Finding với patternSuggestion field

- [x] Task 2: Type Signature Extractor
  - [x] Input: file path + SymbolTable → Output: interface-only string (method signatures)
  - [x] Format: TypeScript interface syntax (readable by Claude)

- [x] Task 3: Context Slicer
  - [x] Input: Finding + source files + SymbolTable + DependencyGraph
  - [x] Include: problematic file source + dependency type signatures + metrics JSON
  - [x] Smart truncation for large files
  - [x] Token estimation (chars/4)

- [x] Task 4: Unit tests
  - [x] Pattern detection: switch 6 cases → Strategy suggested
  - [x] Context slicer: UserService → ~600 tokens output
  - [x] Truncation test: 1500-line file handled

## Dev Notes

- Context Slicer là key cost-optimization: 8000 → 600 tokens per issue (13.5x savings)
- Type signatures: chỉ method name + params + returnType — Claude cần biết API shape
- Output của Context Slicer = string dùng trực tiếp làm prompt content

### References

- [Source: docs/system-architecture.md#4. Context Slicer]
- [Source: docs/example-god-class-walkthrough.md#Bước 3 — Context Slicer]
- [Source: docs/business-overview.md#Tính năng 2 — Đề xuất Design Pattern]

## Dev Agent Record

### Implementation Notes
- If-else chain: detects both IfStatement chains and SwitchStatement with ≥N cases
- Manual factory: aggregates NewExpression nodes per class across all source files
- Type signature extractor: converts ClassSymbol/InterfaceSymbol to interface-only string
- Context slicer: smart truncation for files > 1000 lines, targets relevant class/function
- Token estimation: chars/4 approximation

### Tests Created
- `tests/detectors/pattern-detectors.test.ts` — 5 tests
- `tests/slicer/context-slicer.test.ts` — 3 tests
- `tests/slicer/type-signature-extractor.test.ts` — 3 tests

### File List
- `src/detectors/if-else-chain-detector.ts`
- `src/detectors/manual-factory-detector.ts`
- `src/slicer/type-signature-extractor.ts`
- `src/slicer/context-slicer.ts`
- `tests/detectors/pattern-detectors.test.ts`
- `tests/slicer/context-slicer.test.ts`
- `tests/slicer/type-signature-extractor.test.ts`
- `tests/fixtures/pattern-project/tsconfig.json`
- `tests/fixtures/pattern-project/switch-handler.ts`
- `tests/fixtures/pattern-project/factory-usage-a.ts`
- `tests/fixtures/pattern-project/factory-usage-b.ts`
- `tests/fixtures/pattern-project/connection.ts`

### Change Log
- 2026-06-22: Story 2-2 implemented — pattern detectors + context slicer, all tests passing (44/44 total)
