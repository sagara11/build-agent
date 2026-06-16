# Kiến trúc Hệ thống — Refactoring & Design Pattern Agent

## 1. Vấn đề Kỹ thuật Cốt lõi

### Lý do không thể gửi toàn bộ folder lên LLM

| Vấn đề | Hệ quả |
|--------|--------|
| Token limit | Codebase thực tế 10k+ dòng → vượt context window |
| Chi phí cao | Gửi raw code = 10–50x token so với gửi structured summary |
| Kém chính xác | LLM sinh ra file:line không tồn tại; không có khả năng suy luận kiểu dữ liệu từ file khác |
| Rủi ro khi apply fix | Không thể xác định thay đổi tại file A có gây lỗi tại file B hay không |

---

## 2. Tổng quan Kiến trúc 4 Tầng

```mermaid
flowchart TD
    INPUT([📁 Toàn bộ folder\nGit repo / Zip / Single file])

    subgraph T1["🔍 Tầng 1 — Project Indexer  (Không dùng LLM)"]
        direction TB
        PARSE[Parse AST tất cả file\nts-morph / @typescript-eslint/parser]
        SYM[Xây dựng Symbol Table\nclass · method · type · return type]
        DEP[Xây dựng Dependency Graph\nimport A từ B · B phụ thuộc C]
        CALC[Tính Metrics\nLOC · cyclomatic complexity · coupling]
        PARSE --> SYM --> DEP --> CALC
    end

    subgraph T2["✂️ Tầng 2 — Detectors + Context Slicer  (Không dùng LLM)"]
        direction TB
        DETECT[Chạy Detector Chain\nGod Class · Duplication · High Complexity\nIF-ELSE Chain · Manual Factory]
        SLICE[Context Slicer\nTrích xuất minimal context cho mỗi vấn đề\n~600 token thay vì ~8000 token]
        DETECT --> SLICE
    end

    subgraph T3["🤖 Tầng 3 — Claude API"]
        direction TB
        PROMPT[Prompt Builder\nAST summary + detected issues]
        CLAUDE[claude-sonnet-4-5\nPhân tích · Diễn giải · Đề xuất fix]
        PARSE_OUT[AST Diff Parser\nparse structured output → action list]
        PROMPT --> CLAUDE --> PARSE_OUT
    end

    subgraph T4["✅ Tầng 4 — Fix Validator  (Không dùng LLM)"]
        direction TB
        SANDBOX[Apply AST Changes\nvào sandbox project]
        TSC{tsc type-check\ntoàn project}
        DIFF[Generate Unified Diff\nfile:line level]
        RETRY[Retry với Claude\nkèm error message]
        SANDBOX --> TSC
        TSC -->|Pass| DIFF
        TSC -->|Fail| RETRY
        RETRY -->|Revised changes| SANDBOX
    end

    OUTPUT([📋 JSON Response\nfindings · diff · compilable: true])

    INPUT --> T1 --> T2 --> T3 --> T4 --> OUTPUT
```

---

## 3. Sequence Diagram — Luồng Xử lý một Request

```mermaid
sequenceDiagram
    actor Client
    participant API as API Layer (NestJS)
    participant IDX as Project Indexer
    participant DET as Detectors
    participant SLC as Context Slicer
    participant LLM as Claude API
    participant VAL as Fix Validator

    Client->>API: POST /v1/analyze (zip hoặc repoUrl)

    note over API,DET: ── Tầng 1: Project Indexer – Không dùng LLM ──
    API->>IDX: index toàn bộ project
    IDX->>IDX: parse AST tất cả .ts/.tsx/.js
    IDX->>IDX: build symbol table
    IDX->>IDX: build dependency graph
    IDX->>IDX: tính metrics (LOC, complexity, coupling)
    IDX-->>DET: project graph + metrics
    DET->>DET: chạy detector chain
    DET-->>SLC: danh sách smells + pattern candidates

    note over SLC: ── Tầng 2: Context Slicer – Không dùng LLM ──
    SLC->>SLC: với mỗi issue: trích xuất minimal context
    SLC->>SLC: lấy type signatures của dependencies
    note right of SLC: ~600 token/issue vs ~8000 token raw code

    note over SLC,LLM: ── Tầng 3: Claude API ──
    SLC->>LLM: context đã trích xuất + detected issues
    LLM->>LLM: phân tích cấu trúc
    LLM->>LLM: generate AST diff (không phải file rewrite)
    LLM-->>VAL: structured action list [extract_class, replace_node...]

    note over VAL: ── Tầng 4: Fix Validator – Không dùng LLM ──
    VAL->>VAL: apply changes vào sandbox
    VAL->>VAL: tsc type-check toàn project
    alt Compile pass
        VAL->>VAL: generate unified diff
        VAL-->>API: findings + diff + compilable: true
    else Compile fail (tối đa 2 retry)
        VAL->>LLM: error message + context
        LLM-->>VAL: revised AST changes
        VAL->>VAL: retry apply + type-check
    end

    API-->>Client: JSON response (findings, diff, validated: true)
```

---

## 4. Context Slicer — Lý do chỉ gửi 600 token

```mermaid
flowchart LR
    ISSUE([Phát hiện:\nGod Class\nUserService.ts])

    subgraph FULL["❌ Gửi toàn bộ context"]
        direction TB
        F1[UserService.ts\n420 dòng]
        F2[UserRepository.ts\n180 dòng]
        F3[MailService.ts\n150 dòng]
        F4[PaymentService.ts\n200 dòng]
        F5[... 20 file khác]
        TOTAL1[≈ 8000+ token\n💸 Chi phí cao · Dữ liệu nhiễu · Kém chính xác]
    end

    subgraph SLICE["✅ Context Slicer trích xuất"]
        direction TB
        S1[Full code UserService.ts\n420 dòng — file có vấn đề]
        S2[Type signatures UserRepository\nchỉ interface · 8 dòng]
        S3[Type signatures MailService\nchỉ interface · 5 dòng]
        S4[Metrics đã tính:\nlines:420 · methods:18 · deps:3]
        TOTAL2[≈ 600 token\n✅ Tập trung · Chính xác · Tiết kiệm]
    end

    ISSUE --> FULL
    ISSUE --> SLICE
```

---

## 5. Fix Validator — Lý do dùng AST Diff thay vì File Rewrite

```mermaid
flowchart TD
    subgraph WRONG["❌ Phương pháp không khuyến nghị — File Rewrite"]
        W1["Prompt: UserService.ts\nThực hiện refactor toàn bộ file"]
        W2["Claude trả về:\ntoàn bộ file mới 420 dòng"]
        W3[Vấn đề:]
        W4[Claude sửa code ngoài phạm vi yêu cầu\nClaude thêm logic không có trong bản gốc\nKhông thể diff chính xác\nKhông validate được từng thay đổi riêng lẻ]
        W1 --> W2 --> W3 --> W4
    end

    subgraph RIGHT["✅ Phương pháp khuyến nghị — AST Diff"]
        R1["Prompt: Class có 18 method\nthuộc 3 nhóm trách nhiệm\nTrả về danh sách AST actions"]
        R2["Claude trả về:\nstructured action list"]
        R3["[\n  { action: extract_class,\n    methods: processPayment,\n    newFile: payment.service.ts },\n  { action: extract_class,\n    methods: sendWelcomeEmail,\n    newFile: mail-notification.service.ts }\n]"]
        R4[Apply vào sandbox\n→ tsc type-check\n→ generate unified diff]
        R1 --> R2 --> R3 --> R4
    end
```

---

## 6. Modernization Pipeline — Callback Hell → Async/Await

```mermaid
sequenceDiagram
    participant DET as Detector
    participant SLC as Context Slicer
    participant LLM as Claude API
    participant AST as ts-morph
    participant TSC as TypeScript Compiler

    DET->>DET: phát hiện CallExpression\nvới argument là function (callback pattern)
    DET->>SLC: node cần transform

    SLC->>SLC: trích xuất chỉ function đó\n+ type của callback arguments
    note right of SLC: Tier 1 rules trước:\nvar→const, require→import\n(không cần LLM)

    SLC->>LLM: đoạn code nhỏ + instruction cụ thể:\n"Chuyển đổi sang async/await.\nGiữ nguyên tên biến.\nGiữ nguyên error handling.\nChỉ trả về code đã transform."

    LLM-->>AST: transformed code block

    AST->>AST: thay thế chính xác node đó\ntrong AST (không ảnh hưởng đến code xung quanh)

    AST->>TSC: type-check toàn project
    alt Pass
        TSC-->>AST: ✅ compilable: true
        AST-->>DET: diff { linesAffected: [12, 18, 25] }
    else Fail
        TSC-->>LLM: error details
        LLM-->>AST: revised transform
    end
```

---

## 7. Cấu trúc Module

```mermaid
flowchart TD
    subgraph API["api/"]
        CTL[analyze.controller.ts]
        SVC[analyze.service.ts]
        DTO[analyze.dto.ts]
    end

    subgraph IDX["indexer/"]
        PI[project-indexer.ts]
        STB[symbol-table-builder.ts]
        DGB[dependency-graph-builder.ts]
        MC[metrics-calculator.ts]
    end

    subgraph DET["detectors/"]
        subgraph SMELL["smell-detectors/"]
            GC[god-class-detector.ts]
            LM[long-method-detector.ts]
            HC[high-complexity-detector.ts]
            DC[duplicated-code-detector.ts]
        end
        subgraph PAT["pattern-candidates/"]
            IEC[if-else-chain-detector.ts]
            MF[manual-factory-detector.ts]
        end
    end

    subgraph SLC["slicer/"]
        CS[context-slicer.ts]
        TSE[type-signature-extractor.ts]
    end

    subgraph LLM_MOD["llm/"]
        CC[claude-client.ts]
        PB[prompt-builder.ts]
        ADP[ast-diff-parser.ts]
    end

    subgraph VAL_MOD["validator/"]
        FV[fix-validator.ts]
        AA[ast-applier.ts]
        TC[typescript-checker.ts]
        DG[diff-generator.ts]
    end

    CTL --> SVC
    SVC --> PI
    PI --> STB & DGB & MC
    SVC --> GC & LM & HC & DC & IEC & MF
    SVC --> CS
    CS --> TSE
    SVC --> CC
    CC --> PB --> ADP
    SVC --> FV
    FV --> AA --> TC --> DG
```

---

## 8. Tech Stack

| Tầng | Công nghệ | Lý do |
|------|----------|-------|
| API Framework | NestJS (TypeScript) | Module hóa, DI, phù hợp dịch vụ B2B |
| AST + Type System | `ts-morph` | TypeScript Language Service đầy đủ, type-aware |
| JS/JSX không có types | `@typescript-eslint/parser` | Xử lý plain JS, JSX, decorator |
| Duplication | `jscpd` (library mode) | Token fingerprint, cross-file detection |
| LLM Client | `@anthropic-ai/sdk` | Official SDK — HTTP, auto-retry, streaming, tool_use |
| LLM Model | `claude-sonnet-4-5` | Context window lớn, hiểu code tốt |
| Schema validation | `zod` | Type-safe API contract |
| Testing | Vitest + Supertest | Unit + integration test |
| Runtime | Node.js 20 LTS | Cùng hệ sinh thái với target codebase |

---

## 9. Cấu trúc Thư mục Dự án

```
src/
├── main.ts
├── app.module.ts
│
├── api/                                  # HTTP layer
│   ├── api.module.ts
│   ├── analyze.controller.ts
│   ├── analyze.service.ts
│   └── dto/
│       ├── analyze-request.dto.ts
│       └── analyze-response.dto.ts
│
├── indexer/                              # Tầng 1 — Project Indexer (không dùng LLM)
│   ├── indexer.module.ts
│   ├── project-indexer.ts
│   ├── symbol-table-builder.ts
│   ├── dependency-graph-builder.ts
│   └── metrics-calculator.ts
│
├── detectors/                            # Tầng 2 — Detectors (không dùng LLM)
│   ├── detectors.module.ts
│   ├── base-detector.ts
│   ├── smell-detectors/
│   │   ├── god-class-detector.ts
│   │   ├── long-method-detector.ts
│   │   ├── high-complexity-detector.ts
│   │   └── duplicated-code-detector.ts
│   └── pattern-candidates/
│       ├── if-else-chain-detector.ts
│       └── manual-factory-detector.ts
│
├── slicer/                               # Tầng 2 — Context Slicer (không dùng LLM)
│   ├── slicer.module.ts
│   ├── context-slicer.ts
│   └── type-signature-extractor.ts
│
├── llm/                                  # Tầng 3 — Claude API
│   ├── llm.module.ts
│   ├── claude-client.ts
│   ├── prompt-builder.ts
│   └── ast-diff-parser.ts
│
├── validator/                            # Tầng 4 — Fix Validator (không dùng LLM)
│   ├── validator.module.ts
│   ├── fix-validator.ts
│   ├── ast-applier.ts
│   ├── typescript-checker.ts
│   └── diff-generator.ts
│
└── common/
    ├── types/
    │   ├── analysis-job.types.ts
    │   ├── finding.types.ts
    │   └── ast-action.types.ts
    └── exceptions/
        └── analysis.exception.ts

test/
├── e2e/
│   └── analyze.e2e-spec.ts
└── unit/
    ├── detectors/
    │   ├── god-class-detector.spec.ts
    │   └── high-complexity-detector.spec.ts
    └── indexer/
        └── project-indexer.spec.ts
```

---

## 10. Thiết kế Cơ sở Dữ liệu

### Entity Relationship Diagram

```mermaid
erDiagram
    organizations {
        uuid id PK
        varchar name
        varchar slug
        enum plan
        timestamp created_at
        timestamp updated_at
    }
    api_keys {
        uuid id PK
        uuid organization_id FK
        varchar name
        varchar key_hash
        varchar key_prefix
        jsonb scopes
        timestamp expires_at
        timestamp last_used_at
        timestamp revoked_at
        timestamp created_at
    }
    analysis_jobs {
        uuid id PK
        uuid organization_id FK
        uuid api_key_id FK
        enum status
        enum input_type
        varchar input_ref
        enum analysis_mode
        text error_message
        timestamp queued_at
        timestamp started_at
        timestamp completed_at
        integer processing_ms
        timestamp created_at
    }
    analysis_results {
        uuid id PK
        uuid job_id FK
        integer findings_count
        boolean compilable
        integer token_input
        integer token_output
        jsonb findings
        text diff
        timestamp created_at
    }
    findings {
        uuid id PK
        uuid job_id FK
        uuid organization_id FK
        enum smell_type
        varchar file_path
        integer line_start
        integer line_end
        enum severity
        varchar pattern_suggestion
        decimal confidence_score
        timestamp created_at
    }
    usage_snapshots {
        uuid id PK
        uuid organization_id FK
        smallint period_year
        smallint period_month
        integer api_calls_count
        integer files_analyzed_count
        integer total_input_tokens
        integer total_output_tokens
        timestamp created_at
    }

    organizations ||--o{ api_keys : "sở hữu"
    organizations ||--o{ analysis_jobs : "thực hiện"
    organizations ||--o{ findings : "tích lũy"
    organizations ||--o{ usage_snapshots : "theo dõi"
    api_keys ||--o{ analysis_jobs : "xác thực"
    analysis_jobs ||--|| analysis_results : "sinh ra"
    analysis_jobs ||--o{ findings : "chứa"
```

### Mô tả Bảng

| Bảng | Mục đích |
|------|---------|
| `organizations` | Tenant B2B — mỗi công ty khách hàng là một record |
| `api_keys` | Quản lý xác thực; lưu hash, không lưu key thật; hỗ trợ revoke |
| `analysis_jobs` | Theo dõi vòng đời mỗi request phân tích (queued → processing → completed/failed) |
| `analysis_results` | Kết quả đầy đủ của job: findings JSON, unified diff, trạng thái compile |
| `findings` | Bản ghi denormalized từng vấn đề phát hiện — phục vụ query xu hướng và báo cáo |
| `usage_snapshots` | Tổng hợp theo tháng phục vụ billing và rate limiting |

### Enum Values

| Enum | Giá trị |
|------|--------|
| `organizations.plan` | `free`, `pro`, `enterprise` |
| `analysis_jobs.status` | `queued`, `processing`, `completed`, `failed` |
| `analysis_jobs.input_type` | `zip`, `repo_url`, `single_file` |
| `analysis_jobs.analysis_mode` | `smell_detect`, `pattern_suggest`, `modernize`, `full` |
| `findings.smell_type` | `god_class`, `long_method`, `high_complexity`, `duplicated_code`, `feature_envy` |
| `findings.severity` | `low`, `medium`, `high`, `critical` |

---

## 11. Chi tiết Module LLM — `@anthropic-ai/sdk`

### 11.1. Tại sao `@anthropic-ai/sdk`, không dùng LangChain hay Vercel AI SDK

| Package | Đánh giá |
|---------|---------|
| `@anthropic-ai/sdk` | ✅ Official, thin wrapper, đủ feature (tool_use, streaming, retry), không overhead |
| `langchain` | ❌ Abstraction nhiều tầng, khó debug khi cần control chính xác prompt |
| `ai` (Vercel AI SDK) | ❌ Tối ưu cho streaming UI, không phù hợp NestJS service thuần backend |

---

### 11.2. Vấn đề cốt lõi — Tại sao `tool_use` thay thế `ast-diff-parser.ts`

Với phương pháp **text/JSON tự parse** (cũ):

```
Claude trả về:
"Tôi đề xuất trích xuất các method sau:
{ action: "extract_class", methods: ["processPayment"] ... }"
```

Vấn đề: Claude đôi khi thêm text thừa, sai JSON syntax → `ast-diff-parser.ts` phải xử lý nhiều edge case, dễ fail.

Với **`tool_use`** (mới): SDK *force* Claude phải gọi tool theo schema đã định nghĩa → response luôn là validated JSON, không có text thừa.

---

### 11.3. Tool Schema cho AST Actions

`claude-client.ts` định nghĩa tool này và truyền vào mỗi request:

```typescript
const AST_DIFF_TOOL: Anthropic.Tool = {
  name: 'apply_ast_changes',
  description: 'Return a structured list of AST transformations to apply to the codebase',
  input_schema: {
    type: 'object' as const,
    properties: {
      actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['extract_class', 'extract_method', 'replace_node', 'convert_async', 'rename_symbol']
            },
            targetFile: { type: 'string', description: 'Relative path of file to modify' },
            newFile:    { type: 'string', description: 'New file path when extracting class/method' },
            methods:    { type: 'array', items: { type: 'string' }, description: 'Method names to move' },
            nodeId:     { type: 'string', description: 'Unique node identifier from AST summary' },
            transformed:{ type: 'string', description: 'Transformed code block for replace_node / convert_async' }
          },
          required: ['action', 'targetFile']
        }
      },
      rationale: {
        type: 'string',
        description: 'One-sentence explanation of why these changes fix the detected issue'
      }
    },
    required: ['actions', 'rationale']
  }
}
```

---

### 11.4. Luồng gọi trong `claude-client.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk'

export class ClaudeClient {
  private client: Anthropic

  constructor() {
    this.client = new Anthropic()  // đọc ANTHROPIC_API_KEY từ env tự động
  }

  async analyzeIssue(prompt: string): Promise<AstActionList> {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      tools: [AST_DIFF_TOOL],
      tool_choice: { type: 'any' },  // force Claude phải dùng tool, không được trả text thuần
      messages: [{ role: 'user', content: prompt }]
    })

    const toolUse = response.content.find(b => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new AnalysisException('Claude did not return tool_use block')
    }

    return toolUse.input as AstActionList  // đã validated bởi SDK — không cần parse thêm
  }
}
```

---

### 11.5. Tác động đến Module `llm/`

| File | Vai trò sau khi dùng SDK |
|------|--------------------------|
| `claude-client.ts` | Khởi tạo `Anthropic()`, gọi `messages.create`, trả về `toolUse.input` |
| `prompt-builder.ts` | Vẫn cần — build message content từ AST summary + detected issues |
| `ast-diff-parser.ts` | **Bỏ** — tool_use đã thay thế hoàn toàn; chỉ cần cast type |

```mermaid
flowchart LR
    PB[prompt-builder.ts\nBuild messages content] --> CC
    CC[claude-client.ts\nAnthropic SDK\ntool_choice: any] --> SDK[SDK validates\nJSON Schema]
    SDK --> OUT[AstActionList\nready to use]
```

---

### 11.6. Retry khi Claude trả về fix không compile (Tầng 4)

SDK tự retry HTTP 5xx. Tầng 4 cần retry ở tầng business logic (compile fail):

```typescript
async analyzeWithRetry(prompt: string, maxRetries = 2): Promise<AstActionList> {
  let lastError: string | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const fullPrompt = lastError
      ? `${prompt}\n\nPrevious attempt failed TypeScript compilation:\n${lastError}\nPlease revise.`
      : prompt

    const actions = await this.analyzeIssue(fullPrompt)
    const result = await this.fixValidator.validate(actions)

    if (result.compilable) return actions
    lastError = result.errorMessage
  }

  throw new AnalysisException(`Failed after ${maxRetries} retries`)
}
```

---

## 12. Câu hỏi Còn mở

- Validate `compilable` dùng `tsc` (đầy đủ nhưng chậm ~3–5s) hay chỉ parse-check (nhanh ~200ms)?
- Xử lý project không có `tsconfig.json` (plain JS) như thế nào?
- Retry strategy khi Claude trả về fix không compile: gửi lại error message hay escalate lên model có năng lực cao hơn?
- Sandbox khi apply changes: dùng in-memory virtual FS hay temp directory?
