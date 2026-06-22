# Story 1.2: Symbol Table, Dependency Graph & Metrics

Status: review

## Story

As a code analysis system,
I want to build symbol table, dependency graph, and calculate metrics from parsed AST,
so that detectors have structured data to apply threshold-based rules.

## Acceptance Criteria

1. `symbol-table-builder.ts` extract classes (name, methods, constructorDeps), functions, interfaces
2. `dependency-graph-builder.ts` build directed graph từ import/require statements
3. `metrics-calculator.ts` tính: LOC, method count, cyclomatic complexity, coupling per class
4. Cyclomatic complexity: đếm if, else-if, case, for, while, do, catch, &&, ||, ternary
5. Output types defined rõ ràng (SymbolTable, DependencyGraph, FileMetrics)
6. Unit test: UserService fixture → methods:18, coupling:4, LOC:420

## Tasks / Subtasks

- [x] Task 1: Types definition
  - [x] `src/common/types.ts` — SymbolTable, ClassSymbol, DependencyGraph, FileMetrics, ClassMetrics

- [x] Task 2: Symbol Table Builder
  - [x] Extract: classes (methods[], constructorDeps[]), functions, interfaces
  - [x] Handle: exported/non-exported, async methods, return types

- [x] Task 3: Dependency Graph Builder  
  - [x] Parse import/require statements
  - [x] Build adjacency map: file → dependencies[]
  - [x] getCouplingScore(file) → unique import count

- [x] Task 4: Metrics Calculator
  - [x] LOC: non-empty, non-comment lines
  - [x] Method count per class
  - [x] Cyclomatic complexity per method (avg, max per class)
  - [x] Coupling from dependency graph

- [x] Task 5: Unit tests
  - [x] Fixture: UserService.ts (God Class example)
  - [x] Verify all metrics match expected values

## Dev Notes

- ts-morph API: `.getClasses()`, `.getMethods()`, `.getReturnType()`, `.getImportDeclarations()`
- Symbol table + metrics = input chính cho detectors (Epic 2)
- Tất cả build 1 lần per analysis run — không cần caching

### References

- [Source: docs/example-god-class-walkthrough.md#Bước 1 — Project Indexer]
- [Source: docs/system-architecture.md#7. Cấu trúc Module — IDX]

## Dev Agent Record

### Implementation Notes
- All types defined in `src/common/types.ts`
- Symbol table builder uses ts-morph API for class/function/interface extraction
- Dependency graph uses import path resolution with extension/index candidates
- Metrics calculator: LOC = non-empty non-comment lines, CC uses forEachDescendant for AST walk
- UserService fixture: 18 methods, 4 constructor deps, 420 LOC, coupling 4

### Tests Created
- `tests/analyzers/symbol-table-builder.test.ts` — 5 tests
- `tests/analyzers/dependency-graph-builder.test.ts` — 4 tests
- `tests/analyzers/metrics-calculator.test.ts` — 5 tests

### File List
- `src/common/types.ts`
- `src/analyzers/symbol-table-builder.ts`
- `src/analyzers/dependency-graph-builder.ts`
- `src/analyzers/metrics-calculator.ts`
- `tests/analyzers/symbol-table-builder.test.ts`
- `tests/analyzers/dependency-graph-builder.test.ts`
- `tests/analyzers/metrics-calculator.test.ts`
- `tests/fixtures/god-class-project/tsconfig.json`
- `tests/fixtures/god-class-project/UserService.ts`
- `tests/fixtures/god-class-project/database.ts`
- `tests/fixtures/god-class-project/logger.ts`
- `tests/fixtures/god-class-project/cache.ts`
- `tests/fixtures/god-class-project/email.ts`

### Change Log
- 2026-06-22: Story 1-2 implemented — symbol table, dependency graph, metrics calculator, all tests passing (21/21)
