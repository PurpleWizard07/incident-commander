import { getOrCreateSessionId } from "./sessionId.js";

export interface ApiError {
  error: string;
}

export async function apiGet<T>(path: string, query?: Record<string, string | undefined>): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
  }
  const res = await fetch(url.toString(), { headers: { "X-Session-Id": getOrCreateSessionId() } });
  return handle<T>(res);
}

export async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Session-Id": getOrCreateSessionId() },
    body: JSON.stringify(body),
  });
  return handle<T>(res);
}

async function handle<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) {
    const message = (json as ApiError)?.error ?? `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return json as T;
}
