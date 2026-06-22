# Story 2.1: Smell Detectors (God Class, Long Method, High Complexity, Duplicated Code)

Status: review

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

- [x] Task 1: Base types & interface
  - [x] Finding interface trong common/types.ts
  - [x] BaseDetector: `detect(symbolTable, depGraph, metrics) → Finding[]`

- [x] Task 2: God Class Detector
  - [x] Threshold checks (configurable)
  - [x] Responsibility grouping (methods → group by injected dependency used)
  - [x] Severity + confidence scoring

- [x] Task 3: Long Method & High Complexity Detectors
  - [x] Long Method: iterate methods, check LOC > threshold
  - [x] High Complexity: check CC > threshold per method

- [x] Task 4: Duplicated Code Detector
  - [x] jscpd library mode integration
  - [x] Convert clone pairs → Finding format
  - [x] Ignore node_modules, test files, dist

- [x] Task 5: Unit tests
  - [x] God Class fixture → detected, 3 responsibility groups
  - [x] Long method fixture → detected
  - [x] Small clean code → NOT detected (negative tests)

## Dev Notes

- jscpd: `npm install jscpd` — dùng programmatic API, không CLI
- Detectors hoàn toàn deterministic (không dùng LLM) — fast, testable
- Thresholds configurable qua CLI flags (--threshold-loc=300)

### References

- [Source: docs/example-god-class-walkthrough.md#Bước 2 — Detector Chain]
- [Source: docs/business-overview.md#Tính năng 1 — Phát hiện Code Smell]

## Dev Agent Record

### Implementation Notes
- Base Detector interface with DetectorContext pattern
- God Class: semantic pattern matching for responsibility grouping (maps method names to dep semantics)
- jscpd v5 (Rust binary): used as subprocess with JSON reporter, no programmatic API available
- All thresholds configurable via DetectorThresholds type
- Severity calculated as ratio of actual vs threshold

### Tests Created
- `tests/detectors/god-class-detector.test.ts` — 4 tests
- `tests/detectors/long-method-detector.test.ts` — 3 tests
- `tests/detectors/high-complexity-detector.test.ts` — 3 tests
- `tests/detectors/duplicated-code-detector.test.ts` — 2 tests

### File List
- `src/common/types.ts` (modified — added Finding, Severity, SmellType, DetectorThresholds, DEFAULT_THRESHOLDS)
- `src/detectors/base-detector.ts`
- `src/detectors/god-class-detector.ts`
- `src/detectors/long-method-detector.ts`
- `src/detectors/high-complexity-detector.ts`
- `src/detectors/duplicated-code-detector.ts`
- `tests/detectors/god-class-detector.test.ts`
- `tests/detectors/long-method-detector.test.ts`
- `tests/detectors/high-complexity-detector.test.ts`
- `tests/detectors/duplicated-code-detector.test.ts`

### Change Log
- 2026-06-22: Story 2-1 implemented — all 4 detectors + tests passing (33/33 total)
