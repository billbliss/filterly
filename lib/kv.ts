// lib/kv.ts
// Local-first KV wrapper. Uses in-memory storage unless Vercel KV is properly configured.

type KVClient = {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, val: T): Promise<unknown>;
  ping?: () => Promise<unknown>;
};

let client: KVClient | null = null;
const mem = new Map<string, unknown>();

const url = process.env.KV_REST_API_URL || process.env.KV_URL;
const token = process.env.KV_REST_API_TOKEN;
const remoteConfigured = Boolean(url && url.startsWith("https") && token);

(async () => {
  if (!remoteConfigured) return; // stay in local mode
  try {
    const { createClient } = await import("@vercel/kv");
    client = createClient({ url: url as string, token: token as string }) as unknown as KVClient;
    await client.ping?.().catch(() => {});
  } catch {
    client = null; // fall back silently if SDK missing or config invalid
  }
})();

export async function kvGet<T = unknown>(key: string): Promise<T | null> {
  if (client) {
    return (await client.get<T>(key)) ?? null;
  }
  return (mem.has(key) ? (mem.get(key) as T) : null);
}

export async function kvSet<T = unknown>(key: string, val: T): Promise<void> {
  if (client) {
    await client.set<T>(key, val);
    return;
  }
  mem.set(key, val as unknown);
}