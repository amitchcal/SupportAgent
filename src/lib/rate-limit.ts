import { createHash } from "node:crypto";
import { mutateDatabase } from "./store";
import type { RateLimitEntry } from "./domain";

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

export function anonymizedRateLimitKey(scope: string, identifier: string) {
  return `${scope}:${createHash("sha256").update(identifier).digest("hex")}`;
}

export function applyRateLimit(entries: RateLimitEntry[], key: string, maximum: number, windowSeconds: number, now = new Date()) {
  const cutoff = now.getTime() - windowSeconds * 1000;
  const active = entries.filter((entry) => new Date(entry.windowStartedAt).getTime() > cutoff);
  let entry = active.find((item) => item.key === key);
  if (!entry) {
    entry = { key, count: 0, windowStartedAt: now.toISOString() };
    active.push(entry);
  }
  entry.count += 1;
  const elapsed = Math.max(0, Math.floor((now.getTime() - new Date(entry.windowStartedAt).getTime()) / 1000));
  return { entries: active, result: { allowed: entry.count <= maximum, retryAfterSeconds: Math.max(1, windowSeconds - elapsed) } };
}

export async function consumeRateLimit(key: string, maximum: number, windowSeconds: number, now = new Date()): Promise<RateLimitResult> {
  return mutateDatabase((database) => {
    database.rateLimits ??= [];
    const applied = applyRateLimit(database.rateLimits, key, maximum, windowSeconds, now);
    database.rateLimits = applied.entries;
    return applied.result;
  });
}

export async function clearRateLimit(key: string) {
  await mutateDatabase((database) => { database.rateLimits = (database.rateLimits ?? []).filter((entry) => entry.key !== key); });
}
