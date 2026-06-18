# Story 2.1: Smell Detectors (God Class, Long Method, High Complexity, Duplicated Code)

Status: ready-for-dev

## Story

As a developer running the CLI tool,
I want code smells automatically detected in my project,
so that I know exactly which files/classes need refactoring.

## Acceptance Criteria

1. God Class detector: LOC > 300 AND methods > 10 AND coupling > 3
2. Long Method detector: method LOC > 50
3. High Complexity detector: cyclomatic complexity > 10
4. Duplicated Code detector: dùng jscpd library, min 5 lines duplicate
5. Tất cả trả về Finding[]: smellType, file, lineStart, lineEnd, severity, confidence, metrics
6. Severity: medium/high/critical dựa trên mức vượt ngưỡng
7. God Class detector include responsibilityGroups[] (group methods by dependency usage)
8. Unit tests cho mỗi detector

## Tasks / Subtasks

- [ ] Task 1: Base types & interface
  - [ ] Finding interface trong common/types.ts
  - [ ] BaseDetector: `detect(symbolTable, depGraph, metrics) → Finding[]`

- [ ] Task 2: God Class Detector
  - [ ] Threshold checks (configurable)
  - [ ] Responsibility grouping (methods → group by injected dependency used)
  - [ ] Severity + confidence scoring

- [ ] Task 3: Long Method & High Complexity Detectors
  - [ ] Long Method: iterate methods, check LOC > threshold
  - [ ] High Complexity: check CC > threshold per method

- [ ] Task 4: Duplicated Code Detector
  - [ ] jscpd library mode integration
  - [ ] Convert clone pairs → Finding format
  - [ ] Ignore node_modules, test files, dist

- [ ] Task 5: Unit tests
  - [ ] God Class fixture → detected, 3 responsibility groups
  - [ ] Long method fixture → detected
  - [ ] Small clean code → NOT detected (negative tests)

## Dev Notes

- jscpd: `npm install jscpd` — dùng programmatic API, không CLI
- Detectors hoàn toàn deterministic (không dùng LLM) — fast, testable
- Thresholds configurable qua CLI flags (--threshold-loc=300)

### References

- [Source: docs/example-god-class-walkthrough.md#Bước 2 — Detector Chain]
- [Source: docs/business-overview.md#Tính năng 1 — Phát hiện Code Smell]
