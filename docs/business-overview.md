# Tổng quan Kinh doanh — Refactoring & Design Pattern Agent

## 1. Tầm nhìn Sản phẩm

Một dịch vụ API chạy bằng AI, phân tích codebase JavaScript/TypeScript theo yêu cầu và trả về các khuyến nghị tái cấu trúc có thể thực thi ngay — phát hiện code smell, đề xuất design pattern phù hợp, và hiện đại hóa các pattern code lỗi thời — tất cả thông qua mô hình tích hợp API B2B.

---

## 2. Vấn đề Cần giải quyết

### Thách thức Cốt lõi của Đội ngũ Phát triển

Các team phát triển tích lũy nợ kỹ thuật một cách âm thầm:
- Code review phát hiện bug nhưng hiếm khi nhận diện sự xuống cấp kiến trúc (God Class, callback hell, logic trùng lặp)
- Developer nhận thức được vấn đề chất lượng code nhưng thiếu từ ngữ chuẩn hoặc thời gian để diễn đạt
- Đề xuất của Copilot thiếu ngữ cảnh — hoàn thiện những gì đang viết, không phải những gì *nên* viết
- Refactor liên tục bị trì hoãn sang sprint kế tiếp cho đến khi cản trở tiến độ phát triển

### Hạn chế của Giải pháp Hiện tại

| Công cụ | Khả năng | Hạn chế |
|---------|----------|---------|
| ESLint / Prettier | Quy tắc style và cú pháp | Vấn đề thiết kế kiến trúc |
| SonarQube | Quality gate, chỉ số tĩnh | Đề xuất pattern, ví dụ code |
| GitHub Copilot | Autocomplete | Phê bình kiến trúc chủ động |
| CodeClimate | Điểm số độ phức tạp | Các bước tái cấu trúc có thể thực thi kèm code |

**Không công cụ nào cung cấp:** *"Class này có 400 dòng và 12 trách nhiệm — đây là cách phân tách thành 3 class sử dụng Repository + Service pattern, kèm code sau khi tái cấu trúc."*

---

## 3. Thị trường Mục tiêu

### Chính: B2B — Đội ngũ Kỹ thuật (5–100 developer)

**Đặc điểm:**
- Team duy trì backend Node.js (NestJS, Express) và frontend React
- Nợ kỹ thuật tích lũy đến mức làm chậm tốc độ phát triển tính năng mới
- Engineering Manager cần chỉ số chất lượng code có thể đo lường, không chỉ mang tính định tính
- Đang vận hành CI/CD pipeline và có nhu cầu tích hợp quality gate

**Thời điểm nhu cầu phát sinh:**
- Đánh giá chất lượng code trước sprint
- Onboarding kỹ sư mới (nắm bắt cấu trúc codebase hiện hữu)
- Kiểm soát chất lượng sau khi merge tính năng
- Sprint xử lý nợ kỹ thuật chuyên biệt

### Phụ: Nhà tích hợp Nền tảng

- Các nền tảng công cụ dành cho developer (Linear, plugin Jira, GitHub Apps)
- Nhà phát hành plugin IDE muốn tích hợp AI kiểm tra chất lượng code
- Công ty tư vấn cung cấp báo cáo chất lượng code cho khách hàng enterprise

---

## 4. Giá trị Mang lại

> **"Senior Architect review mọi PR — có thể gọi qua một API call."**

| Đối tượng | Giá trị nhận được |
|-----------|------------------|
| Developer | Phản hồi tức thì, cụ thể, kèm ví dụ code hoạt động được — không chỉ nhận xét đơn thuần |
| Engineering Manager | Chỉ số chất lượng khách quan và theo dõi xu hướng qua các PR |
| CTO / Kiến trúc sư | Áp dụng chuẩn kiến trúc ở quy mô lớn mà không cần review thủ công |
| Nhà tích hợp Nền tảng | Tích hợp khả năng kiểm tra code AI vào sản phẩm chỉ với một lần kết nối API |

---

## 5. Tính năng Cốt lõi

### Tính năng 1: Phát hiện Code Smell
Phân tích cấu trúc file/module và trả về các phát hiện có cấu trúc:
- **God Class** — class vượt ngưỡng trách nhiệm (số dòng, số method, số dependency)
- **Duplicated Code** — các khối code tương đồng về mặt ngữ nghĩa trên nhiều file
- **Cyclomatic Complexity cao** — hàm có số lượng nhánh rẽ vượt ngưỡng cho phép
- **Long Method** — method vượt ngưỡng khả năng đọc hiểu
- **Feature Envy** — method truy cập dữ liệu bên ngoài nhiều hơn dữ liệu nội tại của class

Đầu ra: JSON có cấu trúc với điểm mức độ nghiêm trọng, vị trí (file:dòng), mô tả và đánh giá tác động.

### Tính năng 2: Đề xuất Design Pattern
Vượt ra ngoài việc phát hiện — khuyến nghị *phương hướng xử lý*:
- Phát hiện chuỗi `if/else` hoặc `switch` theo kiểu → đề xuất **Strategy Pattern**
- Phát hiện khởi tạo đối tượng thủ công phân tán khắp codebase → đề xuất **Factory Pattern**
- Phát hiện god object điều phối nhiều hệ thống con → đề xuất **Facade Pattern**
- Mỗi đề xuất bao gồm: tên pattern, lý do áp dụng, **ví dụ code TypeScript trước/sau tái cấu trúc**

### Tính năng 3: Modernization Agent
Chuyển đổi các pattern JavaScript lỗi thời sang tương đương hiện đại:
- Callback hell → Async/Await với xử lý lỗi chuẩn
- `var` và function expression → `const/let` và arrow function
- React dựa trên class → Hooks và functional component
- Chuỗi Promise thô → async composition gọn hơn
- CommonJS `require()` → ES Module `import`

Đầu ra: code đã chuyển đổi kèm giải thích từng thay đổi.

---

## 6. Khác biệt Cạnh tranh

| Điểm khác biệt | so với SonarQube | so với Copilot | so với Review thủ công |
|----------------|-----------------|---------------|----------------------|
| Đề xuất pattern cụ thể kèm code | ✅ SQ không có đề xuất | ✅ Copilot phản ứng, không chủ động | ✅ Khả năng mở rộng vô hạn |
| Chuyên sâu hệ sinh thái JS/TS | ✅ SQ mang tính tổng quát | ✅ Ngang nhau | ✅ |
| Mô hình B2B API-first | ✅ SQ bị khóa vào nền tảng | ✅ Copilot bị khóa vào IDE | ✅ |
| Ví dụ code đã tái cấu trúc | ✅ | ✅ | ❌ Chi phí thời gian cao |

**Lợi thế cốt lõi:** Kết hợp phân tích cấu trúc AST xác định (deterministic) với khả năng diễn giải của Claude AI — mang lại cả *độ chính xác* (AST không sinh ra file:line sai lệch) lẫn *trí tuệ phân tích* (LLM giải thích lý do và hướng dẫn thực thi).

---

## 7. Mô hình Phân phối

**SaaS API-first** — tập trung phân khúc B2B.

Các hình thức tích hợp:
- **CI/CD gate**: Bước GitHub Action / GitLab CI gọi API khi có PR, đăng báo cáo dưới dạng PR comment
- **CLI tool**: `npx refactor-agent analyze ./src` để phân tích theo yêu cầu tại local
- **Plugin nền tảng**: Tích hợp vào Linear, Jira, hoặc công cụ nội bộ tùy chỉnh
- **Wrapper IDE**: Bên thứ ba có thể xây dựng VSCode extension trên nền API này

---

## 8. Chỉ số Thành công (MVP)

| Chỉ số | Mục tiêu |
|--------|---------|
| Thời gian phản hồi API (p95) | < 10 giây với file đến 500 dòng |
| Độ chính xác phát hiện (tỷ lệ true positive) | > 85% (xác thực thủ công trên bộ benchmark) |
| Tỷ lệ chấp nhận đề xuất pattern | > 60% (developer thực thi đề xuất) |
| Đầu ra Modernization biên dịch không lỗi | > 95% |

---

## 9. Rủi ro & Biện pháp Giảm thiểu

| Rủi ro | Xác suất | Tác động | Biện pháp |
|--------|---------|---------|-----------|
| LLM hallucination trong đề xuất code | Cao | Cao | Hybrid: AST xác thực cấu trúc, LLM chỉ sinh text và đề xuất |
| Chi phí token ảnh hưởng đến tính cạnh tranh của mô hình B2B | Trung bình | Cao | Tiền xử lý AST giảm ~70% lượng code gửi lên LLM |
| SonarQube bổ sung tính năng đề xuất pattern | Thấp | Trung bình | Tốc độ ra thị trường và chuyên sâu hệ sinh thái JS/TS |
| False positive làm suy giảm độ tin cậy | Cao | Cao | Confidence score, vòng phản hồi developer, ngưỡng cấu hình linh hoạt |

---

## 10. Câu hỏi Còn mở

- API có nên hỗ trợ streaming response (SSE) cho codebase lớn nhằm cải thiện trải nghiệm người dùng?
- Chiến lược định giá khi triển khai monetization — tính theo lần gọi API hay per-seat (theo số người dùng)?
- Phạm vi phân tích đa file: một file mỗi lần gọi hay toàn bộ repo mỗi lần gọi?
