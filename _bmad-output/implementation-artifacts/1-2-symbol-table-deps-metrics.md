# Story 1.2: Symbol Table, Dependency Graph & Metrics

Status: ready-for-dev

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

- [ ] Task 1: Types definition
  - [ ] `src/common/types.ts` — SymbolTable, ClassSymbol, DependencyGraph, FileMetrics, ClassMetrics

- [ ] Task 2: Symbol Table Builder
  - [ ] Extract: classes (methods[], constructorDeps[]), functions, interfaces
  - [ ] Handle: exported/non-exported, async methods, return types

- [ ] Task 3: Dependency Graph Builder  
  - [ ] Parse import/require statements
  - [ ] Build adjacency map: file → dependencies[]
  - [ ] getCouplingScore(file) → unique import count

- [ ] Task 4: Metrics Calculator
  - [ ] LOC: non-empty, non-comment lines
  - [ ] Method count per class
  - [ ] Cyclomatic complexity per method (avg, max per class)
  - [ ] Coupling from dependency graph

- [ ] Task 5: Unit tests
  - [ ] Fixture: UserService.ts (God Class example)
  - [ ] Verify all metrics match expected values

## Dev Notes

- ts-morph API: `.getClasses()`, `.getMethods()`, `.getReturnType()`, `.getImportDeclarations()`
- Symbol table + metrics = input chính cho detectors (Epic 2)
- Tất cả build 1 lần per analysis run — không cần caching

### References

- [Source: docs/example-god-class-walkthrough.md#Bước 1 — Project Indexer]
- [Source: docs/system-architecture.md#7. Cấu trúc Module — IDX]
