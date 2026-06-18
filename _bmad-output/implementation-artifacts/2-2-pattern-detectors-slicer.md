# Story 2.2: Pattern Detectors & Context Slicer

Status: ready-for-dev

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

- [ ] Task 1: Pattern Detectors
  - [ ] If-Else Chain: traverse IfStatement chains (≥4) và SwitchStatement (≥4 cases)
  - [ ] Manual Factory: aggregate NewExpression per class across files
  - [ ] Output Finding với patternSuggestion field

- [ ] Task 2: Type Signature Extractor
  - [ ] Input: file path + SymbolTable → Output: interface-only string (method signatures)
  - [ ] Format: TypeScript interface syntax (readable by Claude)

- [ ] Task 3: Context Slicer
  - [ ] Input: Finding + source files + SymbolTable + DependencyGraph
  - [ ] Include: problematic file source + dependency type signatures + metrics JSON
  - [ ] Smart truncation for large files
  - [ ] Token estimation (chars/4)

- [ ] Task 4: Unit tests
  - [ ] Pattern detection: switch 6 cases → Strategy suggested
  - [ ] Context slicer: UserService → ~600 tokens output
  - [ ] Truncation test: 1500-line file handled

## Dev Notes

- Context Slicer là key cost-optimization: 8000 → 600 tokens per issue (13.5x savings)
- Type signatures: chỉ method name + params + returnType — Claude cần biết API shape
- Output của Context Slicer = string dùng trực tiếp làm prompt content

### References

- [Source: docs/system-architecture.md#4. Context Slicer]
- [Source: docs/example-god-class-walkthrough.md#Bước 3 — Context Slicer]
- [Source: docs/business-overview.md#Tính năng 2 — Đề xuất Design Pattern]
