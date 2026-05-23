import { Hono } from "hono";
import type { Env } from './core-utils';
import { UserEntity, AccountEntity, TransactionEntity, InvoiceEntity } from "./entities";
import { ok, bad, notFound, isStr } from './core-utils';
import type { User, TelegramAccount, ApiResponse, CreateInvoiceResponse } from "@shared/types";
export function userRoutes(app: Hono<{ Bindings: Env }>) {
  // AUTH
  app.post('/api/auth/login', async (c) => {
    const { identifier } = (await c.req.json()) as { identifier?: string };
    if (!identifier || identifier.trim().length < 3) {
      return bad(c, "Никнейм должен быть не короче 3 символов");
    }
    const id = identifier.trim().toLowerCase();
    const userEntity = new UserEntity(c.env, id);
    if (await userEntity.exists()) {
      return ok(c, await userEntity.getState());
    }
    const newUser: User = {
      id,
      email: id,
      balance: 0,
      purchasedAccountIds: []
    };
    return ok(c, await UserEntity.create(c.env, newUser));
  });
  // PROFILE
  app.get('/api/profile/:id', async (c) => {
    const id = c.req.param('id').toLowerCase();
    const user = new UserEntity(c.env, id);
    if (!await user.exists()) return notFound(c, "Пользователь не найден");
    return ok(c, await user.getState());
  });
  app.get('/api/profile/:id/purchases', async (c) => {
    const id = c.req.param('id').toLowerCase();
    const userEntity = new UserEntity(c.env, id);
    if (!await userEntity.exists()) return notFound(c, "Пользователь не найден");
    const user = await userEntity.getState();
    const accounts: TelegramAccount[] = [];
    for (const accId of user.purchasedAccountIds || []) {
      const acc = new AccountEntity(c.env, accId);
      if (await acc.exists()) {
        accounts.push(await acc.getState());
      }
    }
    return ok(c, accounts);
  });
  // STORE / ACCOUNTS
  app.get('/api/accounts', async (c) => {
    await AccountEntity.ensureSeed(c.env);
    const cursor = c.req.query('cursor');
    const limit = c.req.query('limit') ? Number(c.req.query('limit')) : 100;
    const page = await AccountEntity.list(c.env, cursor, limit);
    // Filter only available for public store
    page.items = page.items.filter(a => a.status === 'available');
    return ok(c, page);
  });
  app.post('/api/accounts/buy', async (c) => {
    const { email, accountId } = (await c.req.json()) as { email?: string, accountId?: string };
    if (!email || !accountId) return bad(c, "Email and Account ID required");
    const userId = email.toLowerCase();
    const userEntity = new UserEntity(c.env, userId);
    const accountEntity = new AccountEntity(c.env, accountId);
    if (!await userEntity.exists()) return notFound(c, "User not found");
    if (!await accountEntity.exists()) return notFound(c, "Account not found");
    const user = await userEntity.getState();
    const account = await accountEntity.getState();
    if (account.status !== 'available') return bad(c, "Account already sold");
    if (user.balance < account.price) return bad(c, "ERR_LOW_BALANCE");
    // Atomic updates
    await userEntity.mutate(s => ({
      ...s,
      balance: Number((s.balance - account.price).toFixed(2)),
      purchasedAccountIds: [...(s.purchasedAccountIds || []), account.id]
    }));
    await accountEntity.mutate(s => ({
      ...s,
      status: 'sold'
    }));
    // Record transaction
    await TransactionEntity.create(c.env, {
      id: crypto.randomUUID(),
      userId,
      amount: account.price,
      type: 'purchase',
      timestamp: Date.now(),
      accountId: account.id
    });
    return ok(c, { success: true });
  });
  app.get('/api/accounts/get-code/:id', async (c) => {
    const id = c.req.param('id');
    const email = c.req.query('email')?.toLowerCase();
    if (!email) return bad(c, "Email required");
    const userEntity = new UserEntity(c.env, email);
    if (!await userEntity.exists()) return notFound(c, "User not found");
    const user = await userEntity.getState();
    if (!user.purchasedAccountIds.includes(id)) return bad(c, "Account not purchased");
    const accountEntity = new AccountEntity(c.env, id);
    if (!await accountEntity.exists()) return notFound(c, "Account not found");
    const account = await accountEntity.getState();
    // Simulation of code retrieval
    return ok(c, {
      code: Math.floor(100000 + Math.random() * 900000).toString(),
      status: 'ready',
      timestamp: Date.now(),
      message: "Код успешно получен из сессии."
    });
  });
  // PAYMENTS
  app.post('/api/payments/create-invoice', async (c) => {
    const { amount, email } = (await c.req.json()) as { amount: number, email: string };
    if (!amount || amount <= 0) return bad(c, "Invalid amount");
    const invoiceId = Math.floor(Math.random() * 1000000).toString();
    // In a real scenario, we would call CryptoBot API here.
    // Mocking the response for now as requested.
    const mockPayUrl = `https://t.me/CryptoBot?start=pay_${invoiceId}`;
    await InvoiceEntity.create(c.env, {
      id: invoiceId,
      userEmail: email.toLowerCase(),
      amount: amount,
      status: 'active',
      timestamp: Date.now()
    });
    return ok(c, {
      payUrl: mockPayUrl,
      invoiceId: Number(invoiceId)
    } as CreateInvoiceResponse);
  });
  // ADMIN ROUTES
  app.get('/api/admin/users', async (c) => {
    const page = await UserEntity.list(c.env, null, 100);
    return ok(c, page);
  });
  app.get('/api/admin/accounts', async (c) => {
    const page = await AccountEntity.list(c.env, null, 100);
    return ok(c, page);
  });
  app.post('/api/admin/accounts', async (c) => {
    const data = (await c.req.json()) as Partial<TelegramAccount>;
    if (!data.price || !data.details) return bad(c, "Price and Details required");
    const account = await AccountEntity.create(c.env, {
      id: crypto.randomUUID(),
      category: data.category || 'New',
      price: Number(data.price),
      country: data.country || 'Unknown',
      countryCode: data.countryCode || 'US',
      age: data.age || '1 month',
      status: 'available',
      description: data.description || '',
      details: data.details,
      phoneNumber: data.phoneNumber || '',
      codeStatus: 'waiting'
    });
    return ok(c, account);
  });
  app.delete('/api/admin/accounts/:id', async (c) => {
    const id = c.req.param('id');
    const deleted = await AccountEntity.delete(c.env, id);
    return ok(c, { deleted });
  });
  app.post('/api/admin/users/update-balance', async (c) => {
    const { email, amount } = (await c.req.json()) as { email: string, amount: number };
    const userEntity = new UserEntity(c.env, email.toLowerCase());
    if (!await userEntity.exists()) return notFound(c, "User not found");
    const updated = await userEntity.mutate(s => ({
      ...s,
      balance: Number(amount.toFixed(2))
    }));
    return ok(c, updated);
  });
}