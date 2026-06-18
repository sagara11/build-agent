# Epics & Stories — Refactoring & Design Pattern Agent (CLI Tool)

## Tổng quan

**Mô tả:** CLI tool chạy local, phân tích code TypeScript/JavaScript, phát hiện code smell, đề xuất design pattern kèm code đã refactor — stateless, không DB, không server.

**Cách dùng:** `npx refactor-agent analyze ./src`

**Tech Stack:** TypeScript, ts-morph, @typescript-eslint/parser, jscpd, @anthropic-ai/sdk (Claude), Zod, Vitest

**Kiến trúc 4 tầng:** Indexer → Detectors + Slicer → Claude API → Fix Validator → Output JSON/diff

---

## Epic 1: Project Setup & Indexer
Thiết lập CLI project + Tầng 1 (parse AST, build symbol table, dependency graph, metrics).

**Stories:**
- 1.1 — CLI Scaffold & Project Indexer
- 1.2 — Symbol Table, Dependency Graph & Metrics

---

## Epic 2: Detectors & Context Slicer
Tầng 2 — phát hiện code smell + pattern candidates + trích xuất minimal context cho LLM.

**Stories:**
- 2.1 — Smell Detectors (God Class, Long Method, High Complexity, Duplicated Code)
- 2.2 — Pattern Detectors & Context Slicer

---

## Epic 3: Claude Integration & Fix Validator
Tầng 3+4 — gọi Claude API với tool_use + validate changes compile + generate diff.

**Stories:**
- 3.1 — Claude Client, Prompt Builder & AST Applier
- 3.2 — TypeScript Checker, Retry & Diff Generator

---

## Epic 4: End-to-End Pipeline & CLI Output
Wire toàn bộ pipeline, format output đẹp cho terminal.

**Stories:**
- 4.1 — Full Pipeline & CLI Output Formatting

---
