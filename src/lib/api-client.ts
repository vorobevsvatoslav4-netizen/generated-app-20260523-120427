import { ApiResponse } from "../../shared/types";
/**
 * Enhanced api fetcher with robust path normalization to fix 404 Not Found errors.
 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  // Robust path normalization: remove trailing slash and ensure /api prefix
  let url = path.replace(/\/$/, "");
  if (!url.startsWith('/api/')) {
    url = `/api/${url.startsWith('/') ? url.slice(1) : url}`;
  }
  try {
    const res = await fetch(url, {
      ...init,
      headers,
    });
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await res.text();
      console.error(`[NON-JSON ERROR] ${res.status} ${url}:`, text.slice(0, 500));
      throw new Error(`Ошибка сервера (${res.status}): Ответ не является JSON`);
    }
    const json = (await res.json()) as ApiResponse<T>;
    if (!res.ok) {
      console.error(`[API ERROR] ${res.status} ${url}:`, json.error || json.detail || 'No error message');
      throw new Error(json.error || `Ошибка сервера (${res.status})`);
    }
    if (!json.success) {
      throw new Error(json.error || "Ошибка запроса");
    }
    return json.data as T;
  } catch (err: any) {
    console.error(`[FETCH FAILED] ${url}:`, err.message);
    throw err;
  }
}