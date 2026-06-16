# Ví dụ Walkthrough — God Class Detection & Fix

Tài liệu này mô tả từng bước hệ thống xử lý một file TypeScript thực tế có code smell **God Class**.

---

## Bước 0 — Input: File có vấn đề

`src/services/UserService.ts` — 420 dòng, 18 method thuộc 3 nhóm trách nhiệm khác nhau:

```typescript
export class UserService {
  constructor(
    private userRepo: UserRepository,
    private mailer: MailService,
    private stripe: StripeClient,
    private logger: Logger
  ) {}

  // --- Nhóm 1: User CRUD ---
  async findById(id: string): Promise<User> { ... }
  async updateProfile(id: string, dto: UpdateProfileDto): Promise<User> { ... }
  async deleteAccount(id: string): Promise<void> { ... }

  // --- Nhóm 2: Email / Notification ---
  async sendWelcomeEmail(user: User): Promise<void> { ... }
  async sendPasswordResetEmail(email: string): Promise<void> { ... }
  async sendInvoiceEmail(userId: string, invoiceId: string): Promise<void> { ... }

  // --- Nhóm 3: Payment ---
  async createSubscription(userId: string, planId: string): Promise<Subscription> { ... }
  async cancelSubscription(userId: string): Promise<void> { ... }
  async processPayment(userId: string, amount: number): Promise<PaymentResult> { ... }
  async getInvoices(userId: string): Promise<Invoice[]> { ... }

  // ... 8 method khác
}
```

---

## Bước 1 — Tầng 1: Project Indexer (không dùng LLM)

`project-indexer.ts` parse toàn bộ project bằng `ts-morph`, build ra:

### Symbol Table (trích)

```json
{
  "UserService": {
    "kind": "class",
    "file": "src/services/UserService.ts",
    "methods": [
      { "name": "findById",             "returnType": "Promise<User>",         "params": ["id: string"] },
      { "name": "sendWelcomeEmail",     "returnType": "Promise<void>",         "params": ["user: User"] },
      { "name": "createSubscription",   "returnType": "Promise<Subscription>", "params": ["userId: string", "planId: string"] }
    ],
    "constructorDeps": ["UserRepository", "MailService", "StripeClient", "Logger"]
  }
}
```

### Dependency Graph

```
UserService
  └── UserRepository   (imports: 1 file)
  └── MailService      (imports: 1 file)
  └── StripeClient     (imports: 1 file)
  └── Logger           (imports: 1 file)
```

### Metrics tính được

| Metric | Giá trị | Ngưỡng cảnh báo |
|--------|---------|-----------------|
| Lines of code | 420 | > 300 |
| Method count | 18 | > 10 |
| Constructor deps (coupling) | 4 | > 3 |
| Cyclomatic complexity (avg) | 3.2 | > 5 |

---

## Bước 2 — Tầng 2: Detector Chain (không dùng LLM)

`god-class-detector.ts` chạy rule:

```
LOC > 300 AND methods > 10 AND coupling > 3
→ GodClass confirmed
```

Output finding:

```json
{
  "smellType": "god_class",
  "file": "src/services/UserService.ts",
  "lineStart": 1,
  "lineEnd": 420,
  "severity": "high",
  "metrics": {
    "loc": 420,
    "methodCount": 18,
    "coupling": 4
  },
  "responsibilityGroups": [
    { "label": "user_crud",    "methods": ["findById", "updateProfile", "deleteAccount"] },
    { "label": "notification", "methods": ["sendWelcomeEmail", "sendPasswordResetEmail", "sendInvoiceEmail"] },
    { "label": "payment",      "methods": ["createSubscription", "cancelSubscription", "processPayment", "getInvoices"] }
  ]
}
```

---

## Bước 3 — Tầng 2: Context Slicer (không dùng LLM)

`context-slicer.ts` trích xuất **minimal context** để gửi lên LLM:

| Thành phần | Nội dung | Token ước tính |
|-----------|---------|---------------|
| Full source của `UserService.ts` | 420 dòng code | ~480 token |
| Type signature của `UserRepository` | interface, 6 method signatures | ~40 token |
| Type signature của `MailService` | interface, 4 method signatures | ~30 token |
| Type signature của `StripeClient` | interface, 5 method signatures | ~35 token |
| Metrics summary | JSON nhỏ | ~20 token |
| **Tổng** | | **~605 token** |

So sánh: gửi raw toàn bộ 5 file = **~8.200 token** (13.5× đắt hơn).

Extracted type signatures (ví dụ):

```typescript
// UserRepository — chỉ gửi interface, không gửi implementation
interface UserRepository {
  findById(id: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  save(user: User): Promise<User>
  delete(id: string): Promise<void>
}
```

---

## Bước 4 — Tầng 3: Prompt Builder → Claude API

`prompt-builder.ts` ghép context thành message. Nội dung gửi lên Claude:

```
You are a TypeScript refactoring expert.

DETECTED ISSUE: god_class in UserService.ts
- LOC: 420, Methods: 18, Constructor deps: 4
- Responsibility groups identified:
  - user_crud: findById, updateProfile, deleteAccount
  - notification: sendWelcomeEmail, sendPasswordResetEmail, sendInvoiceEmail
  - payment: createSubscription, cancelSubscription, processPayment, getInvoices

SOURCE FILE (UserService.ts):
[... 420 dòng code ...]

DEPENDENCY TYPE SIGNATURES:
[... interface UserRepository, MailService, StripeClient ...]

Use the apply_ast_changes tool to return the exact transformations needed.
Keep existing method implementations intact. Only restructure ownership.
```

Claude được gọi với `tool_choice: { type: 'any' }` → **bắt buộc** trả về tool_use block.

---

## Bước 5 — Claude trả về `tool_use` block

SDK nhận response, trích `toolUse.input` — đã validated theo schema:

```json
{
  "actions": [
    {
      "action": "extract_class",
      "targetFile": "src/services/UserService.ts",
      "newFile": "src/services/mail-notification.service.ts",
      "methods": ["sendWelcomeEmail", "sendPasswordResetEmail", "sendInvoiceEmail"]
    },
    {
      "action": "extract_class",
      "targetFile": "src/services/UserService.ts",
      "newFile": "src/services/payment.service.ts",
      "methods": ["createSubscription", "cancelSubscription", "processPayment", "getInvoices"]
    },
    {
      "action": "rename_symbol",
      "targetFile": "src/services/UserService.ts",
      "nodeId": "class:UserService",
      "transformed": "UserCrudService"
    }
  ],
  "rationale": "UserService has 3 distinct responsibility groups; extracting notification and payment logic reduces coupling from 4 to 1 dependency per class."
}
```

Không cần parse — `toolUse.input.actions` đã là typed object.

---

## Bước 6 — Tầng 4: Fix Validator

### 6a. Apply AST Changes (sandbox)

`ast-applier.ts` dùng `ts-morph` thực hiện từng action:

1. `extract_class` → tạo file `mail-notification.service.ts`, move 3 method, update constructor
2. `extract_class` → tạo file `payment.service.ts`, move 4 method, update constructor
3. `rename_symbol` → đổi tên class `UserService` → `UserCrudService` trong toàn project

Tất cả thay đổi apply vào **temp directory** (sandbox), không đụng source gốc.

### 6b. TypeScript Compiler Check

`typescript-checker.ts` chạy `tsc --noEmit` trên sandbox:

```
✅ 0 errors — compilable: true
```

Nếu có lỗi (ví dụ type mismatch), `fix-validator.ts` gửi lại Claude kèm error message (tối đa 2 retry).

### 6c. Generate Unified Diff

`diff-generator.ts` so sánh sandbox vs source gốc:

```diff
--- a/src/services/UserService.ts
+++ b/src/services/UserCrudService.ts
@@ -1,6 +1,4 @@
-export class UserService {
+export class UserCrudService {
   constructor(
     private userRepo: UserRepository,
-    private mailer: MailService,
-    private stripe: StripeClient,
     private logger: Logger

+++ b/src/services/mail-notification.service.ts (new)
@@ -0,0 +1,42 @@
+export class MailNotificationService {
+  constructor(private mailer: MailService) {}
+
+  async sendWelcomeEmail(user: User): Promise<void> { ... }
...

+++ b/src/services/payment.service.ts (new)
@@ -0,0 +1,58 @@
+export class PaymentService {
+  constructor(private stripe: StripeClient) {}
+
+  async createSubscription(...): Promise<Subscription> { ... }
...
```

---

## Bước 7 — Response trả về Client

```json
{
  "jobId": "job_01J...",
  "status": "completed",
  "compilable": true,
  "findings": [
    {
      "smellType": "god_class",
      "file": "src/services/UserService.ts",
      "severity": "high",
      "confidenceScore": 0.97,
      "patternSuggestion": "Extract MailNotificationService + PaymentService",
      "rationale": "UserService has 3 distinct responsibility groups; extracting notification and payment logic reduces coupling from 4 to 1 dependency per class."
    }
  ],
  "diff": "--- a/src/services/UserService.ts\n+++ ...",
  "tokenUsage": {
    "input": 612,
    "output": 380
  },
  "processingMs": 3240
}
```

---

## Tóm tắt Luồng

```
UserService.ts (420 dòng)
  │
  ▼ Tầng 1 — Indexer
  Symbol Table + Dependency Graph + Metrics (LOC:420, methods:18, coupling:4)
  │
  ▼ Tầng 2 — God Class Detector
  Finding: god_class, severity:high, 3 responsibility groups
  │
  ▼ Tầng 2 — Context Slicer
  605 token (thay vì 8.200 token raw)
  │
  ▼ Tầng 3 — Claude API (tool_use)
  3 actions: extract_class ×2 + rename_symbol
  │
  ▼ Tầng 4 — Fix Validator
  Apply sandbox → tsc ✅ → unified diff
  │
  ▼ Response
  { compilable: true, findings, diff, tokenUsage }
```
