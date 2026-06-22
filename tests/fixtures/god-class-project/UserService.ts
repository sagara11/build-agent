import { Database } from './database';
import { Logger } from './logger';
import { CacheService } from './cache';
import { EmailService } from './email';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateUserDto {
  name: string;
  email: string;
  role?: string;
}

interface UpdateUserDto {
  name?: string;
  email?: string;
  role?: string;
  status?: string;
}

export class UserService {
  constructor(
    private db: Database,
    private logger: Logger,
    private cache: CacheService,
    private email: EmailService
  ) {}

  async createUser(dto: CreateUserDto): Promise<User> {
    this.logger.info(`Creating user: ${dto.email}`);
    if (!dto.email || !dto.name) {
      throw new Error('Name and email are required');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(dto.email)) {
      throw new Error('Invalid email format');
    }
    if (dto.name.length < 2 || dto.name.length > 100) {
      throw new Error('Name must be between 2 and 100 characters');
    }
    const existing = await this.db.query(
      'SELECT * FROM users WHERE email = ?',
      [dto.email]
    );
    if (existing) {
      throw new Error('User already exists');
    }
    const normalizedEmail = dto.email.toLowerCase().trim();
    const user: User = {
      id: this.generateId(),
      name: dto.name.trim(),
      email: normalizedEmail,
      role: dto.role || 'user',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.db.execute(
      'INSERT INTO users (id, name, email, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [user.id, user.name, user.email, user.role, user.status, user.createdAt, user.updatedAt]
    );
    await this.cache.set(`user:${user.id}`, user, 3600);
    await this.email.send(
      user.email,
      'Welcome!',
      `Hello ${user.name}, welcome to our platform. Your account has been created successfully.`
    );
    this.logger.info(`User created successfully: ${user.id} (${user.email})`);
    return user;
  }

  async getUserById(id: string): Promise<User | null> {
    const cached = await this.cache.get(`user:${id}`);
    if (cached) {
      this.logger.info(`Cache hit for user: ${id}`);
      return cached as User;
    }
    const result = await this.db.query(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );
    if (!result) {
      this.logger.warn(`User not found: ${id}`);
      return null;
    }
    const user = result as User;
    await this.cache.set(`user:${id}`, user, 3600);
    return user;
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.getUserById(id);
    if (!user) {
      throw new Error('User not found');
    }
    const updated: User = {
      ...user,
      ...dto,
      updatedAt: new Date(),
    };
    const fields: string[] = [];
    const values: unknown[] = [];
    if (dto.name) {
      fields.push('name = ?');
      values.push(dto.name);
    }
    if (dto.email) {
      fields.push('email = ?');
      values.push(dto.email);
    }
    if (dto.role) {
      fields.push('role = ?');
      values.push(dto.role);
    }
    if (dto.status) {
      fields.push('status = ?');
      values.push(dto.status);
    }
    fields.push('updated_at = ?');
    values.push(updated.updatedAt);
    values.push(id);
    await this.db.execute(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    await this.cache.set(`user:${id}`, updated, 3600);
    this.logger.info(`User updated: ${id}`);
    return updated;
  }

  async deleteUser(id: string): Promise<void> {
    const user = await this.getUserById(id);
    if (!user) {
      throw new Error('User not found');
    }
    await this.db.execute('DELETE FROM users WHERE id = ?', [id]);
    await this.cache.delete(`user:${id}`);
    this.logger.info(`User deleted: ${id}`);
  }

  async listUsers(page: number, limit: number): Promise<User[]> {
    const offset = (page - 1) * limit;
    this.logger.info(`Listing users: page=${page}, limit=${limit}`);
    const results = await this.db.query(
      'SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    if (!results) {
      return [];
    }
    return results as User[];
  }

  async searchUsers(query: string): Promise<User[]> {
    this.logger.info(`Searching users: ${query}`);
    if (!query || query.length < 2) {
      throw new Error('Search query too short');
    }
    const results = await this.db.query(
      'SELECT * FROM users WHERE name LIKE ? OR email LIKE ?',
      [`%${query}%`, `%${query}%`]
    );
    if (!results) {
      return [];
    }
    return results as User[];
  }

  async activateUser(id: string): Promise<User> {
    const user = await this.getUserById(id);
    if (!user) {
      throw new Error('User not found');
    }
    if (user.status === 'active') {
      this.logger.warn(`User already active: ${id}`);
      return user;
    }
    return this.updateUser(id, { status: 'active' });
  }

  async deactivateUser(id: string): Promise<User> {
    const user = await this.getUserById(id);
    if (!user) {
      throw new Error('User not found');
    }
    if (user.status === 'inactive') {
      this.logger.warn(`User already inactive: ${id}`);
      return user;
    }
    return this.updateUser(id, { status: 'inactive' });
  }

  async changeRole(id: string, newRole: string): Promise<User> {
    const validRoles = ['user', 'admin', 'moderator', 'editor'];
    if (!validRoles.includes(newRole)) {
      throw new Error(`Invalid role: ${newRole}`);
    }
    const user = await this.getUserById(id);
    if (!user) {
      throw new Error('User not found');
    }
    this.logger.info(`Changing role for ${id}: ${user.role} -> ${newRole}`);
    return this.updateUser(id, { role: newRole });
  }

  async resetPassword(id: string): Promise<void> {
    const user = await this.getUserById(id);
    if (!user) {
      throw new Error('User not found');
    }
    const tempPassword = this.generateTempPassword();
    await this.db.execute(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [tempPassword, id]
    );
    await this.email.send(
      user.email,
      'Password Reset',
      `Your temporary password is: ${tempPassword}`
    );
    this.logger.info(`Password reset for user: ${id}`);
  }

  async sendNotification(id: string, subject: string, body: string): Promise<void> {
    const user = await this.getUserById(id);
    if (!user) {
      throw new Error('User not found');
    }
    if (user.status !== 'active') {
      this.logger.warn(`Cannot notify inactive user: ${id}`);
      return;
    }
    await this.email.send(user.email, subject, body);
    this.logger.info(`Notification sent to user: ${id}`);
  }

  async bulkNotify(userIds: string[], subject: string, body: string): Promise<void> {
    const emails: string[] = [];
    for (const id of userIds) {
      const user = await this.getUserById(id);
      if (user && user.status === 'active') {
        emails.push(user.email);
      } else {
        this.logger.warn(`Skipping notification for user: ${id}`);
      }
    }
    if (emails.length > 0) {
      await this.email.sendBulk(emails, subject, body);
      this.logger.info(`Bulk notification sent to ${emails.length} users`);
    }
  }

  async getUserStats(id: string): Promise<Record<string, unknown>> {
    const user = await this.getUserById(id);
    if (!user) {
      throw new Error('User not found');
    }
    this.logger.info(`Fetching stats for user: ${id}`);
    const loginCount = await this.db.query(
      'SELECT COUNT(*) as count FROM login_history WHERE user_id = ?',
      [id]
    );
    const lastLogin = await this.db.query(
      'SELECT MAX(login_at) as last FROM login_history WHERE user_id = ?',
      [id]
    );
    const actionCount = await this.db.query(
      'SELECT COUNT(*) as count FROM user_actions WHERE user_id = ?',
      [id]
    );
    const sessionCount = await this.db.query(
      'SELECT COUNT(*) as count FROM user_sessions WHERE user_id = ? AND active = true',
      [id]
    );
    return {
      user,
      loginCount,
      lastLogin,
      actionCount,
      sessionCount,
      accountAge: Date.now() - user.createdAt.getTime(),
      isActive: user.status === 'active',
    };
  }

  async exportUserData(id: string): Promise<string> {
    const user = await this.getUserById(id);
    if (!user) {
      throw new Error('User not found');
    }
    this.logger.info(`Starting data export for user: ${id}`);
    const stats = await this.getUserStats(id);
    const loginHistory = await this.db.query(
      'SELECT * FROM login_history WHERE user_id = ? ORDER BY login_at DESC',
      [id]
    );
    const actions = await this.db.query(
      'SELECT * FROM user_actions WHERE user_id = ? ORDER BY created_at DESC',
      [id]
    );
    const preferences = await this.db.query(
      'SELECT * FROM user_preferences WHERE user_id = ?',
      [id]
    );
    const sessions = await this.db.query(
      'SELECT * FROM user_sessions WHERE user_id = ? ORDER BY created_at DESC',
      [id]
    );
    const notifications = await this.db.query(
      'SELECT * FROM user_notifications WHERE user_id = ? ORDER BY sent_at DESC LIMIT 100',
      [id]
    );
    const exportData = {
      user,
      stats,
      loginHistory,
      actions,
      preferences,
      sessions,
      notifications,
      exportedAt: new Date().toISOString(),
      exportVersion: '2.0',
    };
    const jsonOutput = JSON.stringify(exportData, null, 2);
    this.logger.info(`Data exported for user: ${id}, size: ${jsonOutput.length} bytes`);
    return jsonOutput;
  }

  async mergeAccounts(primaryId: string, secondaryId: string): Promise<User> {
    const primary = await this.getUserById(primaryId);
    const secondary = await this.getUserById(secondaryId);
    if (!primary || !secondary) {
      throw new Error('One or both users not found');
    }
    if (primary.status !== 'active' || secondary.status !== 'active') {
      throw new Error('Both accounts must be active to merge');
    }
    if (primaryId === secondaryId) {
      throw new Error('Cannot merge account with itself');
    }
    const primaryStats = await this.db.query(
      'SELECT COUNT(*) as count FROM user_actions WHERE user_id = ?',
      [primaryId]
    );
    const secondaryStats = await this.db.query(
      'SELECT COUNT(*) as count FROM user_actions WHERE user_id = ?',
      [secondaryId]
    );
    this.logger.info(
      `Merging accounts: primary=${primaryId} (${(primaryStats as {count: number})?.count || 0} actions), ` +
      `secondary=${secondaryId} (${(secondaryStats as {count: number})?.count || 0} actions)`
    );
    await this.db.execute(
      'UPDATE user_actions SET user_id = ? WHERE user_id = ?',
      [primaryId, secondaryId]
    );
    await this.db.execute(
      'UPDATE login_history SET user_id = ? WHERE user_id = ?',
      [primaryId, secondaryId]
    );
    await this.db.execute(
      'UPDATE user_preferences SET user_id = ? WHERE user_id = ?',
      [primaryId, secondaryId]
    );
    await this.db.execute(
      'UPDATE user_sessions SET user_id = ? WHERE user_id = ?',
      [primaryId, secondaryId]
    );
    await this.deleteUser(secondaryId);
    await this.email.send(
      primary.email,
      'Account Merged',
      `Your account has been merged with ${secondary.email}. All data has been transferred.`
    );
    await this.email.send(
      secondary.email,
      'Account Merged',
      `Your account has been merged into ${primary.email}. This account is now deactivated.`
    );
    this.logger.info(`Accounts merged successfully: ${primaryId} <- ${secondaryId}`);
    await this.cache.delete(`user:${primaryId}`);
    await this.cache.delete(`user:${secondaryId}`);
    return primary;
  }

  async cleanupInactiveUsers(daysInactive: number): Promise<number> {
    if (daysInactive < 1) {
      throw new Error('Days inactive must be positive');
    }
    this.logger.info(`Starting cleanup: removing users inactive for ${daysInactive}+ days`);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysInactive);
    const inactiveUsers = await this.db.query(
      'SELECT id, email, name FROM users WHERE status = ? AND updated_at < ?',
      ['inactive', cutoffDate.toISOString()]
    );
    if (!inactiveUsers) {
      this.logger.info('No inactive users found for cleanup');
      return 0;
    }
    const users = inactiveUsers as Array<{ id: string; email: string; name: string }>;
    this.logger.info(`Found ${users.length} inactive users for potential cleanup`);
    let deletedCount = 0;
    for (const user of users) {
      try {
        await this.deleteUser(user.id);
        await this.email.send(
          user.email,
          'Account Removed',
          `Hello ${user.name}, your account has been removed due to inactivity.`
        );
        deletedCount++;
      } catch (err) {
        this.logger.error(`Failed to delete user ${user.id}`, err as Error);
      }
    }
    this.logger.info(`Cleanup complete: ${deletedCount}/${users.length} inactive users removed`);
    return deletedCount;
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
  }

  private generateTempPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}
