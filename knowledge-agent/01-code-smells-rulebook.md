# Bộ Luật Phát Hiện Code Smell
> Tài liệu tham chiếu cho **Refactoring & Design Pattern Agent**  
> Ngôn ngữ: JavaScript / TypeScript  
> Phiên bản: 1.0

---

## Mục lục

1. [God Class / God Object](#1-god-class--god-object)
2. [Duplicated Code](#2-duplicated-code)
3. [Long Method](#3-long-method)
4. [High Cyclomatic Complexity](#4-high-cyclomatic-complexity)
5. [Feature Envy](#5-feature-envy)
6. [Data Clumps](#6-data-clumps)
7. [Primitive Obsession](#7-primitive-obsession)
8. [Shotgun Surgery](#8-shotgun-surgery)
9. [Dead Code](#9-dead-code)
10. [Magic Numbers & Magic Strings](#10-magic-numbers--magic-strings)

---

## 1. God Class / God Object

### Định nghĩa
Một class đảm nhận quá nhiều trách nhiệm — biết quá nhiều thứ và làm quá nhiều việc. Thường là dấu hiệu vi phạm **Single Responsibility Principle (SRP)**.

### Ngưỡng phát hiện (dùng cho Agent)
| Chỉ số | Ngưỡng cảnh báo | Ngưỡng nghiêm trọng |
|--------|----------------|---------------------|
| Số methods trong class | > 15 | > 30 |
| Số lines of code (LOC) | > 300 | > 600 |
| Số dependencies được import/inject | > 7 | > 12 |
| Số `private` fields không liên quan nhau | > 10 | > 20 |

### Prompt hướng dẫn Agent phân tích
```
Phân tích class/object sau và xác định:
1. Có bao nhiêu "nhóm trách nhiệm" khác nhau trong class này?
2. Nếu tách ra, mỗi nhóm có thể trở thành class/module độc lập nào?
3. Phân loại theo mức độ: INFO / WARNING / ERROR
Trả về dưới dạng JSON với các fields: smell_type, severity, lines_affected, suggestion, refactor_to
```

### Ví dụ Before / After

**❌ Before — God Class**
```typescript
class UserManager {
  private db: Database;
  private emailService: EmailService;
  private logger: Logger;
  private cache: Redis;
  private stripe: StripeClient;
  private s3: S3Client;

  // Quản lý user
  async createUser(data: CreateUserDTO) { /* ... */ }
  async updateUser(id: string, data: UpdateUserDTO) { /* ... */ }
  async deleteUser(id: string) { /* ... */ }
  async getUserById(id: string) { /* ... */ }
  async listUsers(filters: UserFilters) { /* ... */ }

  // Xử lý email (không liên quan core user management)
  async sendWelcomeEmail(user: User) { /* ... */ }
  async sendPasswordResetEmail(email: string) { /* ... */ }
  async sendInvoiceEmail(userId: string, invoiceId: string) { /* ... */ }

  // Xử lý thanh toán (không liên quan)
  async chargeUser(userId: string, amount: number) { /* ... */ }
  async refundUser(userId: string, transactionId: string) { /* ... */ }
  async getPaymentHistory(userId: string) { /* ... */ }

  // Upload file (không liên quan)
  async uploadAvatar(userId: string, file: Buffer) { /* ... */ }
  async deleteAvatar(userId: string) { /* ... */ }
}
```

**✅ After — Tách theo Single Responsibility**
```typescript
// user.service.ts — chỉ quản lý nghiệp vụ user
class UserService {
  constructor(
    private userRepository: UserRepository,
    private cache: CacheService,
  ) {}

  async createUser(data: CreateUserDTO): Promise<User> { /* ... */ }
  async updateUser(id: string, data: UpdateUserDTO): Promise<User> { /* ... */ }
  async deleteUser(id: string): Promise<void> { /* ... */ }
  async getUserById(id: string): Promise<User | null> { /* ... */ }
  async listUsers(filters: UserFilters): Promise<PaginatedResult<User>> { /* ... */ }
}

// user-notification.service.ts — chỉ xử lý thông báo liên quan user
class UserNotificationService {
  constructor(private emailService: EmailService) {}

  async sendWelcomeEmail(user: User): Promise<void> { /* ... */ }
  async sendPasswordResetEmail(email: string, token: string): Promise<void> { /* ... */ }
}

// payment.service.ts — tách riêng module thanh toán
class PaymentService {
  constructor(private stripe: StripeClient) {}

  async chargeUser(userId: string, amount: number): Promise<Transaction> { /* ... */ }
  async refundUser(userId: string, transactionId: string): Promise<Refund> { /* ... */ }
  async getPaymentHistory(userId: string): Promise<Transaction[]> { /* ... */ }
}

// media.service.ts — tách riêng module media
class MediaService {
  constructor(private s3: S3Client) {}

  async uploadAvatar(userId: string, file: Buffer): Promise<string> { /* ... */ }
  async deleteAvatar(userId: string): Promise<void> { /* ... */ }
}
```

---

## 2. Duplicated Code

### Định nghĩa
Cùng một đoạn logic xuất hiện ở nhiều nơi trong codebase. Là nguồn gốc của hầu hết các bugs khó tìm.

### Ngưỡng phát hiện
| Loại | Mô tả | Ngưỡng |
|------|-------|--------|
| Type 1 (Clone chính xác) | Copy-paste nguyên văn | ≥ 4 dòng giống nhau |
| Type 2 (Clone biến tên) | Giống nhau nhưng đổi tên biến | ≥ 6 dòng logic giống nhau |
| Type 3 (Clone cùng cấu trúc) | Cùng cấu trúc control flow | ≥ 10 dòng pattern giống nhau |

### Ví dụ Before / After

**❌ Before — Duplicated validation logic**
```typescript
// routes/users.ts
async function createUser(req: Request, res: Response) {
  if (!req.body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email)) {
    return res.status(400).json({ error: 'Email không hợp lệ' });
  }
  if (!req.body.password || req.body.password.length < 8) {
    return res.status(400).json({ error: 'Password phải ít nhất 8 ký tự' });
  }
  // ... xử lý tạo user
}

// routes/auth.ts
async function login(req: Request, res: Response) {
  if (!req.body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email)) {
    return res.status(400).json({ error: 'Email không hợp lệ' });
  }
  if (!req.body.password || req.body.password.length < 8) {
    return res.status(400).json({ error: 'Password phải ít nhất 8 ký tự' });
  }
  // ... xử lý đăng nhập
}
```

**✅ After — Extract thành reusable validator**
```typescript
// validators/auth.validator.ts
import { z } from 'zod';

export const authSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(8, 'Password phải ít nhất 8 ký tự'),
});

export type AuthDTO = z.infer<typeof authSchema>;

// middleware/validate.ts
export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ errors: result.error.flatten().fieldErrors });
    }
    req.body = result.data;
    next();
  };
}

// routes/users.ts
router.post('/users', validate(authSchema), createUser);

// routes/auth.ts
router.post('/login', validate(authSchema), login);
```

---

## 3. Long Method

### Định nghĩa
Một function/method thực hiện quá nhiều bước, làm giảm khả năng đọc hiểu và test.

### Ngưỡng phát hiện
| Chỉ số | Cảnh báo | Nghiêm trọng |
|--------|----------|--------------|
| Lines of code | > 30 | > 60 |
| Số tham số | > 4 | > 7 |
| Số lần early return | > 5 | > 10 |
| Số block indent lồng nhau | > 3 | > 5 |

### Ví dụ Before / After

**❌ Before — Long method xử lý đơn hàng**
```typescript
async function processOrder(orderId: string, userId: string, paymentData: any) {
  // Validate order
  const order = await db.orders.findById(orderId);
  if (!order) throw new Error('Order not found');
  if (order.status !== 'PENDING') throw new Error('Order already processed');
  if (order.userId !== userId) throw new Error('Unauthorized');

  // Validate inventory
  for (const item of order.items) {
    const product = await db.products.findById(item.productId);
    if (!product) throw new Error(`Product ${item.productId} not found`);
    if (product.stock < item.quantity) {
      throw new Error(`Insufficient stock for ${product.name}`);
    }
  }

  // Process payment
  const totalAmount = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const charge = await stripe.charges.create({
    amount: totalAmount * 100,
    currency: 'vnd',
    source: paymentData.token,
  });
  if (charge.status !== 'succeeded') throw new Error('Payment failed');

  // Update inventory
  for (const item of order.items) {
    await db.products.updateOne(
      { _id: item.productId },
      { $inc: { stock: -item.quantity } }
    );
  }

  // Update order status
  await db.orders.updateOne({ _id: orderId }, { status: 'COMPLETED', chargeId: charge.id });

  // Send confirmation email
  const user = await db.users.findById(userId);
  await emailService.send({
    to: user.email,
    subject: 'Xác nhận đơn hàng',
    body: `Đơn hàng ${orderId} đã được xử lý thành công.`,
  });

  return { success: true, chargeId: charge.id };
}
```

**✅ After — Extract thành các step functions rõ ràng**
```typescript
// Mỗi bước trở thành một function có thể test độc lập
async function processOrder(orderId: string, userId: string, paymentData: PaymentDTO) {
  const order = await validateOrder(orderId, userId);
  await validateInventory(order.items);
  const charge = await processPayment(order, paymentData);
  await fulfillOrder(order, charge.id);
  await notifyUser(userId, orderId);
  return { success: true, chargeId: charge.id };
}

async function validateOrder(orderId: string, userId: string): Promise<Order> {
  const order = await orderRepository.findById(orderId);
  if (!order) throw new NotFoundError('Order', orderId);
  if (order.status !== 'PENDING') throw new InvalidStateError('Order already processed');
  if (order.userId !== userId) throw new UnauthorizedError();
  return order;
}

async function validateInventory(items: OrderItem[]): Promise<void> {
  const checks = items.map(item => inventoryService.checkStock(item.productId, item.quantity));
  await Promise.all(checks);
}

async function processPayment(order: Order, paymentData: PaymentDTO): Promise<Charge> {
  const amount = calculateTotal(order.items);
  return paymentService.charge({ amount, source: paymentData.token });
}

async function fulfillOrder(order: Order, chargeId: string): Promise<void> {
  await Promise.all([
    inventoryService.decrementStock(order.items),
    orderRepository.markCompleted(order.id, chargeId),
  ]);
}
```

---

## 4. High Cyclomatic Complexity

### Định nghĩa
Độ phức tạp thuật toán đo bằng số lượng **đường đi độc lập** qua một đoạn code. Mỗi `if`, `else`, `for`, `while`, `case`, `&&`, `||`, `?.`, `??` cộng thêm 1.

### Ngưỡng phát hiện
| Complexity Score | Mức độ | Hành động |
|-----------------|--------|-----------|
| 1–5 | Tốt | Không cần làm gì |
| 6–10 | Cảnh báo | Xem xét refactor |
| 11–20 | Nghiêm trọng | Phải refactor |
| > 20 | Cực kỳ nguy hiểm | Không thể test đầy đủ |

### Ví dụ Before / After

**❌ Before — Complexity: 14**
```typescript
function calculateDiscount(user: User, order: Order, coupon?: Coupon): number {
  let discount = 0;
  if (user.isPremium) {                        // +1
    if (order.total > 1000000) {               // +1
      discount = 0.2;
    } else if (order.total > 500000) {         // +1
      discount = 0.15;
    } else {
      discount = 0.1;
    }
  } else if (user.isNewUser) {                 // +1
    discount = 0.05;
  }
  if (coupon) {                                // +1
    if (coupon.type === 'PERCENTAGE') {        // +1
      if (coupon.value > discount) {           // +1
        discount = coupon.value;
      } else {
        discount += coupon.value * 0.5;        // stacking logic
      }
    } else if (coupon.type === 'FIXED') {      // +1
      // fixed discount logic...
    }
  }
  if (order.isFirstOrder && !user.isPremium) { // +1 +1
    discount += 0.03;
  }
  return discount;
}
```

**✅ After — Tách thành Strategy objects, Complexity mỗi function ≤ 3**
```typescript
// discount/strategies.ts
type DiscountStrategy = (user: User, order: Order) => number;

const premiumDiscount: DiscountStrategy = (user, order) => {
  if (!user.isPremium) return 0;
  if (order.total > 1_000_000) return 0.20;
  if (order.total > 500_000) return 0.15;
  return 0.10;
};

const newUserDiscount: DiscountStrategy = (user) =>
  user.isNewUser && !user.isPremium ? 0.05 : 0;

const firstOrderDiscount: DiscountStrategy = (user, order) =>
  order.isFirstOrder && !user.isPremium ? 0.03 : 0;

// discount/coupon.ts
function applyCoupon(baseDiscount: number, coupon: Coupon): number {
  if (coupon.type === 'PERCENTAGE') {
    return coupon.value > baseDiscount
      ? coupon.value
      : baseDiscount + coupon.value * 0.5;
  }
  if (coupon.type === 'FIXED') {
    return baseDiscount; // fixed logic here
  }
  return baseDiscount;
}

// discount/calculator.ts
const strategies: DiscountStrategy[] = [
  premiumDiscount,
  newUserDiscount,
  firstOrderDiscount,
];

function calculateDiscount(user: User, order: Order, coupon?: Coupon): number {
  const baseDiscount = Math.max(...strategies.map(s => s(user, order)));
  return coupon ? applyCoupon(baseDiscount, coupon) : baseDiscount;
}
```

---

## 5. Feature Envy

### Định nghĩa
Một method trong class A liên tục sử dụng data/methods từ class B nhiều hơn từ chính class A — dấu hiệu method này đặt sai chỗ.

### Dấu hiệu nhận biết
- Method gọi getter của object khác ≥ 3 lần liên tiếp
- Method biết quá nhiều về cấu trúc nội tại của object khác
- Method có thể di chuyển sang class khác mà không cần thay đổi logic

### Ví dụ Before / After

**❌ Before**
```typescript
class OrderReport {
  generateSummary(order: Order): string {
    // Feature Envy: biết quá nhiều về cấu trúc nội tại của Order
    const itemCount = order.items.length;
    const total = order.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const discount = order.discount.type === 'PERCENTAGE'
      ? total * order.discount.value
      : order.discount.value;
    const tax = (total - discount) * order.taxRate;
    return `Items: ${itemCount}, Subtotal: ${total}, Tax: ${tax}`;
  }
}
```

**✅ After — Di chuyển logic về đúng chỗ**
```typescript
class Order {
  get itemCount(): number { return this.items.length; }
  get subtotal(): number { return this.items.reduce((s, i) => s + i.price * i.quantity, 0); }
  get discountAmount(): number { /* ... */ }
  get tax(): number { return (this.subtotal - this.discountAmount) * this.taxRate; }
  get totalAmount(): number { return this.subtotal - this.discountAmount + this.tax; }

  toSummary(): string {
    return `Items: ${this.itemCount}, Subtotal: ${this.subtotal}, Tax: ${this.tax}`;
  }
}

class OrderReport {
  generateSummary(order: Order): string {
    return order.toSummary(); // Đơn giản — đúng trách nhiệm
  }
}
```

---

## 6. Data Clumps

### Định nghĩa
Các nhóm biến luôn xuất hiện cùng nhau (như tham số hàm hoặc fields của class) nhưng chưa được đóng gói thành một object/type riêng.

### Ví dụ Before / After

**❌ Before**
```typescript
function createUser(
  firstName: string,
  lastName: string,
  email: string,
  street: string,
  city: string,
  country: string,
  postalCode: string
) { /* ... */ }
```

**✅ After — Tạo Value Objects**
```typescript
interface PersonName {
  firstName: string;
  lastName: string;
  get fullName(): string;
}

interface Address {
  street: string;
  city: string;
  country: string;
  postalCode: string;
}

interface CreateUserDTO {
  name: PersonName;
  email: string;
  address: Address;
}

function createUser(dto: CreateUserDTO) { /* ... */ }
```

---

## 7. Primitive Obsession

### Định nghĩa
Sử dụng kiểu nguyên thủy (`string`, `number`, `boolean`) để biểu diễn các khái niệm nghiệp vụ phức tạp thay vì dùng kiểu riêng.

### Ví dụ Before / After

**❌ Before**
```typescript
function transferMoney(
  fromAccountId: string,
  toAccountId: string,
  amount: number,       // VND? USD? không rõ
  currency: string      // 'VND', 'USD'? không validate
) { /* ... */ }

const userId = "usr_12345";   // string thuần — dễ nhầm với orderId
const orderId = "usr_67890";  // ← bug tiềm ẩn: không có type safety
```

**✅ After — Branded Types & Value Objects**
```typescript
// types/branded.ts
type Brand<T, B> = T & { readonly _brand: B };
type UserId = Brand<string, 'UserId'>;
type OrderId = Brand<string, 'OrderId'>;

const createUserId = (id: string): UserId => id as UserId;
const createOrderId = (id: string): OrderId => id as OrderId;

// types/money.ts
type Currency = 'VND' | 'USD' | 'EUR';
interface Money {
  readonly amount: number;
  readonly currency: Currency;
}

const money = (amount: number, currency: Currency): Money => ({ amount, currency });

function transferMoney(
  from: UserId,
  to: UserId,
  amount: Money
): Promise<Transaction> { /* ... */ }

// Giờ đây compiler sẽ bắt lỗi nếu nhầm UserId với OrderId
```

---

## 8. Shotgun Surgery

### Định nghĩa
Một thay đổi nhỏ yêu cầu sửa nhiều file/class cùng lúc — dấu hiệu logic bị phân tán sai chỗ.

### Dấu hiệu nhận biết (Agent có thể kiểm tra qua Git diff)
- Một commit thay đổi > 5 file không liên quan nhau
- Cùng một pattern xuất hiện ở nhiều nơi (`console.log`, error format, date format)

### Ví dụ Before / After

**❌ Before — Format lỗi bị rải khắp nơi**
```typescript
// api/users.ts
res.status(400).json({ error: true, message: 'Validation failed', code: 400 });

// api/orders.ts
res.status(400).json({ error: true, message: 'Invalid order', code: 400 });

// api/payments.ts
res.status(500).json({ error: true, message: 'Payment error', code: 500 });
```

**✅ After — Tập trung vào một nơi**
```typescript
// utils/api-response.ts
export class ApiResponse {
  static error(res: Response, status: number, message: string, details?: unknown) {
    return res.status(status).json({
      success: false,
      error: { message, code: status, details },
      timestamp: new Date().toISOString(),
    });
  }

  static success<T>(res: Response, data: T, status = 200) {
    return res.status(status).json({ success: true, data });
  }
}

// Dùng ở mọi nơi — chỉ cần sửa một chỗ nếu format thay đổi
ApiResponse.error(res, 400, 'Validation failed', errors);
```

---

## 9. Dead Code

### Định nghĩa
Code không bao giờ được thực thi: function không được gọi, biến không được dùng, block sau `return`/`throw`, feature flag luôn `false`.

### Ngưỡng phát hiện
- Functions/methods: không có reference nào trong codebase (trừ export public API)
- Variables: được khai báo nhưng không được đọc
- Imports: được import nhưng không dùng
- Comments chứa code cũ (block `/* ... */` lớn hơn 10 dòng)

### Ví dụ
```typescript
// ❌ Dead code các loại
import { OldService } from './old-service'; // unused import

function legacyProcessPayment() { /* ... */ } // không được gọi ở đâu

async function getUser(id: string) {
  const user = await db.findUser(id);
  return user;
  console.log('User found:', user); // unreachable code sau return
}

const FEATURE_NEW_CHECKOUT = false; // feature flag cứng
if (FEATURE_NEW_CHECKOUT) {
  // Toàn bộ block này là dead code
  await newCheckoutFlow();
}
```

---

## 10. Magic Numbers & Magic Strings

### Định nghĩa
Các literal số hoặc chuỗi xuất hiện trực tiếp trong code mà không có giải thích.

### Ví dụ Before / After

**❌ Before**
```typescript
if (password.length < 8) { /* ... */ }
setTimeout(refreshToken, 3600000);
if (user.role === 'admin_super_v2') { /* ... */ }
const tax = amount * 0.1;
```

**✅ After**
```typescript
// constants/auth.ts
export const AUTH = {
  PASSWORD_MIN_LENGTH: 8,
  TOKEN_REFRESH_INTERVAL_MS: 60 * 60 * 1000, // 1 giờ
  ROLES: {
    SUPER_ADMIN: 'admin_super_v2',
  },
} as const;

// constants/tax.ts
export const TAX_RATE_VAT = 0.10; // VAT Việt Nam 10%

// Sử dụng
if (password.length < AUTH.PASSWORD_MIN_LENGTH) { /* ... */ }
setTimeout(refreshToken, AUTH.TOKEN_REFRESH_INTERVAL_MS);
if (user.role === AUTH.ROLES.SUPER_ADMIN) { /* ... */ }
const tax = amount * TAX_RATE_VAT;
```

---

## Phụ lục: Cấu hình Agent Prompt Template

```typescript
// Dùng làm system prompt cho Code Smell Detection Agent
export const CODE_SMELL_SYSTEM_PROMPT = `
Bạn là một senior TypeScript/JavaScript engineer chuyên phân tích chất lượng code.
Khi nhận được một đoạn code, hãy phân tích và trả về JSON với cấu trúc sau:

{
  "smells": [
    {
      "type": "GOD_CLASS | DUPLICATED_CODE | LONG_METHOD | HIGH_COMPLEXITY | FEATURE_ENVY | DATA_CLUMPS | PRIMITIVE_OBSESSION | SHOTGUN_SURGERY | DEAD_CODE | MAGIC_VALUES",
      "severity": "INFO | WARNING | ERROR",
      "location": { "startLine": number, "endLine": number, "identifier": string },
      "description": "Mô tả ngắn gọn tại sao đây là vấn đề",
      "metric": { "current": number, "threshold": number, "unit": string },
      "refactorSuggestion": "Đề xuất cụ thể 1-2 câu",
      "patternToApply": "Pattern name nếu có, ví dụ: Strategy, Factory, Repository"
    }
  ],
  "overallScore": number, // 0-100, 100 là hoàn hảo
  "prioritizedActions": string[] // Top 3 việc cần làm ngay
}

Chỉ trả về JSON, không thêm bất kỳ text nào khác.
`;
```
