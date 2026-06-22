# Bộ Luật Tổng Hợp — Refactoring & Design Pattern Agent
> Tài liệu index và hướng dẫn tích hợp  
> Ngôn ngữ: JavaScript / TypeScript | Phiên bản: 1.0

---

## Tổng quan hệ thống tài liệu

```
code-review-agent-docs/
├── 00-index.md                     ← File này — tổng quan & hướng dẫn tích hợp
├── 01-code-smells-rulebook.md      ← 10 Code Smells + ngưỡng phát hiện + before/after
├── 02-design-patterns-rulebook.md  ← 10 Design Patterns + trigger conditions + before/after
└── 03-modernization-rulebook.md    ← 10 Legacy patterns + migration guide
```

---

## Kiến trúc Agent 3 tầng

```
┌─────────────────────────────────────────────────┐
│              INPUT: Code Snippet / File           │
└──────────────────────┬──────────────────────────┘
                       │
          ┌────────────▼────────────┐
          │    Tầng 1: Detection    │
          │  (Static Analysis +     │
          │   AST Pattern Match)    │
          └────────────┬────────────┘
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
┌──────────┐   ┌──────────────┐   ┌──────────────┐
│  Code    │   │   Design     │   │Modernization │
│  Smell   │   │   Pattern    │   │   Agent      │
│  Agent   │   │   Agent      │   │              │
│  (doc 1) │   │  (doc 2)     │   │  (doc 3)     │
└────┬─────┘   └──────┬───────┘   └──────┬───────┘
     │                │                  │
     └────────────────┼──────────────────┘
                      │
          ┌───────────▼───────────┐
          │   Tầng 3: Synthesis   │
          │  Aggregate + Rank +   │
          │  Format Output        │
          └───────────┬───────────┘
                      │
┌─────────────────────▼─────────────────────────────┐
│  OUTPUT: Structured Review (JSON + Markdown)       │
└────────────────────────────────────────────────────┘
```

---

## Cấu trúc Output chuẩn

Mọi phản hồi của agent đều theo format sau:

```typescript
// types/review-output.types.ts
export interface CodeReviewOutput {
  metadata: {
    file: string;
    language: 'typescript' | 'javascript';
    analyzedAt: string;
    totalIssues: number;
    overallScore: number; // 0-100
  };

  issues: ReviewIssue[];

  summary: {
    critical: number;   // severity === 'ERROR'
    warnings: number;   // severity === 'WARNING'
    suggestions: number; // severity === 'INFO'
  };

  prioritizedActions: string[]; // Top 3 hành động cần làm ngay
}

export interface ReviewIssue {
  id: string; // unique ID để reference trong comments
  category: 'CODE_SMELL' | 'DESIGN_PATTERN' | 'MODERNIZATION';
  type: string; // e.g., 'GOD_CLASS', 'STRATEGY_PATTERN_NEEDED', 'CALLBACK_HELL'
  severity: 'ERROR' | 'WARNING' | 'INFO';

  location: {
    startLine: number;
    endLine: number;
    identifier?: string; // tên class/function nếu có
  };

  diagnosis: {
    title: string;
    description: string;
    metric?: { current: number; threshold: number; unit: string };
  };

  recommendation: {
    patternToApply?: string;
    summary: string;       // 1-2 câu gợi ý
    codeAfter?: string;    // Code mẫu sau khi refactor
    effort: 'LOW' | 'MEDIUM' | 'HIGH';
    breakingChange: boolean;
  };

  references: string[]; // Link doc, MDN, refactoring.guru
}
```

---

## System Prompt tổng hợp (dùng cho Agent chính)

```typescript
// prompts/master-system-prompt.ts
export const MASTER_SYSTEM_PROMPT = `
Bạn là một senior TypeScript/JavaScript engineer và code quality specialist.
Nhiệm vụ của bạn là phân tích code và cung cấp đánh giá chất lượng toàn diện.

## Quy trình phân tích (LUÔN theo thứ tự này):

### Bước 1 — Phân tích Code Smell
Kiểm tra theo bộ luật trong file "01-code-smells-rulebook.md":
- God Class (> 15 methods hoặc > 300 LOC)
- Duplicated Code (≥ 4 dòng giống nhau)
- Long Method (> 30 LOC hoặc > 4 params)
- High Cyclomatic Complexity (score > 10)
- Feature Envy, Data Clumps, Primitive Obsession
- Shotgun Surgery, Dead Code, Magic Values

### Bước 2 — Gợi ý Design Pattern
Kiểm tra theo bộ luật trong file "02-design-patterns-rulebook.md":
- if/else ≥ 3 nhánh → Strategy Pattern
- new + điều kiện → Factory Pattern
- Side effects sau action → Observer Pattern
- Query DB trong service → Repository Pattern
- Cross-cutting concerns → Decorator Pattern
- Cần undo/audit → Command Pattern
- Constructor > 4 params → Builder Pattern
- Controller biết quá nhiều → Facade Pattern
- Chuỗi kiểm tra → Chain of Responsibility

### Bước 3 — Phát hiện Code Cũ
Kiểm tra theo bộ luật trong file "03-modernization-rulebook.md":
- Callback hell, Promise chains
- CommonJS, var usage
- Class components, untyped errors
- Console.log, manual type assertions

### Bước 4 — Tổng hợp kết quả
Trả về JSON theo schema CodeReviewOutput.
Sắp xếp issues theo mức độ: ERROR → WARNING → INFO.
Giới hạn prioritizedActions tối đa 3 items.

## Nguyên tắc
- Chỉ flag issues khi CHẮC CHẮN, confidence > 0.7
- Không over-engineer: đừng gợi ý pattern cho code đơn giản
- Mỗi suggestion phải có codeAfter cụ thể, không chung chung
- Ưu tiên fixes có impact cao và effort thấp

Chỉ trả về JSON, không thêm markdown hay text giải thích.
`;
```

---

## Bảng tra cứu nhanh — Severity Rules

### ERROR (phải fix trước khi merge)
| Loại | Điều kiện |
|------|-----------|
| God Class | > 30 methods HOẶC > 600 LOC |
| High Complexity | Cyclomatic complexity > 20 |
| Callback Hell | Lồng ≥ 4 tầng |
| Unsafe Type Cast | `as any` hoặc `as unknown as X` |
| Magic Secret | Hardcode password/key/token |

### WARNING (fix trong sprint hiện tại)
| Loại | Điều kiện |
|------|-----------|
| God Class | > 15 methods HOẶC > 300 LOC |
| Long Method | > 30 LOC HOẶC > 4 params |
| High Complexity | Cyclomatic complexity 11-20 |
| Duplicated Code | ≥ 4 dòng giống nhau |
| Strategy Needed | if/else ≥ 3 nhánh với logic > 5 dòng/nhánh |
| Callback Hell | Lồng 3 tầng |

### INFO (backlog / khi có thời gian)
| Loại | Điều kiện |
|------|-----------|
| CommonJS | require() syntax |
| var Usage | Bất kỳ `var` nào |
| Console.log | Trong production code |
| Magic Numbers | Số literal không có tên |
| Feature Envy | ≥ 3 lần gọi getter của object khác |

---

## Ví dụ input/output hoàn chỉnh

### Input
```typescript
// user-manager.ts (file 450 LOC)
class UserManager {
  async processUser(userId: string, action: string) {
    var user = await db.query(`SELECT * FROM users WHERE id = '${userId}'`); // SQL injection!
    console.log('Processing:', userId, action);

    if (action === 'activate') {
      user.status = 'active';
      await db.query(`UPDATE users SET status = 'active' WHERE id = '${userId}'`);
      await sendEmail(user.email, 'Account activated');
      await stripe.subscriptions.create({ customer: user.stripeId, plan: 'basic' });
      await slack.postMessage({ channel: '#ops', text: `User ${userId} activated` });
    } else if (action === 'deactivate') {
      user.status = 'inactive';
      await db.query(`UPDATE users SET status = 'inactive' WHERE id = '${userId}'`);
      await sendEmail(user.email, 'Account deactivated');
      await stripe.subscriptions.cancel(user.subscriptionId);
    } else if (action === 'upgrade') {
      await stripe.subscriptions.update(user.subscriptionId, { plan: 'premium' });
      await sendEmail(user.email, 'Upgraded to premium');
    }
  }
  // ... 400 dòng nữa với nhiều methods không liên quan
}
```

### Output mong đợi
```json
{
  "metadata": {
    "file": "user-manager.ts",
    "language": "typescript",
    "totalIssues": 6,
    "overallScore": 28
  },
  "issues": [
    {
      "id": "issue-001",
      "category": "CODE_SMELL",
      "type": "GOD_CLASS",
      "severity": "ERROR",
      "location": { "startLine": 1, "endLine": 450, "identifier": "UserManager" },
      "diagnosis": {
        "title": "God Class — quá nhiều trách nhiệm",
        "metric": { "current": 450, "threshold": 300, "unit": "LOC" }
      },
      "recommendation": {
        "summary": "Tách UserManager thành UserService, PaymentService, NotificationService",
        "effort": "HIGH",
        "breakingChange": true
      }
    },
    {
      "id": "issue-002",
      "category": "CODE_SMELL",
      "type": "HIGH_CYCLOMATIC_COMPLEXITY",
      "severity": "ERROR",
      "location": { "startLine": 2, "endLine": 25, "identifier": "processUser" },
      "diagnosis": {
        "title": "Cyclomatic complexity quá cao",
        "metric": { "current": 14, "threshold": 10, "unit": "complexity score" }
      },
      "recommendation": {
        "patternToApply": "Strategy Pattern",
        "summary": "Tách mỗi action thành một Strategy class riêng",
        "effort": "MEDIUM",
        "breakingChange": false
      }
    },
    {
      "id": "issue-003",
      "category": "CODE_SMELL",
      "type": "MAGIC_STRINGS",
      "severity": "WARNING",
      "location": { "startLine": 5, "endLine": 5 },
      "diagnosis": { "title": "Magic string 'activate', 'deactivate', 'upgrade'" },
      "recommendation": {
        "summary": "Dùng enum UserAction { ACTIVATE = 'activate', ... }",
        "effort": "LOW",
        "breakingChange": false
      }
    }
  ],
  "summary": { "critical": 2, "warnings": 3, "suggestions": 1 },
  "prioritizedActions": [
    "Fix SQL injection: dùng parameterized queries ngay lập tức",
    "Tách UserManager thành các services nhỏ theo Single Responsibility Principle",
    "Áp dụng Strategy Pattern cho processUser để giảm complexity"
  ]
}
```

---

## Checklist tích hợp vào CI/CD

```yaml
# .github/workflows/code-review.yml
name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  ai-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Get changed TypeScript files
        id: changed-files
        run: |
          git diff --name-only origin/${{ github.base_ref }}...HEAD \
            | grep -E '\.(ts|tsx|js|jsx)$' > changed_files.txt
          echo "files=$(cat changed_files.txt | tr '\n' ',')" >> $GITHUB_OUTPUT

      - name: Run AI Code Review Agent
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          CHANGED_FILES: ${{ steps.changed-files.outputs.files }}
        run: |
          npx ts-node scripts/run-code-review.ts

      - name: Post Review Comments
        uses: actions/github-script@v7
        with:
          script: |
            const review = require('./review-output.json');
            // Post issues as PR review comments
            for (const issue of review.issues.filter(i => i.severity === 'ERROR')) {
              await github.rest.pulls.createReviewComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                pull_number: context.issue.number,
                body: `**${issue.diagnosis.title}**\n\n${issue.recommendation.summary}`,
                path: review.metadata.file,
                line: issue.location.endLine,
              });
            }
```
