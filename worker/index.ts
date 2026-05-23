import type { Hono } from "hono";
import { AccountEntity, InvoiceEntity, TransactionEntity, UserEntity } from "./entities";
import type { Env } from "./core-utils";
import { GlobalDurableObject, isStr } from "./core-utils";
import type { TelegramAccount, Transaction, User } from "@shared/types";

export { GlobalDurableObject };

const DEFAULT_PAGE_LIMIT = 100;
const CRYPTO_PAY_API_URL = "https://pay.crypt.bot/api";
const MAX_ACCOUNT_DETAILS_LENGTH = 4000;
const MAX_BRIDGE_RESPONSE_MESSAGE_LENGTH = 500;

type RuntimeEnv = Env & {
  CRYPTO_PAY_TOKEN?: string;
  CRYPTO_PAY_API_URL?: string;
  TELEGRAM_CODE_BRIDGE_URL?: string;
  TELEGRAM_CODE_BRIDGE_TOKEN?: string;
  ASSETS: Fetcher;
};

type CryptoPayInvoice = {
  invoice_id: number;
  status: "active" | "paid" | "expired";
  amount: string;
  payload?: string;
  bot_invoice_url?: string;
  mini_app_invoice_url?: string;
  web_app_invoice_url?: string;
  pay_url?: string;
};

type CryptoPayResponse<T> = {
  ok: boolean;
  result?: T;
  error?: string;
};

type CryptoPayInvoiceList = {
  items?: CryptoPayInvoice[];
};

type CodeLookupResult = {
  code: string | null;
  status: "ready" | "waiting" | "bridge_not_configured" | "error";
  message: string;
  source: "saved" | "telegram_bridge";
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
      "access-control-allow-headers": "Content-Type, Authorization",
    },
  });
}

function ok<T>(data: T): Response {
  return json({ success: true, data });
}

function bad(error: string): Response {
  return json({ success: false, error }, 400);
}

function notFound(error = "not found"): Response {
  return json({ success: false, error }, 404);
}

function pageLimit(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 200) : DEFAULT_PAGE_LIMIT;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email && email.includes("@") ? email : null;
}

function normalizeText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function hasUnsafeControlChars(value: string): boolean {
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value);
}

function normalizePhoneNumber(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const phone = value.trim();
  return phone ? phone : undefined;
}

function getCryptoPayToken(env: RuntimeEnv): string | null {
  return typeof env.CRYPTO_PAY_TOKEN === "string" && env.CRYPTO_PAY_TOKEN.trim()
    ? env.CRYPTO_PAY_TOKEN.trim()
    : null;
}

async function cryptoPay<T>(env: RuntimeEnv, method: string, body: Record<string, unknown> = {}): Promise<T> {
  const token = getCryptoPayToken(env);
  if (!token) throw new Error("Payment gateway is not configured");

  const baseUrl = (env.CRYPTO_PAY_API_URL || CRYPTO_PAY_API_URL).replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/${method}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Crypto-Pay-API-Token": token,
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as CryptoPayResponse<T> | null;
  if (!response.ok || !payload?.ok || payload.result === undefined) {
    throw new Error(payload?.error || `Crypto Pay request failed (${response.status})`);
  }

  return payload.result;
}

function invoiceUrl(invoice: CryptoPayInvoice): string | null {
  return invoice.mini_app_invoice_url || invoice.bot_invoice_url || invoice.web_app_invoice_url || invoice.pay_url || null;
}

function extractLoginCode(account: TelegramAccount): string | null {
  const values = [account.lastCode, account.details, account.description].filter(isStr).join("\n");
  const labeled = values.match(/(?:code|код|login_code|auth_code|telegram code|tg code)\s*[:=\-]?\s*(\d{5,6})/i);
  if (labeled?.[1]) return labeled[1];
  const plain = values.match(/(?<!\d)\d{5,6}(?!\d)/);
  return plain?.[0] || null;
}

function normalizeCode(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const match = String(value).match(/(?<!\d)\d{5,6}(?!\d)/);
  return match?.[0] || null;
}

function bridgeUrl(env: RuntimeEnv): string | null {
  const raw = env.TELEGRAM_CODE_BRIDGE_URL;
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

async function lookupCodeFromBridge(
  env: RuntimeEnv,
  account: TelegramAccount,
  email: string,
): Promise<CodeLookupResult | null> {
  const url = bridgeUrl(env);
  if (!url) return null;

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (typeof env.TELEGRAM_CODE_BRIDGE_TOKEN === "string" && env.TELEGRAM_CODE_BRIDGE_TOKEN.trim()) {
    headers.authorization = `Bearer ${env.TELEGRAM_CODE_BRIDGE_TOKEN.trim()}`;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        accountId: account.id,
        requesterEmail: email,
        phoneNumber: account.phoneNumber,
        sessionString: account.details,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const code = normalizeCode(payload.code);
    const message = typeof payload.message === "string"
      ? payload.message.slice(0, MAX_BRIDGE_RESPONSE_MESSAGE_LENGTH)
      : "";

    if (response.ok && code) {
      return {
        code,
        status: "ready",
        message: message || "Код получен из подключенного Telegram bridge.",
        source: "telegram_bridge",
      };
    }

    return {
      code: null,
      status: response.ok ? "waiting" : "error",
      message: message || "Telegram bridge не вернул новый код. Попробуйте запросить код еще раз через минуту.",
      source: "telegram_bridge",
    };
  } catch (error) {
    console.error("[TELEGRAM BRIDGE]", error);
    return {
      code: null,
      status: "error",
      message: "Telegram bridge недоступен. Проверьте внешний Telethon-сервис и токен bridge.",
      source: "telegram_bridge",
    };
  }
}

async function lookupLoginCode(
  env: RuntimeEnv,
  account: TelegramAccount,
  email: string,
  forceRefresh: boolean,
): Promise<CodeLookupResult> {
  if (forceRefresh || !account.lastCode) {
    const bridgeResult = await lookupCodeFromBridge(env, account, email);
    if (bridgeResult) return bridgeResult;
  }

  const savedCode = extractLoginCode(account);
  if (savedCode) {
    return {
      code: savedCode,
      status: "ready",
      message: "Код найден в сохраненных данных аккаунта.",
      source: "saved",
    };
  }

  return {
    code: null,
    status: bridgeUrl(env) ? "waiting" : "bridge_not_configured",
    message: bridgeUrl(env)
      ? "Код пока не найден. Нажмите «Запросить снова» после отправки кода в Telegram."
      : "Автоматическое получение из Telegram требует внешний Telethon bridge. Сейчас сайт может показать только код, сохраненный в поле Last code или внутри Session Payload.",
    source: "saved",
  };
}

async function createAccountFromInput(env: Env, input: Partial<TelegramAccount>): Promise<TelegramAccount> {
  const price = Number(input.price);
  const description = normalizeText(input.description);
  const details = normalizeText(input.details);
  if (!details || !Number.isFinite(price) || price <= 0) {
    throw new Error("details and valid price required");
  }
  if (details.length > MAX_ACCOUNT_DETAILS_LENGTH || hasUnsafeControlChars(details)) {
    throw new Error("Account details must be plain text and under 4000 characters");
  }

  return AccountEntity.create(env, {
    id: crypto.randomUUID(),
    category: input.category || "New",
    price,
    country: input.country || "Россия",
    countryCode: input.countryCode || "RU",
    age: input.age || "1 месяц",
    status: "available",
    description,
    details,
    phoneNumber: normalizePhoneNumber(input.phoneNumber),
    lastCode: normalizeText(input.lastCode),
    codeStatus: normalizeText(input.lastCode) ? "ready" : "waiting",
    codeUpdatedAt: normalizeText(input.lastCode) ? Date.now() : undefined,
  });
}

function invoicePayload(invoice: CryptoPayInvoice): { email: string; amount: number } | null {
  if (typeof invoice.payload !== "string") return null;
  try {
    const payload = JSON.parse(invoice.payload) as { email?: unknown; amount?: unknown };
    const email = normalizeEmail(payload.email);
    const amount = Number(payload.amount);
    return email && Number.isFinite(amount) && amount > 0 ? { email, amount } : null;
  } catch {
    return null;
  }
}

async function createCryptoInvoice(env: RuntimeEnv, email: string, amount: number): Promise<CryptoPayInvoice> {
  const invoice = await cryptoPay<CryptoPayInvoice>(env, "createInvoice", {
    currency_type: "fiat",
    fiat: "USD",
    accepted_assets: "USDT,TON,BTC",
    amount: amount.toFixed(2),
    description: `Milfa Sell balance top-up for ${email}`,
    hidden_message: "Payment received. Return to Milfa Sell and tap Check payment.",
    payload: JSON.stringify({ email, amount: amount.toFixed(2), ts: Date.now() }),
    allow_comments: false,
    allow_anonymous: false,
    expires_in: 3600,
  });

  if (!invoice.invoice_id || !invoiceUrl(invoice)) {
    throw new Error("Crypto Pay did not return a payable invoice URL");
  }

  return invoice;
}

async function getCryptoInvoice(env: RuntimeEnv, invoiceId: string): Promise<CryptoPayInvoice | null> {
  const invoices = await cryptoPay<CryptoPayInvoice[] | CryptoPayInvoiceList>(env, "getInvoices", {
    invoice_ids: invoiceId,
    count: 1,
  });
  return Array.isArray(invoices) ? invoices[0] || null : invoices.items?.[0] || null;
}

async function listCryptoInvoices(env: RuntimeEnv, status?: "active" | "paid" | "expired"): Promise<CryptoPayInvoice[]> {
  const invoices = await cryptoPay<CryptoPayInvoice[] | CryptoPayInvoiceList>(env, "getInvoices", {
    count: 100,
    ...(status ? { status } : {}),
  });
  return Array.isArray(invoices) ? invoices : invoices.items || [];
}

async function settleInvoice(env: RuntimeEnv, invoiceId: string, remoteInvoice: CryptoPayInvoice | null): Promise<Record<string, unknown>> {
  const invoiceEntity = new InvoiceEntity(env, invoiceId);
  let localInvoice = (await invoiceEntity.exists()) ? await invoiceEntity.getState() : null;

  if (!localInvoice) {
    if (!remoteInvoice) throw new Error("Invoice not found");
    const payload = invoicePayload(remoteInvoice);
    if (!payload) throw new Error("Invoice not found");
    try {
      await InvoiceEntity.create(env, {
        id: invoiceId,
        userEmail: payload.email,
        amount: payload.amount,
        status: remoteInvoice.status || "active",
        timestamp: Date.now(),
      });
    } catch {
      // A concurrent verification may have created the invoice first.
    }
    localInvoice = await invoiceEntity.getState();
  }

  const remoteStatus = remoteInvoice?.status || localInvoice.status;
  let shouldCredit = false;
  const updatedInvoice = await invoiceEntity.mutate((current) => {
    shouldCredit = false;
    const normalized = {
      ...current,
      id: current.id || invoiceId,
      userEmail: current.userEmail || localInvoice!.userEmail,
      amount: Number(current.amount || localInvoice!.amount),
      timestamp: current.timestamp || localInvoice!.timestamp || Date.now(),
    };

    if (remoteStatus === "paid") {
      if (normalized.creditedAt) return { ...normalized, status: "paid" };
      shouldCredit = true;
      return { ...normalized, status: "paid", creditedAt: Date.now() };
    }

    if (remoteStatus !== normalized.status) {
      return { ...normalized, status: remoteStatus };
    }

    return normalized;
  });

  if (shouldCredit) {
    const existingUser = await ensureUser(env, updatedInvoice.userEmail);
    const userEntity = new UserEntity(env, updatedInvoice.userEmail);
    const nextUser = await userEntity.mutate((user) => ({
      ...existingUser,
      ...user,
      id: user.id || existingUser.id,
      email: user.email || existingUser.email,
      balance: Number((Number(user.balance || 0) + Number(updatedInvoice.amount)).toFixed(2)),
      purchasedAccountIds: user.purchasedAccountIds || existingUser.purchasedAccountIds || [],
    }));

    const transactionId = `deposit:${invoiceId}`;
    const transactionEntity = new TransactionEntity(env, transactionId);
    if (!(await transactionEntity.exists())) {
      await TransactionEntity.create(env, {
        id: transactionId,
        userId: updatedInvoice.userEmail,
        amount: Number(updatedInvoice.amount),
        type: "deposit",
        timestamp: Date.now(),
      });
    }

    return { invoiceId, status: "paid", amount: updatedInvoice.amount, balance: nextUser.balance };
  }

  return { invoiceId, status: updatedInvoice.status, amount: updatedInvoice.amount };
}
async function readJson(request: Request): Promise<Record<string, unknown>> {
  return request.json().catch(() => ({}));
}

async function ensureUser(env: Env, email: string): Promise<User> {
  const existing = new UserEntity(env, email);
  if (await existing.exists()) return existing.getState();

  return UserEntity.create(env, {
    id: email,
    email,
    balance: 0,
    purchasedAccountIds: [],
  });
}

async function listAllAccounts(env: Env): Promise<TelegramAccount[]> {
  await AccountEntity.ensureSeed(env);
  const page = await AccountEntity.list(env, null, DEFAULT_PAGE_LIMIT);
  return page.items;
}

async function listAllUsers(env: Env): Promise<User[]> {
  const page = await UserEntity.list(env, null, DEFAULT_PAGE_LIMIT);
  return page.items;
}

async function listAllTransactions(env: Env): Promise<Transaction[]> {
  const page = await TransactionEntity.list(env, null, DEFAULT_PAGE_LIMIT);
  return page.items.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
}

async function handleApi(request: Request, env: RuntimeEnv): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;

  if (request.method === "OPTIONS") return json({});
  if (request.method === "GET" && pathname === "/api/health") {
    return ok({ status: "healthy", timestamp: new Date().toISOString() });
  }
  if (request.method === "POST" && pathname === "/api/client-errors") {
    const body = await readJson(request);
    console.error("[CLIENT ERROR]", JSON.stringify(body).slice(0, 2000));
    return ok({ received: true });
  }
  if (request.method === "GET" && pathname === "/api/test") return ok({ name: "TeleVault API" });

  if (request.method === "POST" && pathname === "/api/auth/login") {
    const email = normalizeEmail((await readJson(request)).email);
    if (!email) return bad("Введите корректный email");
    return ok(await ensureUser(env, email));
  }

  const profilePurchases = pathname.match(/^\/api\/profile\/([^/]+)\/purchases$/);
  if (request.method === "GET" && profilePurchases) {
    const email = normalizeEmail(decodeURIComponent(profilePurchases[1]));
    if (!email) return bad("Некорректный email");
    const user = await ensureUser(env, email);
    const purchased: TelegramAccount[] = [];
    const validIds: string[] = [];
    for (const id of user.purchasedAccountIds || []) {
      const accountEntity = new AccountEntity(env, id);
      if (!(await accountEntity.exists())) continue;
      const account = await accountEntity.getState();
      if (account.id) {
        purchased.push(account);
        validIds.push(account.id);
      }
    }
    if (validIds.length !== (user.purchasedAccountIds || []).length) {
      await new UserEntity(env, email).save({ ...user, purchasedAccountIds: validIds });
    }
    return ok(purchased);
  }

  const profile = pathname.match(/^\/api\/profile\/([^/]+)$/);
  if (request.method === "GET" && profile) {
    const email = normalizeEmail(decodeURIComponent(profile[1]));
    if (!email) return bad("Некорректный email");
    return ok(await ensureUser(env, email));
  }

  if (request.method === "GET" && pathname === "/api/accounts") {
    await AccountEntity.ensureSeed(env);
    const page = await AccountEntity.list(env, url.searchParams.get("cursor"), pageLimit(url.searchParams.get("limit")));
    return ok(page);
  }

  if (request.method === "POST" && pathname === "/api/accounts/buy") {
    const body = await readJson(request);
    const email = normalizeEmail(body.email);
    const accountId = body.accountId;
    if (!email || !isStr(accountId)) return bad("email and accountId required");

    const user = await ensureUser(env, email);
    const accountEntity = new AccountEntity(env, accountId);
    if (!(await accountEntity.exists())) return notFound("Аккаунт не найден");
    const account = await accountEntity.getState();
    if (account.status !== "available") return bad("Аккаунт уже продан");
    if (Number(user.balance) < Number(account.price)) return bad("ERR_LOW_BALANCE");

    const nextUser: User = {
      ...user,
      balance: Number((Number(user.balance) - Number(account.price)).toFixed(2)),
      purchasedAccountIds: Array.from(new Set([...(user.purchasedAccountIds || []), account.id])),
    };
    await new UserEntity(env, email).save(nextUser);

    const nextAccount: TelegramAccount = { ...account, status: "sold" };
    await accountEntity.save(nextAccount);

    const transaction = await TransactionEntity.create(env, {
      id: crypto.randomUUID(),
      userId: email,
      amount: Number(account.price),
      type: "purchase",
      timestamp: Date.now(),
      accountId: account.id,
    });

    return ok({ user: nextUser, account: nextAccount, transaction });
  }

  if (request.method === "POST" && pathname === "/api/payments/create-invoice") {
    const body = await readJson(request);
    const email = normalizeEmail(body.email);
    const amount = Number(body.amount);
    if (!email || !Number.isFinite(amount) || amount < 1) return bad("Invalid payment request");

    await ensureUser(env, email);
    let invoice: CryptoPayInvoice;
    try {
      invoice = await createCryptoInvoice(env, email, amount);
    } catch (error) {
      console.error("[CRYPTO PAY]", error);
      return json({ success: false, error: "Payment gateway unavailable" }, 502);
    }

    const invoiceId = String(invoice.invoice_id);
    await InvoiceEntity.create(env, {
      id: invoiceId,
      userEmail: email,
      amount: Number(amount.toFixed(2)),
      status: invoice.status || "active",
      timestamp: Date.now(),
    });

    return ok({
      invoiceId: Number(invoiceId),
      invoice_id: Number(invoiceId),
      payUrl: invoiceUrl(invoice),
      pay_url: invoiceUrl(invoice),
      miniAppInvoiceUrl: invoice.mini_app_invoice_url,
      webAppInvoiceUrl: invoice.web_app_invoice_url,
      mini_app_invoice_url: invoice.mini_app_invoice_url,
      web_app_invoice_url: invoice.web_app_invoice_url,
    });
  }

  const invoiceVerify = pathname.match(/^\/api\/payments\/verify\/([^/]+)$/);
  if (request.method === "GET" && invoiceVerify) {
    const invoiceId = decodeURIComponent(invoiceVerify[1]);
    const invoiceEntity = new InvoiceEntity(env, invoiceId);
    let remoteInvoice: CryptoPayInvoice | null = null;
    try {
      remoteInvoice = await getCryptoInvoice(env, invoiceId);
    } catch (error) {
      console.error("[CRYPTO PAY VERIFY]", error);
    }

    try {
      return ok(await settleInvoice(env, invoiceId, remoteInvoice));
    } catch (error) {
      return notFound(error instanceof Error ? error.message : "Invoice not found");
    }
  }

  if (request.method === "GET" && pathname === "/api/payments/verify-latest") {
    const email = normalizeEmail(url.searchParams.get("email"));
    if (!email) return bad("email required");
    try {
      const [paidInvoices, activeInvoices] = await Promise.all([
        listCryptoInvoices(env, "paid").catch(() => []),
        listCryptoInvoices(env, "active").catch(() => []),
      ]);
      const matching = [...paidInvoices, ...activeInvoices]
        .filter((invoice) => invoicePayload(invoice)?.email === email)
        .sort((a, b) => Number(b.invoice_id || 0) - Number(a.invoice_id || 0));
      const paid = matching.find((invoice) => invoice.status === "paid");
      const invoice = paid || matching[0];
      if (!invoice?.invoice_id) return notFound("No matching invoice found");
      return ok(await settleInvoice(env, String(invoice.invoice_id), invoice));
    } catch (error) {
      console.error("[CRYPTO PAY VERIFY LATEST]", error);
      return json({ success: false, error: "Payment verification unavailable" }, 502);
    }
  }

  if (request.method === "GET" && pathname === "/api/admin/users") return ok({ items: await listAllUsers(env), next: null });
  if (request.method === "GET" && pathname === "/api/admin/accounts") return ok({ items: await listAllAccounts(env), next: null });
  if (request.method === "GET" && pathname === "/api/admin/transactions") return ok({ items: await listAllTransactions(env), next: null });
  if (request.method === "GET" && pathname === "/api/users") return ok({ items: await listAllUsers(env), next: null });

  if (request.method === "POST" && pathname === "/api/admin/accounts") {
    const body = (await readJson(request)) as Partial<TelegramAccount>;
    try {
      return ok(await createAccountFromInput(env, body));
    } catch (error) {
      return bad(error instanceof Error ? error.message : "Invalid account payload");
    }
  }

  if (request.method === "POST" && pathname === "/api/admin/accounts/bulk") {
    const body = await readJson(request);
    const rows = Array.isArray(body.accounts) ? body.accounts : [];
    if (rows.length === 0) return bad("accounts array required");
    if (rows.length > 100) return bad("Bulk import is limited to 100 accounts at a time");

    const created: TelegramAccount[] = [];
    for (const row of rows) {
      try {
        created.push(await createAccountFromInput(env, row as Partial<TelegramAccount>));
      } catch (error) {
        return bad(`Row ${created.length + 1}: ${error instanceof Error ? error.message : "Invalid account payload"}`);
      }
    }
    return ok({ created, count: created.length });
  }

  const getCode = pathname.match(/^\/api\/accounts\/get-code\/([^/]+)$/);
  if (request.method === "GET" && getCode) {
    const accountId = decodeURIComponent(getCode[1]);
    const email = normalizeEmail(url.searchParams.get("email"));
    const forceRefresh = url.searchParams.get("refresh") === "1" || url.searchParams.get("resend") === "1";
    if (!email) return bad("email required");
    const user = await ensureUser(env, email);
    if (!user.purchasedAccountIds?.includes(accountId)) return notFound("Account not purchased");

    const accountEntity = new AccountEntity(env, accountId);
    if (!(await accountEntity.exists())) return notFound("Account not found");
    const account = await accountEntity.getState();
    const lookup = await lookupLoginCode(env, account, email, forceRefresh);
    if (lookup.code && (account.lastCode !== lookup.code || account.codeStatus !== "ready")) {
      await accountEntity.save({
        ...account,
        lastCode: lookup.code,
        codeStatus: "ready",
        codeUpdatedAt: Date.now(),
      });
    } else if (!lookup.code && account.codeStatus !== lookup.status) {
      await accountEntity.save({
        ...account,
        codeStatus: lookup.status,
      });
    }
    return ok({
      code: lookup.code || "Код не найден",
      phoneNumber: account.phoneNumber,
      message: lookup.message,
      timestamp: Date.now(),
      status: lookup.status,
      metadata: {
        dc_id: 2,
        endpoint: account.phoneNumber || account.countryCode || "telegram",
        protocol: lookup.source === "telegram_bridge" ? "Telethon Bridge" : "Saved Session Payload",
        source: lookup.source,
      },
    });
  }

  const deleteAccount = pathname.match(/^\/api\/admin\/accounts\/([^/]+)$/);
  if (request.method === "DELETE" && deleteAccount) {
    const id = decodeURIComponent(deleteAccount[1]);
    return ok({ id, deleted: await AccountEntity.delete(env, id) });
  }

  if (request.method === "POST" && pathname === "/api/admin/users/update-balance") {
    const body = await readJson(request);
    const email = normalizeEmail(body.email);
    const amount = Number(body.amount);
    if (!email || !Number.isFinite(amount)) return bad("email and amount required");

    const user = await ensureUser(env, email);
    const updated: User = { ...user, balance: Number(amount.toFixed(2)) };
    await new UserEntity(env, email).save(updated);
    await TransactionEntity.create(env, {
      id: crypto.randomUUID(),
      userId: email,
      amount: Math.abs(Number((amount - Number(user.balance)).toFixed(2))),
      type: "deposit",
      timestamp: Date.now(),
    });
    return ok(updated);
  }

  return notFound("Not Found");
}

const __aureliaGeneratedWorker = {
  async fetch(request: Request, env: RuntimeEnv): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) return handleApi(request, env);
      const assetResponse = await env.ASSETS.fetch(request);
      if (url.pathname.startsWith("/assets/") && assetResponse.headers.get("content-type")?.includes("text/html")) {
        return new Response("Asset not found", {
          status: 404,
          headers: {
            "content-type": "text/plain",
            "cache-control": "no-store",
          },
        });
      }
      return assetResponse;
    } catch (error) {
      console.error("[ERROR]", error);
      return json({ success: false, error: "Internal Server Error" }, 500);
    }
  },
} satisfies ExportedHandler<RuntimeEnv>;


export default __aureliaGeneratedWorker;

export function userRoutes(app: Hono<{ Bindings: any }>) {
  const previousFetch = app.fetch.bind(app);
  (app as any).fetch = (request: Request, env: any, executionCtx: any) => {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return __aureliaGeneratedWorker.fetch(request, env);
    }
    return previousFetch(request, env, executionCtx);
  };
}
