import { createRateLimiter, FetchLike, RateLimitOptions } from "./rateLimiter";

/**
 * Rate limits measured against solidcommunity.net on 2026-09-29: Cloudflare
 * allows about 50 requests per host in any 10 second window, counting CORS
 * preflights, and blocks for 10 seconds when exceeded. The block responses
 * have no CORS headers, so the page only ever sees a TypeError. 30 wire
 * requests per window leaves headroom for a second tab or a refresh; an
 * authenticated request costs 2 (OPTIONS + GET). The suffix rule also covers
 * the bare identity-provider host.
 *
 * Retries are for idempotent requests only. In particular the token POST
 * during login is not retried: if it was blocked, the issuer-config GET
 * before it will already have waited out the block; if it was lost after
 * succeeding, resubmitting the single-use code cannot recover it anyway.
 */
export const CLARA_RATE_LIMIT_OPTIONS: Partial<RateLimitOptions> = {
  buckets: [
    {
      hostSuffix: "solidcommunity.net",
      maxRequests: 30,
      windowMs: 10000,
      retryDelay: 10000,
    },
  ],
};

/** One limiter for the page: both layers share its buckets. */
export const rateLimiter = createRateLimiter();

/**
 * Inner layer: wrap window.fetch so every request the page makes is seen by
 * the limiter. The Solid auth library, LDO and meld all look the global up by
 * name at call time, so wrapping it once, before anything renders, covers
 * them. Requests already queued by the outer layer pass straight through.
 *
 * Returns a function that restores the original fetch.
 */
export function installRateLimiter(
  options: Partial<RateLimitOptions> = CLARA_RATE_LIMIT_OPTIONS,
): () => void {
  const original = window.fetch.bind(window);
  window.fetch = rateLimiter.wrap(original, options);
  return () => {
    window.fetch = original;
  };
}

const wrappedAuthFetches = new WeakMap<FetchLike, FetchLike>();

/**
 * Outer layer: wrap the auth library's fetch so queueing and retries happen
 * *before* it signs the DPoP proof. Use this for every consumer of the
 * authenticated fetch (meld, LDO's dataset context, media loading). Wrapping
 * the same function twice returns the same wrapper, so it is stable across
 * renders.
 */
export function rateLimitAuthFetch(
  authFetch: FetchLike,
  options: Partial<RateLimitOptions> = CLARA_RATE_LIMIT_OPTIONS,
): FetchLike {
  let wrapped = wrappedAuthFetches.get(authFetch);
  if (!wrapped) {
    wrapped = rateLimiter.wrap(authFetch, options, { authenticated: true });
    wrappedAuthFetches.set(authFetch, wrapped);
  }
  return wrapped;
}
