# CLAUDE.md

Hướng dẫn cho Claude Code khi làm việc

## Giao tiếp

- **LUÔN** trao đổi với user bằng **tiếng Việt** (đầy đủ dấu).
- Thuật ngữ kỹ thuật, code identifier, tên file giữ nguyên tiếng Anh.

## Nguyên tắc làm task — KISS, YAGNI, DRY, library-first

Trước khi viết code cho mọi task. Luôn ưu tiên **đơn giản** và **ít code**:

- **KISS — giữ code đơn giản.** Chọn giải pháp đơn giản nhất chạy được & dễ
  đọc. KHÔNG over-engineer: không abstraction / generic / lớp gián tiếp khi
  chưa cần, không "phòng xa" cho tương lai chưa tới.
- **YAGNI — chưa cần thì chưa làm.** Chỉ giải đúng yêu cầu hiện tại; không thêm
  option / param / feature / branch "để sau dùng".
- **DRY — không lặp.** Logic trùng > 1 chỗ → tách dùng chung. Nhưng đừng ép DRY
  khi hai đoạn chỉ tình cờ giống nhau — abstraction sai còn tệ hơn lặp.
- **Chọn thư viện trước khi tự viết (không chế lại bánh xe).** Khảo sát thư viện cộng đồng tin dùng
  (active maintain, nhiều download) phủ được yêu cầu và cho viết **ít code
  nhất**. Ưu tiên cái đã có trong dependencies, rồi mới cân nhắc thêm mới.
- **Đọc docs chính chủ, làm đúng chuẩn.** Theo API/pattern mà docs khuyến nghị,
  không tự chế. Cần docs mới nhất → activate `docs-seeker` (context7).
- **Config chuẩn > viết code.** Đa số nhu cầu giải được bằng cấu hình đúng của
  lib/framework; config chuẩn thì code tự ít đi — ưu tiên hướng này.
- **Nghĩ kỹ trước khi custom.** Chỉ custom khi lib + config thật sự không phủ
  được. Trước khi tự viết phải trả lời: "đã có sẵn chưa? config được không?".
- **KHÔNG deadcode.** Không để code thừa không ai gọi (helper/abstraction/biến/
  import/branch, file "enhanced" song song, compat-shim không cần). Thay thì
  xoá hẳn cái cũ.

## Commit message

- Commit message chỉ **1 dòng** (subject, không body).
- Subject **< 50 ký tự**.
- Dùng conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, ...
- Không tham chiếu AI trong commit message.

## Code comments — TUYỆT ĐỐI KHÔNG comment

> **Mặc định ZERO comment.** Đây là rule bị vi phạm nhiều nhất. Viết code
> KHÔNG kèm bất kỳ comment nào. Coi như mỗi comment là một lỗi phải sửa.

**Self-check BẮT BUỘC** — trước khi kết thúc MỖI lần Write/Edit/MultiEdit lên
file code: đọc lại đúng phần mình vừa viết, **xoá hết comment vừa thêm**. Chỉ
được giữ lại nếu rơi đúng "Ngoại lệ hiếm" bên dưới. Phân vân → xoá.

- Mặc định **KHÔNG comment**. Code rõ là đủ — không cần "giúp" reader.
- KHÔNG docstring / JSDoc mô tả function, class, param, return. Tên + type
  đã nói. Bỏ luôn cả những comment chỉ paraphrase identifier.
- KHÔNG comment WHAT, KHÔNG comment cho "dễ scan", KHÔNG comment đứng đầu
  file/section dạng "Build a X with Y".
- KHÔNG comment kiểu đánh dấu bước/section trong hàm (`// fetch data`,
  `// validate`, `// return result`), KHÔNG comment TODO/placeholder.
- KHÔNG reference task / PR / phase / finding code — rot khi code đổi.
- Lý do (WHY) → commit message / PR description / `docs/`, **không** vào code.
- Ngoại lệ hiếm — chỉ 1 dòng, chỉ khi reader **chắc chắn** sẽ break nếu
  không biết: race / ordering bắt buộc / workaround cho bug cụ thể có
  reference ổn định (CVE, RFC, SQLSTATE). Phân vân → **không** comment.
- Khi sửa code có sẵn: không cần xoá comment cũ trừ khi sai/lạc hậu. Nhưng
  KHÔNG copy phong cách comment cũ rồi thêm comment mới.
