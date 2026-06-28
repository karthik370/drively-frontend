/**
 * apiCache — Lightweight in-memory cache for API GET responses
 * ─────────────────────────────────────────────────────────────
 * Two features:
 *
 * 1. TTL cache  — stores results for N seconds.
 *    Revisiting the same screen returns instantly from cache
 *    instead of firing a new network request.
 *
 * 2. In-flight deduplication — if the same request is already
 *    in-progress (two components call the same API simultaneously),
 *    they share one Promise instead of creating two network calls.
 *
 * Usage:
 *   const cached = apiCache.get<T>('my:key');
 *   if (cached !== null) return cached;
 *
 *   const inFlight = apiCache.getInFlight<T>('my:key');
 *   if (inFlight) return inFlight;
 *
 *   const promise = actualApiCall();
 *   apiCache.setInFlight('my:key', promise);
 *   const result = await promise;
 *   apiCache.set('my:key', result, 30); // 30s TTL
 *   return result;
 *
 * Invalidation:
 *   apiCache.invalidate('booking');   // clears all keys starting with 'booking'
 *   apiCache.invalidate('booking:history'); // exact key
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number; // Unix ms timestamp
}

const store = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

const apiCache = {
  /** Returns cached value or null if missing / expired */
  get<T>(key: string): T | null {
    const entry = store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return null;
    }
    return entry.data as T;
  },

  /** Stores a value with a TTL (seconds). Default 30s. */
  set<T>(key: string, data: T, ttlSeconds = 30): void {
    store.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
  },

  /** Returns an in-flight promise for the key if one exists */
  getInFlight<T>(key: string): Promise<T> | null {
    return (inFlight.get(key) as Promise<T>) ?? null;
  },

  /** Registers an in-flight promise. Automatically removed when it settles. */
  setInFlight<T>(key: string, promise: Promise<T>): void {
    inFlight.set(key, promise as Promise<unknown>);
    promise.finally(() => {
      inFlight.delete(key);
    });
  },

  /**
   * Invalidates all cache entries whose key starts with `prefix`.
   * Call this after mutations (e.g. after a booking completes).
   * e.g. apiCache.invalidate('booking') clears 'booking:history', 'booking:active', etc.
   */
  invalidate(prefix: string): void {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
    for (const key of inFlight.keys()) {
      if (key.startsWith(prefix)) inFlight.delete(key);
    }
  },

  /** Clears entire cache (e.g. on logout) */
  clear(): void {
    store.clear();
    inFlight.clear();
  },
};

export default apiCache;

/**
 * withCache — convenience wrapper to reduce boilerplate.
 *
 * Usage:
 *   return withCache('earnings:today', 30, () => api.get('/drivers/earnings'));
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  // 1. Return from cache if fresh
  const cached = apiCache.get<T>(key);
  if (cached !== null) return cached;

  // 2. Reuse in-flight request if already pending
  const existing = apiCache.getInFlight<T>(key);
  if (existing) return existing;

  // 3. Start new request
  const promise = fetcher().then((result) => {
    apiCache.set(key, result, ttlSeconds);
    return result;
  });

  apiCache.setInFlight(key, promise);
  return promise;
}
