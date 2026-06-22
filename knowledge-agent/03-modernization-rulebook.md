# Bộ Luật Modernization — Chuyển Đổi Code Cũ sang Hiện Đại
> Tài liệu tham chiếu cho **Refactoring & Design Pattern Agent**  
> Ngôn ngữ: JavaScript / TypeScript  
> Phiên bản: 1.0

---

## Mục lục

1. [Callback Hell → Async/Await](#1-callback-hell--asyncawait)
2. [Promise Chain → Async/Await](#2-promise-chain--asyncawait)
3. [CommonJS → ES Modules](#3-commonjs--es-modules)
4. [var → const/let với TypeScript types](#4-var--constlet-với-typescript-types)
5. [Class-based React → Hooks](#5-class-based-react--hooks)
6. [Callback-style Error → Typed Error Handling](#6-callback-style-error--typed-error-handling)
7. [Express callbacks → Clean Architecture](#7-express-callbacks--clean-architecture)
8. [Flat Config → Environment-based Config](#8-flat-config--environment-based-config)
9. [Manual Type Assertions → Zod Runtime Validation](#9-manual-type-assertions--zod-runtime-validation)
10. [Console.log Debugging → Structured Logging](#10-consolelog-debugging--structured-logging)

---

## Hướng dẫn phát hiện code cũ

Agent phát hiện code cần modernize qua các regex/AST pattern sau:

```typescript
// Danh sách trigger patterns cho agent
export const LEGACY_PATTERNS = {
  CALLBACK_HELL: /\.then\(.*\.then\(|callback\(null,|callback\(err/,
  VAR_USAGE: /\bvar\s+\w+/,
  REQUIRE_SYNTAX: /require\(['"`]/,
  CLASS_COMPONENT: /extends\s+React\.Component|extends\s+Component/,
  PROMISE_CHAIN: /\.then\(\w+ =>\s*\w+\.then/,
  MANUAL_TYPE_CHECK: /typeof \w+ === ['"]|instanceof\s+\w+/,
  CONSOLE_LOG: /console\.(log|warn|error)\(/,
} as const;
```

---

## 1. Callback Hell → Async/Await

### Định nghĩa
Callback hell (Pyramid of Doom) xảy ra khi các hàm bất đồng bộ được lồng nhau nhiều tầng, tạo ra cấu trúc code hình kim tự tháp, cực khó đọc và xử lý lỗi.

### Trigger — Agent phát hiện
- Độ lồng nhau của callbacks ≥ 3 tầng
- Có pattern `function(err, result)` kiểu Node.js callback
- Xuất hiện `.then()` lồng trong `.then()` khác

### Before / After

**❌ Before — Callback Hell (3 tầng lồng nhau)**
```javascript
// Node.js style — đọc từ trên xuống nhưng flow thực tế rất khó follow
function processUserOrder(userId, productId, callback) {
  db.users.findById(userId, function(err, user) {
    if (err) return callback(err);
    if (!user) return callback(new Error('User not found'));

    db.products.findById(productId, function(err, product) {
      if (err) return callback(err);
      if (!product) return callback(new Error('Product not found'));
      if (product.stock < 1) return callback(new Error('Out of stock'));

      stripe.charges.create({
        amount: product.price,
        source: user.paymentToken,
      }, function(err, charge) {
        if (err) return callback(err);

        db.orders.create({
          userId: user._id,
          productId: product._id,
          chargeId: charge.id,
        }, function(err, order) {
          if (err) return callback(err);

          emailService.send({
            to: user.email,
            subject: 'Order confirmed',
          }, function(err) {
            if (err) console.error('Email failed:', err); // lỗi bị nuốt im lặng
            callback(null, order);
          });
        });
      });
    });
  });
}
```

**✅ After — Async/Await với proper error handling**
```typescript
async function processUserOrder(userId: string, productId: string): Promise<Order> {
  const [user, product] = await Promise.all([
    userRepository.findById(userId),
    productRepository.findById(productId),
  ]);

  if (!user) throw new NotFoundError('User', userId);
  if (!product) throw new NotFoundError('Product', productId);
  if (product.stock < 1) throw new OutOfStockError(productId);

  const charge = await paymentService.charge({
    amount: product.price,
    source: user.paymentToken,
  });

  const order = await orderRepository.create({
    userId: user.id,
    productId: product.id,
    chargeId: charge.id,
  });

  // Side effect không chặn response — lỗi được log nhưng không throw
  emailService
    .send({ to: user.email, subject: 'Order confirmed', orderId: order.id })
    .catch(err => logger.error('Failed to send confirmation email', { err, orderId: order.id }));

  return order;
}
```

### Lợi ích
| Trước | Sau |
|-------|-----|
| 6 tầng lồng nhau | Flat, tuyến tính |
| Mỗi bước phải check `err` thủ công | `try/catch` một lần ở caller |
| Race condition khi gọi tuần tự | `Promise.all` chạy song song |
| Lỗi email bị nuốt im lặng | Được log rõ ràng |

---

## 2. Promise Chain → Async/Await

### Trigger — Agent phát hiện
- Chuỗi `.then()` dài hơn 3 bước
- Có `return` bên trong `.then()`
- Sử dụng `.catch()` ở cuối chain

### Before / After

**❌ Before — Promise Chain khó đọc**
```javascript
function getUserDashboard(userId) {
  return userService.getUser(userId)
    .then(user => {
      return orderService.getRecentOrders(user.id)
        .then(orders => {
          return notificationService.getUnread(user.id)
            .then(notifications => {
              return {
                user,
                orders,
                notifications,
                unreadCount: notifications.filter(n => !n.read).length,
              };
            });
        });
    })
    .catch(err => {
      console.error('Dashboard error:', err);
      throw err;
    });
}
```

**✅ After — Async/Await rõ ràng**
```typescript
async function getUserDashboard(userId: UserId): Promise<UserDashboard> {
  const user = await userService.getUser(userId);
  if (!user) throw new NotFoundError('User', userId);

  // Fetch dữ liệu độc lập song song — nhanh hơn
  const [orders, notifications] = await Promise.all([
    orderService.getRecentOrders(user.id),
    notificationService.getUnread(user.id),
  ]);

  return {
    user,
    orders,
    notifications,
    unreadCount: notifications.filter(n => !n.read).length,
  };
}

// Error handling ở tầng trên, không cần lặp lại trong mỗi function
```

---

## 3. CommonJS → ES Modules

### Trigger — Agent phát hiện
- `const x = require('...')`
- `module.exports = ...`
- `exports.something = ...`

### Before / After

**❌ Before — CommonJS**
```javascript
const express = require('express');
const { UserService } = require('./services/user.service');
const { validateUser } = require('./validators/user.validator');
const config = require('./config');

const router = express.Router();

router.get('/users/:id', async (req, res) => {
  const user = await UserService.getById(req.params.id);
  res.json(user);
});

module.exports = router;
```

**✅ After — ES Modules + TypeScript**
```typescript
import { Router, Request, Response } from 'express';
import { UserService } from './services/user.service.js';
import { validateUser } from './validators/user.validator.js';
import { config } from './config.js';

const router = Router();

router.get('/users/:id', async (req: Request, res: Response) => {
  const user = await UserService.getById(req.params.id);
  res.json(user);
});

export default router;
export { router as userRouter };
```

### Cấu hình cần thiết
```json
// tsconfig.json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022"
  }
}

// package.json
{
  "type": "module"
}
```

---

## 4. var → const/let với TypeScript types

### Trigger — Agent phát hiện
- Sử dụng `var` thay vì `const`/`let`
- Biến `any` không có type annotation
- Object không có interface/type

### Before / After

**❌ Before — JavaScript thuần không typed**
```javascript
var userId = req.params.id;
var user = null;
var isAdmin = false;

function getUser(id, callback) {
  var result = db.query('SELECT * FROM users WHERE id = ?', [id]);
  callback(null, result);
}

var config = {
  host: 'localhost',
  port: 3000,
  debug: true,
};
```

**✅ After — TypeScript với proper types**
```typescript
// types/user.types.ts
interface User {
  id: UserId;
  email: string;
  role: 'admin' | 'user' | 'moderator';
  createdAt: Date;
}

interface AppConfig {
  readonly host: string;
  readonly port: number;
  readonly debug: boolean;
}

// Sử dụng
const userId: UserId = req.params.id as UserId;
let user: User | null = null;
const isAdmin: boolean = false;

async function getUser(id: UserId): Promise<User | null> {
  return userRepository.findById(id);
}

const config: AppConfig = {
  host: process.env.HOST ?? 'localhost',
  port: Number(process.env.PORT ?? 3000),
  debug: process.env.NODE_ENV !== 'production',
} as const;
```

---

## 5. Class-based React → Hooks

### Trigger — Agent phát hiện
- `extends React.Component` hoặc `extends Component`
- `this.state`, `this.setState`
- `componentDidMount`, `componentDidUpdate`, `componentWillUnmount`

### Before / After

**❌ Before — Class Component**
```javascript
class UserProfile extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      user: null,
      loading: true,
      error: null,
    };
    this.handleRefresh = this.handleRefresh.bind(this);
  }

  componentDidMount() {
    this.fetchUser();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.userId !== this.props.userId) {
      this.fetchUser();
    }
  }

  componentWillUnmount() {
    this.abortController?.abort();
  }

  async fetchUser() {
    this.abortController = new AbortController();
    try {
      this.setState({ loading: true, error: null });
      const user = await userApi.getUser(this.props.userId, {
        signal: this.abortController.signal,
      });
      this.setState({ user, loading: false });
    } catch (err) {
      if (err.name !== 'AbortError') {
        this.setState({ error: err.message, loading: false });
      }
    }
  }

  handleRefresh() {
    this.fetchUser();
  }

  render() {
    const { user, loading, error } = this.state;
    if (loading) return <Spinner />;
    if (error) return <ErrorMessage message={error} />;
    return <ProfileCard user={user} onRefresh={this.handleRefresh} />;
  }
}
```

**✅ After — Functional Component + Hooks**
```typescript
// hooks/useUser.ts — logic tách ra, có thể reuse
interface UseUserResult {
  user: User | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

function useUser(userId: UserId): UseUserResult {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchUser() {
      setLoading(true);
      setError(null);
      try {
        const data = await userApi.getUser(userId, { signal: controller.signal });
        setUser(data);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError((err as Error).message);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
    return () => controller.abort();
  }, [userId, refreshKey]);

  return { user, loading, error, refresh: () => setRefreshKey(k => k + 1) };
}

// components/UserProfile.tsx — chỉ UI, không logic
function UserProfile({ userId }: { userId: UserId }) {
  const { user, loading, error, refresh } = useUser(userId);

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage message={error} />;
  return <ProfileCard user={user!} onRefresh={refresh} />;
}
```

---

## 6. Callback-style Error → Typed Error Handling

### Trigger — Agent phát hiện
- `try/catch` bắt `any` hoặc `unknown` mà không narrow type
- `throw new Error(string)` không có error type riêng
- Không có custom error classes

### Before / After

**❌ Before — Untyped errors**
```typescript
async function processPayment(data: any) {
  try {
    const result = await stripe.charge(data);
    return result;
  } catch (err: any) { // ← any type, mất type safety
    if (err.code === 'card_declined') {
      // Làm gì đó
    } else if (err.code === 'insufficient_funds') {
      // Làm gì đó khác
    } else {
      throw new Error('Payment failed: ' + err.message); // ← mất context gốc
    }
  }
}
```

**✅ After — Typed Error Hierarchy**
```typescript
// errors/base.error.ts
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// errors/payment.errors.ts
export class PaymentDeclinedError extends AppError {
  constructor(public readonly reason: string, cause?: Error) {
    super(`Payment declined: ${reason}`, 'PAYMENT_DECLINED', 402, cause);
  }
}

export class InsufficientFundsError extends AppError {
  constructor(cause?: Error) {
    super('Insufficient funds', 'INSUFFICIENT_FUNDS', 402, cause);
  }
}

export class PaymentProviderError extends AppError {
  constructor(message: string, cause?: Error) {
    super(message, 'PAYMENT_PROVIDER_ERROR', 502, cause);
  }
}

// utils/error-guard.ts
export function isStripeError(err: unknown): err is Stripe.StripeError {
  return err instanceof Error && 'code' in err && 'type' in err;
}

// payment.service.ts
async function processPayment(data: PaymentData): Promise<ChargeResult> {
  try {
    return await stripe.charge(data);
  } catch (err: unknown) {
    if (isStripeError(err)) {
      if (err.code === 'card_declined') throw new PaymentDeclinedError(err.decline_code ?? 'unknown', err);
      if (err.code === 'insufficient_funds') throw new InsufficientFundsError(err);
    }
    throw new PaymentProviderError('Unexpected payment error', err as Error);
  }
}

// Caller có thể handle cụ thể từng loại lỗi
try {
  await processPayment(data);
} catch (err) {
  if (err instanceof PaymentDeclinedError) {
    return res.status(402).json({ error: 'Thẻ bị từ chối', reason: err.reason });
  }
  if (err instanceof InsufficientFundsError) {
    return res.status(402).json({ error: 'Số dư không đủ' });
  }
  throw err; // Re-throw unexpected errors
}
```

---

## 7. Express callbacks → Clean Architecture

### Trigger — Agent phát hiện
- Business logic nằm trong route handler
- Controller biết về database/ORM trực tiếp
- Không có service layer

### Before / After

**❌ Before — Spaghetti Express routes**
```javascript
// routes/orders.js — business logic lẫn trong route
app.post('/orders', async (req, res) => {
  try {
    // Validation trong route handler
    if (!req.body.items || req.body.items.length === 0) {
      return res.status(400).json({ error: 'Items are required' });
    }

    // DB query trực tiếp
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Business logic trong route
    const total = req.body.items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const discount = user.isPremium ? total * 0.1 : 0;

    // Tạo order trực tiếp
    const order = await prisma.order.create({
      data: {
        userId: req.user.id,
        items: req.body.items,
        total: total - discount,
      },
    });

    // Email trong route
    await sendEmail(user.email, `Order ${order.id} confirmed`);

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

**✅ After — Clean Architecture với 3 tầng rõ ràng**
```typescript
// Layer 1: Validation (schema)
// validators/create-order.schema.ts
export const createOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).min(1, 'Đơn hàng phải có ít nhất 1 sản phẩm'),
});

// Layer 2: Controller (chỉ HTTP concerns)
// controllers/order.controller.ts
export class OrderController {
  constructor(private orderService: OrderService) {}

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = createOrderSchema.parse(req.body);
      const order = await this.orderService.createOrder(req.user.id as UserId, dto);
      res.status(201).json({ success: true, data: order });
    } catch (err) {
      next(err);
    }
  }
}

// Layer 3: Service (business logic thuần)
// services/order.service.ts
export class OrderService {
  constructor(
    private userRepository: UserRepository,
    private productRepository: ProductRepository,
    private orderRepository: OrderRepository,
    private eventBus: EventBus,
  ) {}

  async createOrder(userId: UserId, dto: CreateOrderDTO): Promise<Order> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError('User', userId);

    const products = await this.productRepository.findByIds(dto.items.map(i => i.productId));
    const items = this.buildOrderItems(dto.items, products);

    const discount = this.calculateDiscount(user, items);
    const total = this.calculateTotal(items) - discount;

    const order = await this.orderRepository.create({ userId, items, total });
    await this.eventBus.emit(new OrderCreatedEvent(order));
    return order;
  }

  private buildOrderItems(dtoItems: CreateOrderDTO['items'], products: Product[]): OrderItem[] {
    return dtoItems.map(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product) throw new NotFoundError('Product', item.productId);
      if (product.stock < item.quantity) throw new OutOfStockError(item.productId);
      return { product, quantity: item.quantity, unitPrice: product.price };
    });
  }

  private calculateDiscount(user: User, items: OrderItem[]): number {
    return user.isPremium ? this.calculateTotal(items) * 0.10 : 0;
  }

  private calculateTotal(items: OrderItem[]): number {
    return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }
}
```

### Cấu trúc thư mục khuyến nghị
```
src/
├── controllers/          # HTTP handlers — chỉ parse request, gọi service, format response
│   └── order.controller.ts
├── services/             # Business logic — không biết về HTTP hay DB cụ thể
│   └── order.service.ts
├── repositories/         # Data access — chỉ biết về DB
│   ├── interfaces/
│   │   └── order.repository.interface.ts
│   └── prisma/
│       └── prisma-order.repository.ts
├── validators/           # Input validation schemas (Zod)
│   └── create-order.schema.ts
├── events/               # Domain events
│   └── order-created.event.ts
├── errors/               # Custom error classes
│   └── domain.errors.ts
└── types/                # Shared TypeScript types
    └── branded.types.ts
```

---

## 8. Flat Config → Environment-based Config

### Trigger — Agent phát hiện
- `process.env.X` rải khắp codebase
- Config hardcode thẳng vào code
- Không có validation cho env variables

### Before / After

**❌ Before**
```javascript
// Rải rác khắp nơi
const db = new Database(process.env.DATABASE_URL);
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
stripe.setApiKey(process.env.STRIPE_SECRET_KEY);
const jwtSecret = process.env.JWT_SECRET || 'default-secret'; // ← nguy hiểm!
```

**✅ After — Validated Config Module**
```typescript
// config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().default(3000),

  DATABASE_URL: z.string().url('DATABASE_URL phải là URL hợp lệ'),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET phải ít nhất 32 ký tự'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),

  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().email(),
  SMTP_PASS: z.string(),
});

// Validate ngay khi app khởi động — fail fast nếu thiếu env variable
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

// config/index.ts — typed config object
export const config = {
  app: {
    env: env.NODE_ENV,
    port: env.PORT,
    isDev: env.NODE_ENV === 'development',
    isProd: env.NODE_ENV === 'production',
  },
  database: {
    url: env.DATABASE_URL,
  },
  cache: {
    url: env.REDIS_URL,
  },
  auth: {
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN,
  },
  payment: {
    stripeSecretKey: env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
  },
  email: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  },
} as const;
```

---

## 9. Manual Type Assertions → Zod Runtime Validation

### Trigger — Agent phát hiện
- `as SomeType` casting không an toàn
- `typeof x === 'object'` để kiểm tra type
- Parse JSON không validate

### Before / After

**❌ Before**
```typescript
// Nguy hiểm: cast không validate
const userData = JSON.parse(rawBody) as CreateUserDTO;
const config = JSON.parse(fs.readFileSync('config.json', 'utf8')) as AppConfig;

// Manual validation rải rác
function processUser(data: any) {
  if (typeof data.email !== 'string') throw new Error('Invalid email');
  if (typeof data.age !== 'number') throw new Error('Invalid age');
  if (!['admin', 'user'].includes(data.role)) throw new Error('Invalid role');
  // ... còn nhiều nữa
}
```

**✅ After — Zod với type inference**
```typescript
import { z } from 'zod';

// Schema định nghĩa một lần, dùng cho cả type và validation
const createUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  age: z.number().int().min(18).max(120),
  role: z.enum(['admin', 'user', 'moderator']),
  address: z.object({
    street: z.string(),
    city: z.string(),
    country: z.string().length(2), // ISO 2-letter code
  }).optional(),
});

// TypeScript type được infer tự động — không cần khai báo 2 lần
type CreateUserDTO = z.infer<typeof createUserSchema>;

// Parse an toàn
function parseUser(raw: unknown): CreateUserDTO {
  return createUserSchema.parse(raw); // throw ZodError nếu invalid
}

// Hoặc safe parse (không throw)
function tryParseUser(raw: unknown): { success: true; data: CreateUserDTO } | { success: false; errors: string[] } {
  const result = createUserSchema.safeParse(raw);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
  };
}
```

---

## 10. Console.log Debugging → Structured Logging

### Trigger — Agent phát hiện
- `console.log(...)` bên ngoài development helpers
- `console.error(err)` trong production code
- Không có log levels

### Before / After

**❌ Before**
```typescript
console.log('Processing order:', orderId);
console.log('User found:', user);
console.log('Payment result:', result);
console.error('Error:', err);
```

**✅ After — Structured Logging với Pino**
```typescript
// logger/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  base: {
    service: 'api-service',
    env: process.env.NODE_ENV,
  },
});

// Sử dụng — log có context, searchable trong ELK/Datadog
logger.info({ orderId, userId }, 'Processing order');
logger.info({ userId: user.id, email: user.email }, 'User found');
logger.info({ chargeId: result.id, amount: result.amount }, 'Payment processed');
logger.error({ err, orderId, userId }, 'Order processing failed');

// Child logger cho từng module
const orderLogger = logger.child({ module: 'OrderService' });
orderLogger.info({ orderId }, 'Order created');
```

### Cấu hình Pino
```json
// package.json
{
  "dependencies": {
    "pino": "^8.0.0"
  },
  "devDependencies": {
    "pino-pretty": "^10.0.0"
  }
}
```

---

## Phụ lục: Prompt Template cho Modernization Agent

```typescript
export const MODERNIZATION_SYSTEM_PROMPT = `
Bạn là TypeScript modernization expert. Phân tích đoạn code JavaScript/TypeScript cũ và đề xuất cách chuyển đổi sang code hiện đại.

Khi phát hiện code cũ, trả về JSON:
{
  "legacyPatterns": [
    {
      "type": "CALLBACK_HELL | PROMISE_CHAIN | COMMONJS | VAR_USAGE | CLASS_COMPONENT | UNTYPED_ERROR | SPAGHETTI_ROUTES | FLAT_CONFIG | UNSAFE_CAST | CONSOLE_LOG",
      "severity": "INFO | WARNING | ERROR",
      "location": { "startLine": number, "endLine": number },
      "description": "Mô tả vấn đề với code hiện tại",
      "modernAlternative": "Tên kỹ thuật/pattern hiện đại nên dùng",
      "refactoredCode": "Code TypeScript hiện đại tương đương",
      "breakingChange": boolean,
      "migrationSteps": string[] // Các bước cụ thể để migrate từng bước
    }
  ],
  "requiredPackages": string[], // npm packages cần install
  "tsConfigChanges": object    // Thay đổi tsconfig nếu cần
}
`;

// Pattern detection cho từng loại
export const LEGACY_DETECTORS = {
  CALLBACK_HELL: (code: string) =>
    (code.match(/function\s*\(err,\s*\w+\)/g) ?? []).length >= 2,

  PROMISE_CHAIN: (code: string) =>
    (code.match(/\.then\s*\(/g) ?? []).length >= 3,

  COMMONJS: (code: string) =>
    /\brequire\s*\(/.test(code) || /module\.exports/.test(code),

  VAR_USAGE: (code: string) =>
    /\bvar\s+\w+/.test(code),

  CLASS_COMPONENT: (code: string) =>
    /extends\s+(React\.)?Component/.test(code),

  CONSOLE_LOG: (code: string) =>
    /console\.(log|warn|error)\(/.test(code),
};
```

---

## Phụ lục: Checklist Migration

### Trước khi bắt đầu refactor
- [ ] Có unit tests cho code hiện tại chưa? (nếu chưa, viết tests trước)
- [ ] Đã review impact của breaking changes chưa?
- [ ] Đã thống nhất với team về coding standards mới chưa?

### Thứ tự ưu tiên migration (từ impact cao → thấp)
1. **ERROR** severity → fix ngay (ảnh hưởng stability)
2. Callback Hell → Async/Await (ảnh hưởng readability nhiều nhất)
3. Untyped code → TypeScript strict (bắt lỗi compile-time)
4. Spaghetti routes → Clean Architecture (ảnh hưởng maintainability)
5. **WARNING** severity → lên kế hoạch refactor
6. Console.log → Structured logging
7. **INFO** severity → backlog
