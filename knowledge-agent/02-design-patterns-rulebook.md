# Bộ Luật Gợi Ý Design Pattern
> Tài liệu tham chiếu cho **Refactoring & Design Pattern Agent**  
> Ngôn ngữ: JavaScript / TypeScript  
> Phiên bản: 1.0

---

## Mục lục

1. [Strategy Pattern](#1-strategy-pattern)
2. [Factory / Factory Method Pattern](#2-factory--factory-method-pattern)
3. [Observer Pattern](#3-observer-pattern)
4. [Repository Pattern](#4-repository-pattern)
5. [Decorator Pattern](#5-decorator-pattern)
6. [Command Pattern](#6-command-pattern)
7. [Builder Pattern](#7-builder-pattern)
8. [Singleton Pattern](#8-singleton-pattern)
9. [Facade Pattern](#9-facade-pattern)
10. [Chain of Responsibility](#10-chain-of-responsibility)

---

## Hướng dẫn dùng tài liệu này

Mỗi pattern được mô tả theo 4 phần:

| Phần | Nội dung |
|------|----------|
| **Trigger** | Dấu hiệu trong code khiến Agent nên gợi ý pattern này |
| **Khi nào KHÔNG dùng** | Để tránh over-engineering |
| **Before / After** | Code mẫu thực tế bằng TypeScript |
| **Prompt Template** | Prompt Agent dùng để đề xuất pattern này |

---

## 1. Strategy Pattern

### Trigger — Agent gợi ý khi thấy

```typescript
// Dấu hiệu 1: if-else / switch-case theo "type" với logic khác nhau
if (paymentMethod === 'credit_card') { /* ... */ }
else if (paymentMethod === 'paypal') { /* ... */ }
else if (paymentMethod === 'bank_transfer') { /* ... */ }

// Dấu hiệu 2: Cùng function nhưng hành vi thay đổi theo config/param
function sortUsers(users, algorithm) {
  if (algorithm === 'by_name') { /* ... */ }
  else if (algorithm === 'by_date') { /* ... */ }
  else if (algorithm === 'by_score') { /* ... */ }
}
```

**Điều kiện kích hoạt:** `if/else` hoặc `switch` với ≥ 3 nhánh và logic mỗi nhánh > 5 dòng.

### Khi nào KHÔNG dùng
- Chỉ có 2 trường hợp đơn giản → dùng ternary hoặc early return
- Logic mỗi nhánh chỉ 1-2 dòng và không có khả năng mở rộng

### Before / After

**❌ Before**
```typescript
class PaymentProcessor {
  async processPayment(order: Order, method: string, data: any) {
    if (method === 'credit_card') {
      const token = await stripe.tokens.create({ card: data });
      const charge = await stripe.charges.create({
        amount: order.total,
        source: token.id,
      });
      return { success: true, transactionId: charge.id };

    } else if (method === 'paypal') {
      const payment = await paypal.payment.create({
        intent: 'sale',
        payer: { payment_method: 'paypal' },
        transactions: [{ amount: { total: order.total } }],
      });
      return { success: true, transactionId: payment.id };

    } else if (method === 'momo') {
      const result = await momoApi.createPayment({
        orderId: order.id,
        amount: order.total,
        redirectUrl: data.redirectUrl,
      });
      return { success: true, transactionId: result.requestId };

    } else if (method === 'zalopay') {
      // ... 10 more lines
    }
  }
}
```

**✅ After — Strategy Pattern**
```typescript
// payment/strategies/payment-strategy.interface.ts
export interface PaymentStrategy {
  readonly name: string;
  process(order: Order, data: unknown): Promise<PaymentResult>;
  refund(transactionId: string, amount: number): Promise<RefundResult>;
}

// payment/strategies/stripe.strategy.ts
export class StripeStrategy implements PaymentStrategy {
  readonly name = 'credit_card';

  constructor(private stripe: Stripe) {}

  async process(order: Order, data: StripePaymentData): Promise<PaymentResult> {
    const token = await this.stripe.tokens.create({ card: data.card });
    const charge = await this.stripe.charges.create({
      amount: order.total,
      source: token.id,
    });
    return { success: true, transactionId: charge.id };
  }

  async refund(transactionId: string, amount: number): Promise<RefundResult> {
    const refund = await this.stripe.refunds.create({ charge: transactionId, amount });
    return { success: true, refundId: refund.id };
  }
}

// payment/strategies/paypal.strategy.ts
export class PayPalStrategy implements PaymentStrategy {
  readonly name = 'paypal';
  // ...
}

// payment/strategies/momo.strategy.ts
export class MoMoStrategy implements PaymentStrategy {
  readonly name = 'momo';
  // ...
}

// payment/payment-processor.ts
export class PaymentProcessor {
  private strategies = new Map<string, PaymentStrategy>();

  register(strategy: PaymentStrategy): this {
    this.strategies.set(strategy.name, strategy);
    return this;
  }

  private getStrategy(method: string): PaymentStrategy {
    const strategy = this.strategies.get(method);
    if (!strategy) throw new UnsupportedPaymentMethodError(method);
    return strategy;
  }

  async processPayment(order: Order, method: string, data: unknown): Promise<PaymentResult> {
    return this.getStrategy(method).process(order, data);
  }

  async refund(method: string, transactionId: string, amount: number): Promise<RefundResult> {
    return this.getStrategy(method).refund(transactionId, amount);
  }
}

// Khởi tạo — thêm payment method mới không cần sửa PaymentProcessor
const processor = new PaymentProcessor()
  .register(new StripeStrategy(stripe))
  .register(new PayPalStrategy(paypalClient))
  .register(new MoMoStrategy(momoConfig));
```

### Prompt Template cho Agent
```
Tôi phát hiện đoạn code này có [X] nhánh if/else/switch xử lý logic khác nhau cho cùng một hành vi "[tên hành vi]".

Đây là dấu hiệu nên áp dụng Strategy Pattern vì:
- Dễ thêm [loại mới] mà không sửa code hiện có (Open/Closed Principle)
- Mỗi strategy có thể test độc lập
- Logic không còn nằm trong một mega-function

Đây là cách refactor:
[code mẫu after]
```

---

## 2. Factory / Factory Method Pattern

### Trigger — Agent gợi ý khi thấy

```typescript
// Dấu hiệu 1: `new` với điều kiện
let notification;
if (type === 'email') notification = new EmailNotification(config);
else if (type === 'sms') notification = new SMSNotification(config);
else if (type === 'push') notification = new PushNotification(config);

// Dấu hiệu 2: Constructor phức tạp với nhiều optional params
const service = new ReportService(
  new PdfRenderer(),
  new CsvExporter(),
  new EmailSender(),
  new S3Uploader(),
  logger,
  config
);
```

### Before / After

**❌ Before**
```typescript
class NotificationService {
  send(userId: string, type: string, message: string) {
    let notifier;
    if (type === 'email') {
      notifier = new EmailNotifier({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
    } else if (type === 'sms') {
      notifier = new SMSNotifier({
        accountSid: process.env.TWILIO_SID,
        authToken: process.env.TWILIO_TOKEN,
      });
    } else if (type === 'push') {
      notifier = new PushNotifier({
        serverKey: process.env.FCM_SERVER_KEY,
      });
    }
    return notifier.send(userId, message);
  }
}
```

**✅ After — Factory Pattern**
```typescript
// notification/notifiers/notifier.interface.ts
export interface Notifier {
  send(userId: string, message: string): Promise<NotificationResult>;
}

// notification/notifier.factory.ts
export class NotifierFactory {
  private static registry = new Map<string, () => Notifier>();

  static register(type: string, factory: () => Notifier): void {
    this.registry.set(type, factory);
  }

  static create(type: string): Notifier {
    const factory = this.registry.get(type);
    if (!factory) throw new Error(`Unknown notifier type: ${type}`);
    return factory();
  }
}

// bootstrap / DI container
NotifierFactory.register('email', () => new EmailNotifier({
  host: config.smtp.host,
  port: config.smtp.port,
}));
NotifierFactory.register('sms', () => new SMSNotifier({
  accountSid: config.twilio.sid,
  authToken: config.twilio.token,
}));
NotifierFactory.register('push', () => new PushNotifier({
  serverKey: config.fcm.serverKey,
}));

// notification/notification.service.ts — clean, không biết gì về implementation
export class NotificationService {
  send(userId: string, type: string, message: string): Promise<NotificationResult> {
    return NotifierFactory.create(type).send(userId, message);
  }
}
```

---

## 3. Observer Pattern

### Trigger — Agent gợi ý khi thấy

```typescript
// Dấu hiệu: Sau một hành động core, gọi nhiều side effects không liên quan
async function createOrder(data: CreateOrderDTO) {
  const order = await orderRepository.save(data);

  // Side effects lộn xộn lẫn vào business logic
  await emailService.sendOrderConfirmation(order);
  await inventoryService.reserveItems(order.items);
  await loyaltyService.addPoints(order.userId, order.total);
  await analyticsService.trackPurchase(order);
  await slackService.notifyOpsTeam(order);

  return order;
}
```

### Before / After

**❌ Before** — như ví dụ trigger ở trên

**✅ After — Observer / Event-Driven Pattern**
```typescript
// events/order.events.ts
export class OrderCreatedEvent {
  readonly name = 'order.created';
  constructor(public readonly order: Order) {}
}

// events/event-bus.ts
type EventHandler<T> = (event: T) => Promise<void>;

export class EventBus {
  private handlers = new Map<string, EventHandler<any>[]>();

  on<T>(eventName: string, handler: EventHandler<T>): void {
    const existing = this.handlers.get(eventName) ?? [];
    this.handlers.set(eventName, [...existing, handler]);
  }

  async emit<T extends { name: string }>(event: T): Promise<void> {
    const handlers = this.handlers.get(event.name) ?? [];
    // Chạy song song tất cả handlers, không block nhau
    await Promise.allSettled(handlers.map(h => h(event)));
  }
}

// Đăng ký observers ở bootstrap
eventBus.on<OrderCreatedEvent>('order.created', async ({ order }) => {
  await emailService.sendOrderConfirmation(order);
});

eventBus.on<OrderCreatedEvent>('order.created', async ({ order }) => {
  await inventoryService.reserveItems(order.items);
});

eventBus.on<OrderCreatedEvent>('order.created', async ({ order }) => {
  await loyaltyService.addPoints(order.userId, order.total);
});

// order.service.ts — chỉ làm việc core, không biết về side effects
export class OrderService {
  constructor(
    private orderRepository: OrderRepository,
    private eventBus: EventBus,
  ) {}

  async createOrder(data: CreateOrderDTO): Promise<Order> {
    const order = await this.orderRepository.save(data);
    await this.eventBus.emit(new OrderCreatedEvent(order));
    return order;
  }
}
```

---

## 4. Repository Pattern

### Trigger — Agent gợi ý khi thấy

```typescript
// Dấu hiệu: Query database trực tiếp trong service/controller
class UserService {
  async getActiveUsers() {
    return await prisma.user.findMany({    // ← business logic biết về ORM cụ thể
      where: { isActive: true, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
```

### Before / After

**❌ Before** — Direct DB queries trong service layer

**✅ After — Repository Pattern**
```typescript
// repositories/user.repository.interface.ts
export interface UserRepository {
  findById(id: UserId): Promise<User | null>;
  findActive(limit?: number): Promise<User[]>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<User>;
  delete(id: UserId): Promise<void>;
}

// repositories/prisma-user.repository.ts
export class PrismaUserRepository implements UserRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: UserId): Promise<User | null> {
    const raw = await this.prisma.user.findUnique({ where: { id } });
    return raw ? UserMapper.toDomain(raw) : null;
  }

  async findActive(limit = 100): Promise<User[]> {
    const raws = await this.prisma.user.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return raws.map(UserMapper.toDomain);
  }

  async save(user: User): Promise<User> {
    const raw = await this.prisma.user.upsert({
      where: { id: user.id },
      update: UserMapper.toPersistence(user),
      create: UserMapper.toPersistence(user),
    });
    return UserMapper.toDomain(raw);
  }

  async findByEmail(email: string): Promise<User | null> {
    const raw = await this.prisma.user.findUnique({ where: { email } });
    return raw ? UserMapper.toDomain(raw) : null;
  }

  async delete(id: UserId): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}

// Có thể swap sang MongoDB, DynamoDB mà không sửa UserService
export class MongoUserRepository implements UserRepository {
  // ...
}

// user.service.ts — không biết gì về database
export class UserService {
  constructor(private users: UserRepository) {}

  async getActiveUsers(): Promise<User[]> {
    return this.users.findActive();
  }
}
```

---

## 5. Decorator Pattern

### Trigger — Agent gợi ý khi thấy

```typescript
// Dấu hiệu: Thêm cross-cutting concerns (log, cache, retry) vào business logic
class UserService {
  async getUser(id: string) {
    console.log(`[LOG] getUser called with ${id}`);          // cross-cutting
    const cacheKey = `user:${id}`;
    const cached = await redis.get(cacheKey);                // cross-cutting
    if (cached) return JSON.parse(cached);
    try {
      const user = await db.findUser(id);                    // actual logic
      await redis.set(cacheKey, JSON.stringify(user), 'EX', 3600);
      return user;
    } catch (err) {
      console.error(`[ERROR] getUser failed: ${err}`);
      throw err;
    }
  }
}
```

### Before / After

**❌ Before** — như ví dụ trigger ở trên

**✅ After — Decorator Pattern với Higher-Order Functions**
```typescript
// decorators/cache.decorator.ts
export function withCache<T extends object>(
  target: T,
  getCacheKey: (method: keyof T, args: unknown[]) => string,
  ttlSeconds = 3600,
): T {
  return new Proxy(target, {
    get(obj, prop: string) {
      const original = obj[prop as keyof T];
      if (typeof original !== 'function') return original;

      return async (...args: unknown[]) => {
        const key = getCacheKey(prop as keyof T, args);
        const cached = await redis.get(key);
        if (cached) return JSON.parse(cached);

        const result = await original.apply(obj, args);
        await redis.set(key, JSON.stringify(result), 'EX', ttlSeconds);
        return result;
      };
    },
  });
}

// decorators/retry.decorator.ts
export function withRetry<T extends object>(target: T, maxAttempts = 3): T {
  return new Proxy(target, {
    get(obj, prop: string) {
      const original = obj[prop as keyof T];
      if (typeof original !== 'function') return original;

      return async (...args: unknown[]) => {
        let lastError: Error;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            return await original.apply(obj, args);
          } catch (err) {
            lastError = err as Error;
            if (attempt < maxAttempts) {
              await new Promise(r => setTimeout(r, 100 * attempt));
            }
          }
        }
        throw lastError!;
      };
    },
  });
}

// user.service.ts — chỉ chứa business logic thuần
class UserServiceImpl implements UserService {
  constructor(private userRepository: UserRepository) {}

  async getUser(id: UserId): Promise<User | null> {
    return this.userRepository.findById(id);
  }
}

// composition root / DI container
const userService: UserService = withRetry(
  withCache(
    new UserServiceImpl(userRepository),
    (method, [id]) => `user-service:${method}:${id}`,
    3600
  )
);
```

---

## 6. Command Pattern

### Trigger — Agent gợi ý khi thấy

```typescript
// Dấu hiệu 1: Cần undo/redo
editorHistory.push({ type: 'insert', text, position }); // manual history

// Dấu hiệu 2: Queue / retry operations
retryQueue.push({ action: 'sendEmail', params: { to, subject } });

// Dấu hiệu 3: Audit log từng thao tác
await auditLog.record('user_deleted', { userId, deletedBy, reason });
```

### Before / After

**❌ Before**
```typescript
class DocumentEditor {
  private history: Array<{ type: string; data: any }> = [];

  insertText(text: string, position: number) {
    this.document.insert(text, position);
    this.history.push({ type: 'insert', data: { text, position } });
  }

  undo() {
    const last = this.history.pop();
    if (last?.type === 'insert') {
      this.document.delete(last.data.position, last.data.text.length);
    }
    // Thêm operation mới → phải sửa undo() → vi phạm Open/Closed
  }
}
```

**✅ After — Command Pattern**
```typescript
// commands/command.interface.ts
export interface Command {
  execute(): Promise<void>;
  undo(): Promise<void>;
  description: string;
}

// commands/insert-text.command.ts
export class InsertTextCommand implements Command {
  readonly description: string;

  constructor(
    private document: Document,
    private text: string,
    private position: number,
  ) {
    this.description = `Insert "${text}" at position ${position}`;
  }

  async execute(): Promise<void> {
    await this.document.insert(this.text, this.position);
  }

  async undo(): Promise<void> {
    await this.document.delete(this.position, this.text.length);
  }
}

// commands/delete-block.command.ts
export class DeleteBlockCommand implements Command {
  private deletedContent?: string;
  readonly description: string;

  constructor(private document: Document, private start: number, private end: number) {
    this.description = `Delete block from ${start} to ${end}`;
  }

  async execute(): Promise<void> {
    this.deletedContent = await this.document.getContent(this.start, this.end);
    await this.document.delete(this.start, this.end - this.start);
  }

  async undo(): Promise<void> {
    if (this.deletedContent) {
      await this.document.insert(this.deletedContent, this.start);
    }
  }
}

// editor/command-executor.ts
export class CommandExecutor {
  private history: Command[] = [];
  private undoStack: Command[] = [];

  async execute(command: Command): Promise<void> {
    await command.execute();
    this.history.push(command);
    this.undoStack = []; // clear redo stack
    console.log(`[Executed] ${command.description}`);
  }

  async undo(): Promise<void> {
    const command = this.history.pop();
    if (!command) return;
    await command.undo();
    this.undoStack.push(command);
  }

  async redo(): Promise<void> {
    const command = this.undoStack.pop();
    if (!command) return;
    await command.execute();
    this.history.push(command);
  }
}
```

---

## 7. Builder Pattern

### Trigger — Agent gợi ý khi thấy

```typescript
// Dấu hiệu: Constructor quá nhiều params, nhiều params optional
const email = new Email(
  'noreply@company.com',
  ['user@example.com'],
  'Subject here',
  '<html>...</html>',
  null,                    // cc
  ['ops@company.com'],     // bcc
  [attachment],            // attachments
  true,                    // isHighPriority
  'text/html',             // contentType
);
// Không thể biết param nào là gì nếu không nhìn vào constructor
```

### Before / After

**❌ Before** — Constructor với nhiều params

**✅ After — Builder Pattern**
```typescript
// email/email.builder.ts
export class EmailBuilder {
  private email: Partial<Email> = {};

  from(address: string): this {
    this.email.from = address;
    return this;
  }

  to(...addresses: string[]): this {
    this.email.to = addresses;
    return this;
  }

  cc(...addresses: string[]): this {
    this.email.cc = addresses;
    return this;
  }

  bcc(...addresses: string[]): this {
    this.email.bcc = addresses;
    return this;
  }

  subject(subject: string): this {
    this.email.subject = subject;
    return this;
  }

  htmlBody(html: string): this {
    this.email.body = html;
    this.email.contentType = 'text/html';
    return this;
  }

  textBody(text: string): this {
    this.email.body = text;
    this.email.contentType = 'text/plain';
    return this;
  }

  attach(attachment: Attachment): this {
    this.email.attachments = [...(this.email.attachments ?? []), attachment];
    return this;
  }

  highPriority(): this {
    this.email.isHighPriority = true;
    return this;
  }

  build(): Email {
    if (!this.email.from) throw new Error('Email must have a sender');
    if (!this.email.to?.length) throw new Error('Email must have at least one recipient');
    if (!this.email.subject) throw new Error('Email must have a subject');
    return this.email as Email;
  }
}

// Sử dụng — self-documenting, fluent API
const email = new EmailBuilder()
  .from('noreply@company.com')
  .to('user@example.com')
  .bcc('ops@company.com')
  .subject('Order Confirmation')
  .htmlBody('<html>...</html>')
  .attach(invoicePdf)
  .highPriority()
  .build();
```

---

## 8. Singleton Pattern

### Trigger — Agent gợi ý khi thấy

```typescript
// Dấu hiệu: Tạo connection/config nhiều lần
const db1 = new DatabaseConnection(config);  // file A
const db2 = new DatabaseConnection(config);  // file B — lãng phí connection pool
```

### Khi nào KHÔNG dùng
- Trong môi trường có DI Container (NestJS, InversifyJS) — hãy để DI quản lý lifecycle
- Khi cần mock trong tests — Singleton cứng khó test

### Before / After

**✅ After — Singleton với lazy initialization (TypeScript)**
```typescript
// database/database.singleton.ts
export class DatabaseConnection {
  private static instance: DatabaseConnection | null = null;
  private pool: Pool;

  private constructor(config: DatabaseConfig) {
    this.pool = new Pool(config);
  }

  static getInstance(config?: DatabaseConfig): DatabaseConnection {
    if (!this.instance) {
      if (!config) throw new Error('Config required for first initialization');
      this.instance = new DatabaseConnection(config);
    }
    return this.instance;
  }

  // Phương thức tiện ích
  static resetInstance(): void {
    // Chỉ dùng trong tests
    this.instance = null;
  }

  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    return this.pool.query(sql, params);
  }
}

// Lần đầu — truyền config
const db = DatabaseConnection.getInstance(config);

// Các lần sau — không cần config
const db = DatabaseConnection.getInstance();
```

---

## 9. Facade Pattern

### Trigger — Agent gợi ý khi thấy

```typescript
// Dấu hiệu: Controller/handler phải tương tác với quá nhiều services
async function checkoutController(req, res) {
  // Controller biết quá nhiều về flow chi tiết
  await cartService.validate(req.body.cartId);
  const cart = await cartService.getCart(req.body.cartId);
  await inventoryService.lock(cart.items);
  const order = await orderService.create(cart, req.user);
  const payment = await paymentService.charge(order, req.body.payment);
  await orderService.confirm(order.id, payment.id);
  await emailService.sendConfirmation(req.user.email, order);
  await cartService.clear(req.body.cartId);
  res.json({ orderId: order.id });
}
```

### Before / After

**❌ Before** — như ví dụ trigger

**✅ After — Facade Pattern**
```typescript
// checkout/checkout.facade.ts
export class CheckoutFacade {
  constructor(
    private cartService: CartService,
    private inventoryService: InventoryService,
    private orderService: OrderService,
    private paymentService: PaymentService,
    private notificationService: NotificationService,
  ) {}

  async checkout(userId: UserId, cartId: CartId, paymentData: PaymentDTO): Promise<CheckoutResult> {
    // Facade đóng gói toàn bộ flow phức tạp
    const cart = await this.cartService.validateAndGet(cartId, userId);
    const lock = await this.inventoryService.lockItems(cart.items);

    try {
      const order = await this.orderService.create(cart, userId);
      const payment = await this.paymentService.charge(order, paymentData);
      await this.orderService.confirm(order.id, payment.id);
      await this.notificationService.notifyOrderCreated(userId, order);
      await this.cartService.clear(cartId);
      return { success: true, orderId: order.id };
    } catch (error) {
      await this.inventoryService.releaseLock(lock);
      throw error;
    }
  }
}

// Controller — chỉ gọi facade, không biết chi tiết
async function checkoutController(req: Request, res: Response) {
  const result = await checkoutFacade.checkout(
    req.user.id,
    req.body.cartId,
    req.body.payment,
  );
  res.json(result);
}
```

---

## 10. Chain of Responsibility

### Trigger — Agent gợi ý khi thấy

```typescript
// Dấu hiệu: Chuỗi kiểm tra/xử lý tuần tự với early exit
async function processRequest(req: Request) {
  if (!req.headers.authorization) {
    return { error: 'No auth header' };
  }
  const token = verifyToken(req.headers.authorization);
  if (!token) {
    return { error: 'Invalid token' };
  }
  if (isTokenExpired(token)) {
    return { error: 'Token expired' };
  }
  if (!hasPermission(token.userId, req.path)) {
    return { error: 'Permission denied' };
  }
  if (isRateLimited(token.userId)) {
    return { error: 'Rate limit exceeded' };
  }
  // ... actual logic
}
```

### Before / After

**❌ Before** — như ví dụ trigger

**✅ After — Chain of Responsibility (Middleware Pipeline)**
```typescript
// middleware/handler.interface.ts
export interface Handler<T, R> {
  setNext(handler: Handler<T, R>): Handler<T, R>;
  handle(request: T): Promise<R | null>;
}

// middleware/abstract.handler.ts
export abstract class AbstractHandler<T, R> implements Handler<T, R> {
  private nextHandler?: Handler<T, R>;

  setNext(handler: Handler<T, R>): Handler<T, R> {
    this.nextHandler = handler;
    return handler;
  }

  protected async passToNext(request: T): Promise<R | null> {
    return this.nextHandler?.handle(request) ?? null;
  }

  abstract handle(request: T): Promise<R | null>;
}

// middleware/auth.handler.ts
export class AuthHandler extends AbstractHandler<Request, Response> {
  async handle(req: Request): Promise<Response | null> {
    if (!req.headers.authorization) {
      return { status: 401, error: 'No auth header' };
    }
    return this.passToNext(req);
  }
}

// middleware/token-validation.handler.ts
export class TokenValidationHandler extends AbstractHandler<Request, Response> {
  async handle(req: Request): Promise<Response | null> {
    const token = verifyToken(req.headers.authorization!);
    if (!token || isTokenExpired(token)) {
      return { status: 401, error: 'Invalid or expired token' };
    }
    req.user = token;
    return this.passToNext(req);
  }
}

// middleware/permission.handler.ts
export class PermissionHandler extends AbstractHandler<Request, Response> {
  async handle(req: Request): Promise<Response | null> {
    if (!hasPermission(req.user.id, req.path)) {
      return { status: 403, error: 'Permission denied' };
    }
    return this.passToNext(req);
  }
}

// middleware/rate-limit.handler.ts
export class RateLimitHandler extends AbstractHandler<Request, Response> {
  async handle(req: Request): Promise<Response | null> {
    if (await isRateLimited(req.user.id)) {
      return { status: 429, error: 'Rate limit exceeded' };
    }
    return this.passToNext(req);
  }
}

// Xây dựng chain — dễ thêm/bỏ/sắp xếp lại
const pipeline = new AuthHandler();
pipeline
  .setNext(new TokenValidationHandler())
  .setNext(new PermissionHandler())
  .setNext(new RateLimitHandler());

async function processRequest(req: Request) {
  const error = await pipeline.handle(req);
  if (error) return error;
  // ... actual logic
}
```

---

## Phụ lục: Ma trận Trigger → Pattern

| Dấu hiệu trong code | Pattern nên gợi ý |
|---------------------|-------------------|
| `if/else` hoặc `switch` với ≥ 3 nhánh logic khác nhau | **Strategy** |
| `new ClassName(type)` với điều kiện | **Factory** |
| Sau 1 action core gọi nhiều side effects | **Observer / Event Bus** |
| Query DB/ORM trực tiếp trong service | **Repository** |
| Log, cache, retry lẫn trong business logic | **Decorator** |
| Cần undo/redo hoặc audit trail | **Command** |
| Constructor với > 4 optional params | **Builder** |
| Tạo connection/client lặp lại | **Singleton** |
| Controller biết quá nhiều về flow chi tiết | **Facade** |
| Chuỗi kiểm tra tuần tự với early return | **Chain of Responsibility** |

## Phụ lục: Prompt Template cho Agent

```typescript
export const DESIGN_PATTERN_SYSTEM_PROMPT = `
Bạn là senior TypeScript architect. Phân tích code và xác định design pattern phù hợp.

Khi phát hiện trigger, trả về JSON:
{
  "patternSuggestions": [
    {
      "pattern": "Strategy | Factory | Observer | Repository | Decorator | Command | Builder | Singleton | Facade | ChainOfResponsibility",
      "confidence": number, // 0.0 - 1.0
      "trigger": "Mô tả dấu hiệu cụ thể trong code",
      "benefit": "Lý do áp dụng pattern này",
      "refactoredCode": "Code mẫu sau khi áp dụng pattern (TypeScript)",
      "effort": "LOW | MEDIUM | HIGH",
      "breakingChange": boolean
    }
  ]
}

Chỉ gợi ý khi confidence > 0.7. Ưu tiên simplicity — đừng over-engineer.
`;
```
