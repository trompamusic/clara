/**
 * Client-side rate limiting and retry for fetch.
 *
 * Why this exists: solidcommunity.net (via Cloudflare) allows about 50
 * requests per host in any 10 second window and blocks for 10 seconds when
 * that is exceeded. The block responses carry no CORS headers, so from a web
 * page every rate-limited request, whether it is the preflight or the real
 * request, surfaces as a TypeError with no status and no Retry-After.
 *
 * The limiter keeps one "bucket" per group of hosts that share a server-side
 * quota, chosen by rules (exact host or dot-anchored host suffix), plus a
 * default bucket for everything else. Within a bucket it enforces a sliding
 * window: at most `maxRequests` *wire* requests in any `windowMs`. A call is
 * charged 2 if the browser will send a CORS preflight for it (any
 * non-safelisted header such as Authorization or DPoP, a JSON content type,
 * or a method other than GET/HEAD/POST) and 1 otherwise. Starts are spaced;
 * completions are never awaited.
 *
 * A TypeError pauses the bucket for a backoff and, for idempotent requests
 * with replayable bodies, is retried. A 429 response (if one is ever visible)
 * pauses its bucket for Retry-After (honoured in full) or a backoff. The
 * window state can be persisted in sessionStorage so a page refresh does not
 * forget recent requests.
 *
 * Two layers, one account. DPoP-authenticated requests carry a proof signed
 * by the Solid auth library just before it calls the global fetch. Queueing
 * or retrying *below* that layer would reuse an aged proof. So:
 *
 *  - `wrap(authFetch, options, { authenticated: true })` is the OUTER layer,
 *    applied to the auth library's fetch. It queues and retries before the
 *    proof is signed (a retry calls authFetch again, producing a fresh proof),
 *    charges 2, and marks the init it passes down.
 *  - the INNER layer wraps the global fetch. Marked requests pass straight
 *    through: already counted, must not be delayed. Unmarked requests that
 *    carry Authorization or DPoP headers (the auth library's own token calls)
 *    are counted against the window but never delayed or retried. Everything
 *    else is queued and retried here.
 */

export interface BucketRule {
  /** Exact hostname match. */
  host?: string;
  /** Dot-anchored suffix: "solidcommunity.net" matches "usera.solidcommunity.net". */
  hostSuffix?: string;
  /** Wire requests allowed per window in this bucket. */
  maxRequests?: number;
  windowMs?: number;
  /** Optional plain spacing between starts, on top of the window. */
  minRequestInterval?: number;
  /** Base backoff for this bucket when no Retry-After is available. */
  retryDelay?: number;
}

export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
  minRequestInterval: number;
  maxRetries: number;
  retryDelay: number;
  maxBackoffDelay: number;
  maxRetryAfter: number;
  retryNetworkErrors: boolean;
  buckets: BucketRule[];
  /** Persist window state per bucket in sessionStorage. */
  persist: boolean;
}

export const DEFAULT_RATE_LIMIT_OPTIONS: RateLimitOptions = {
  // Default bucket: effectively unlimited.
  maxRequests: Infinity,
  windowMs: 10000,
  minRequestInterval: 0,
  maxRetries: 3,
  retryDelay: 1000,
  maxBackoffDelay: 30000,
  maxRetryAfter: 120000,
  retryNetworkErrors: true,
  buckets: [],
  persist: true,
};

export interface WrapOptions {
  /**
   * The wrapped function adds authentication headers itself (so every call
   * will preflight and costs 2) and must be re-entered on retry. Calls made
   * through it are marked so an inner limiter on the global fetch lets them
   * pass.
   */
  authenticated?: boolean;
}

export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

/** Marker on a RequestInit meaning "already accounted for by an outer layer". */
export const RATE_LIMITED_MARK: unique symbol = Symbol("rateLimited");

type MarkedInit = RequestInit & { [RATE_LIMITED_MARK]?: true };

interface Start {
  t: number;
  cost: number;
}

interface Bucket {
  key: string;
  starts: Start[];
  lastStart: number | null;
  pausedUntil: number;
  chain: Promise<void>;
  queued: number;
  warnedQueue: boolean;
}

const QUEUE_WARN_THRESHOLD = 20;
const IDEMPOTENT_METHODS = ["GET", "HEAD", "OPTIONS"];
const SIMPLE_METHODS = ["GET", "HEAD", "POST"];
const SAFELISTED_HEADERS = [
  "accept",
  "accept-language",
  "content-language",
  "content-type",
  "range",
];
const AUTH_HEADERS = ["authorization", "dpop"];
const SIMPLE_CONTENT_TYPES = [
  "application/x-www-form-urlencoded",
  "multipart/form-data",
  "text/plain",
];
const STORAGE_PREFIX = "clara:rateLimiter:";
const PAUSE_SUFFIX = ":pausedUntil";

function defaultWait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function defaultNow(): number {
  return Date.now();
}

/** Parse a Retry-After value (delay-seconds or HTTP-date) into ms from now. */
export function parseRetryAfter(
  value: string | null | undefined,
  nowMs: number,
): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const trimmed = String(value).trim();
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10) * 1000;
  }
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) {
    return null;
  }
  return Math.max(0, date - nowMs);
}

function isRequest(input: RequestInfo | URL): input is Request {
  return (
    typeof Request !== "undefined" &&
    typeof input === "object" &&
    input instanceof Request
  );
}

export function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

function parseUrl(url: string): URL | null {
  try {
    const base =
      typeof document !== "undefined" && document.URL
        ? document.URL
        : undefined;
    return new URL(url, base);
  } catch (e) {
    return null;
  }
}

function headerEntries(
  input: RequestInfo | URL,
  init?: RequestInit,
): [string, string][] {
  const source: HeadersInit | undefined =
    init && init.headers !== undefined
      ? init.headers
      : isRequest(input)
        ? input.headers
        : undefined;
  if (!source) {
    return [];
  }
  const out: [string, string][] = [];
  if (
    typeof (source as Headers).forEach === "function" &&
    !Array.isArray(source)
  ) {
    (source as Headers).forEach((value, name) => {
      out.push([name.toLowerCase(), value]);
    });
    return out;
  }
  if (Array.isArray(source)) {
    for (const [name, value] of source) {
      out.push([String(name).toLowerCase(), String(value)]);
    }
    return out;
  }
  for (const name of Object.keys(source as Record<string, string>)) {
    out.push([
      name.toLowerCase(),
      String((source as Record<string, string>)[name]),
    ]);
  }
  return out;
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init && init.method) {
    return init.method.toUpperCase();
  }
  if (isRequest(input) && input.method) {
    return input.method.toUpperCase();
  }
  return "GET";
}

/** True if the request carries credentials the auth library signed. */
export function hasAuthHeaders(
  input: RequestInfo | URL,
  init?: RequestInit,
): boolean {
  return headerEntries(input, init).some(([name]) =>
    AUTH_HEADERS.includes(name),
  );
}

/**
 * How many wire requests a fetch call will cost: 2 if the browser will send a
 * CORS preflight, else 1. Follows the Fetch standard's "CORS-safelisted"
 * rules; same-origin requests never preflight.
 */
export function requestCost(
  input: RequestInfo | URL,
  init?: RequestInit,
  pageOrigin?: string,
): number {
  const parsed = parseUrl(requestUrl(input));
  const origin =
    pageOrigin !== undefined
      ? pageOrigin
      : typeof window !== "undefined" && window.location
        ? window.location.origin
        : undefined;
  if (parsed && origin && parsed.origin === origin) {
    return 1;
  }
  if (!SIMPLE_METHODS.includes(requestMethod(input, init))) {
    return 2;
  }
  for (const [name, value] of headerEntries(input, init)) {
    if (!SAFELISTED_HEADERS.includes(name)) {
      return 2;
    }
    if (name === "content-type") {
      const mime = value.split(";")[0].trim().toLowerCase();
      if (!SIMPLE_CONTENT_TYPES.includes(mime)) {
        return 2;
      }
    }
  }
  return 1;
}

/**
 * Whether a request can be sent again. A body given as a stream is consumed
 * by the first attempt; a Request object is cloned per attempt instead.
 */
export function isReplayable(
  input: RequestInfo | URL,
  init?: RequestInit,
): boolean {
  const body = init && init.body;
  if (
    body &&
    typeof ReadableStream !== "undefined" &&
    body instanceof ReadableStream
  ) {
    return false;
  }
  if (isRequest(input) && input.bodyUsed) {
    return false;
  }
  return true;
}

function ruleMatches(rule: BucketRule, hostname: string): boolean {
  if (rule.host && hostname === rule.host.toLowerCase()) {
    return true;
  }
  if (rule.hostSuffix) {
    const suffix = rule.hostSuffix.toLowerCase();
    return hostname === suffix || hostname.endsWith("." + suffix);
  }
  return false;
}

function ruleKey(rule: BucketRule): string {
  return rule.host
    ? "host:" + rule.host.toLowerCase()
    : "suffix:" + String(rule.hostSuffix).toLowerCase();
}

/** The bucket key for a URL: the first matching rule's key, or "" (default). */
export function bucketKeyFor(url: string, rules: BucketRule[]): string {
  if (!rules || !rules.length) {
    return "";
  }
  const parsed = parseUrl(url);
  if (!parsed) {
    return "";
  }
  const hostname = parsed.hostname.toLowerCase();
  for (const rule of rules) {
    if (ruleMatches(rule, hostname)) {
      return ruleKey(rule);
    }
  }
  return "";
}

function abortError(signal: AbortSignal): unknown {
  if (signal.reason !== undefined) {
    return signal.reason;
  }
  const err = new Error("The operation was aborted");
  err.name = "AbortError";
  return err;
}

function storage(): Storage | null {
  try {
    return typeof sessionStorage !== "undefined" ? sessionStorage : null;
  } catch (e) {
    return null;
  }
}

export interface RateLimiter {
  rateLimitedFetch(
    fetchFn: FetchLike,
    input: RequestInfo | URL,
    init: RequestInit | undefined,
    options?: Partial<RateLimitOptions>,
    wrapOptions?: WrapOptions,
  ): Promise<Response>;
  pauseUntil(key: string, t: number): void;
  /** Wrap a fetch so every call goes through the limiter with fixed options. */
  wrap(
    fetchFn: FetchLike,
    options?: Partial<RateLimitOptions>,
    wrapOptions?: WrapOptions,
  ): FetchLike;
}

interface Resolved {
  key: string;
  maxRequests: number;
  windowMs: number;
  minInterval: number;
  retryDelay: number;
}

export function createRateLimiter({
  now = defaultNow,
  wait = defaultWait,
}: {
  now?: () => number;
  wait?: (ms: number) => Promise<void>;
} = {}): RateLimiter {
  const buckets = new Map<string, Bucket>();

  function loadStarts(key: string, windowMs: number): Start[] {
    const s = storage();
    if (!s) {
      return [];
    }
    try {
      const raw = s.getItem(STORAGE_PREFIX + key);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as [number, number][];
      const cutoff = now() - windowMs;
      return parsed
        .filter((p) => Array.isArray(p) && p[0] > cutoff)
        .map(([t, cost]) => ({ t, cost }));
    } catch (e) {
      return [];
    }
  }

  function saveStarts(bucket: Bucket): void {
    const s = storage();
    if (!s) {
      return;
    }
    try {
      s.setItem(
        STORAGE_PREFIX + bucket.key,
        JSON.stringify(bucket.starts.map((st) => [st.t, st.cost])),
      );
    } catch (e) {
      // storage full or unavailable; the in-memory window still applies
    }
  }

  function loadPause(key: string): number {
    const s = storage();
    if (!s) {
      return 0;
    }
    try {
      const raw = s.getItem(STORAGE_PREFIX + key + PAUSE_SUFFIX);
      const t = raw ? Number(raw) : 0;
      return Number.isFinite(t) && t > now() ? t : 0;
    } catch (e) {
      return 0;
    }
  }

  function savePause(bucket: Bucket): void {
    const s = storage();
    if (!s) {
      return;
    }
    try {
      s.setItem(
        STORAGE_PREFIX + bucket.key + PAUSE_SUFFIX,
        String(bucket.pausedUntil),
      );
    } catch (e) {
      // storage unavailable; the in-memory pause still applies
    }
  }

  function getBucket(key: string, windowMs: number, persist: boolean): Bucket {
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        key,
        starts: persist ? loadStarts(key, windowMs) : [],
        lastStart: null,
        // A block survives a page refresh; remember it so the fresh page
        // waits it out instead of failing its first request.
        pausedUntil: persist ? loadPause(key) : 0,
        chain: Promise.resolve(),
        queued: 0,
        warnedQueue: false,
      };
      buckets.set(key, bucket);
    }
    return bucket;
  }

  function pauseUntil(key: string, t: number, persist = true): void {
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.pausedUntil = Math.max(bucket.pausedUntil, t);
      if (persist) {
        savePause(bucket);
      }
    }
  }

  function pruneStarts(bucket: Bucket, t: number, windowMs: number): void {
    const cutoff = t - windowMs;
    while (bucket.starts.length && bucket.starts[0].t <= cutoff) {
      bucket.starts.shift();
    }
  }

  function recordStart(
    bucket: Bucket,
    t: number,
    cost: number,
    persist: boolean,
  ): void {
    bucket.lastStart = t;
    bucket.starts.push({ t, cost });
    if (persist) {
      saveStarts(bucket);
    }
  }

  // The earliest time this request may start, given the pause, the plain
  // spacing, and the sliding window.
  function earliestStart(
    bucket: Bucket,
    t: number,
    cost: number,
    r: Resolved,
  ): number {
    let earliest = bucket.pausedUntil;
    if (bucket.lastStart !== null) {
      earliest = Math.max(earliest, bucket.lastStart + r.minInterval);
    }
    pruneStarts(bucket, t, r.windowMs);
    let used = bucket.starts.reduce((sum, st) => sum + st.cost, 0);
    if (used + cost > r.maxRequests) {
      // Expire the oldest starts until this request fits.
      for (const st of bucket.starts) {
        used -= st.cost;
        if (used + cost <= r.maxRequests) {
          earliest = Math.max(earliest, st.t + r.windowMs);
          break;
        }
      }
    }
    return earliest;
  }

  // Wait for this request's turn to start. Re-checks after every wake-up, so
  // a pause set while we were sleeping is respected. Aborting the signal ends
  // the wait at once.
  async function acquireStart(
    bucket: Bucket,
    cost: number,
    r: Resolved,
    persist: boolean,
    signal: AbortSignal | undefined,
  ): Promise<void> {
    for (;;) {
      if (signal && signal.aborted) {
        throw abortError(signal);
      }
      const t = now();
      const earliest = earliestStart(bucket, t, cost, r);
      if (t >= earliest) {
        recordStart(bucket, t, cost, persist);
        return;
      }
      await waitOrAbort(earliest - t, signal);
    }
  }

  function waitOrAbort(
    ms: number,
    signal: AbortSignal | undefined,
  ): Promise<void> {
    if (!signal) {
      return wait(ms);
    }
    return new Promise<void>((resolve, reject) => {
      const onAbort = () => reject(abortError(signal));
      signal.addEventListener("abort", onAbort, { once: true });
      wait(ms).then(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      });
    });
  }

  function takeTurn(
    bucket: Bucket,
    cost: number,
    r: Resolved,
    persist: boolean,
    signal: AbortSignal | undefined,
  ): Promise<void> {
    bucket.queued += 1;
    if (bucket.queued > QUEUE_WARN_THRESHOLD && !bucket.warnedQueue) {
      bucket.warnedQueue = true;
      console.warn(
        `rateLimiter: ${bucket.queued} requests queued for bucket "${bucket.key || "default"}"`,
      );
    }
    const turn = bucket.chain.then(() =>
      acquireStart(bucket, cost, r, persist, signal),
    );
    // The chain must never reject, or every later request would fail.
    bucket.chain = turn.catch(() => undefined);
    // An abort must reject the caller at once, even while requests ahead in
    // the queue are still waiting. The turn itself stays in the chain and
    // ends without starting anything, since acquireStart checks the signal.
    const settled = signal ? Promise.race([turn, abortPromise(signal)]) : turn;
    return settled.finally(() => {
      bucket.queued -= 1;
    });
  }

  function abortPromise(signal: AbortSignal): Promise<never> {
    return new Promise<never>((_, reject) => {
      if (signal.aborted) {
        reject(abortError(signal));
        return;
      }
      signal.addEventListener("abort", () => reject(abortError(signal)), {
        once: true,
      });
    });
  }

  function resolve(url: string, options: RateLimitOptions): Resolved {
    const key = bucketKeyFor(url, options.buckets);
    const rule = key
      ? options.buckets.find((b) => ruleKey(b) === key)
      : undefined;
    const pick = <K extends keyof BucketRule & keyof RateLimitOptions>(k: K) =>
      rule && rule[k] !== undefined
        ? (rule[k] as RateLimitOptions[K])
        : options[k];
    return {
      key,
      maxRequests: pick("maxRequests"),
      windowMs: pick("windowMs"),
      minInterval: pick("minRequestInterval"),
      retryDelay: pick("retryDelay"),
    };
  }

  async function rateLimitedFetch(
    fetchFn: FetchLike,
    input: RequestInfo | URL,
    init: RequestInit | undefined,
    userOptions?: Partial<RateLimitOptions>,
    wrapOptions: WrapOptions = {},
  ): Promise<Response> {
    // Already accounted for and queued by an outer (authenticated) layer.
    if (init && (init as MarkedInit)[RATE_LIMITED_MARK]) {
      return fetchFn(input, init);
    }

    const options: RateLimitOptions = {
      ...DEFAULT_RATE_LIMIT_OPTIONS,
      ...(userOptions || {}),
    };
    const url = requestUrl(input);
    const r = resolve(url, options);
    const bucket = getBucket(r.key, r.windowMs, options.persist);
    const authenticated = wrapOptions.authenticated === true;
    const cost = authenticated ? 2 : requestCost(input, init);

    const backoff = (attempt: number) =>
      Math.min(r.retryDelay * Math.pow(2, attempt), options.maxBackoffDelay);

    // A signed request we did not queue (the auth library's own calls):
    // count it, but never delay or retry it, or its DPoP proof would age.
    // Its outcome still tells us about the bucket, so a failure or a 429
    // pauses everyone else.
    if (!authenticated && hasAuthHeaders(input, init)) {
      recordStart(bucket, now(), cost, options.persist);
      let response: Response;
      try {
        response = await fetchFn(input, init);
      } catch (err) {
        if (err instanceof TypeError) {
          pauseUntil(r.key, now() + backoff(0), options.persist);
        }
        throw err;
      }
      if (response.status === 429) {
        const retryAfter = parseRetryAfter(
          response.headers && typeof response.headers.get === "function"
            ? response.headers.get("Retry-After")
            : null,
          now(),
        );
        pauseUntil(
          r.key,
          now() + (retryAfter !== null ? retryAfter : backoff(0)),
          options.persist,
        );
      }
      return response;
    }

    const method = requestMethod(input, init);
    const signal =
      (init && init.signal) ||
      (isRequest(input) ? input.signal : undefined) ||
      undefined;

    for (let attempt = 0; ; attempt++) {
      await takeTurn(bucket, cost, r, options.persist, signal);
      if (signal && signal.aborted) {
        throw abortError(signal);
      }

      // Never hand the same Request object to fetch twice: its body would be
      // consumed by the first attempt.
      const attemptInput = isRequest(input) ? input.clone() : input;
      const attemptInit: MarkedInit | undefined = authenticated
        ? { ...(init || {}), [RATE_LIMITED_MARK]: true }
        : init;

      let response: Response;
      try {
        response = await fetchFn(attemptInput, attemptInit);
      } catch (err) {
        if (!(err instanceof TypeError)) {
          throw err;
        }
        // Probably a rate-limit block on the preflight or the request itself
        // (the block response has no CORS headers, so the page never sees a
        // status). Pause the whole bucket whether or not we retry this one.
        const delay = backoff(attempt);
        pauseUntil(r.key, now() + delay, options.persist);
        const retryable =
          options.retryNetworkErrors &&
          IDEMPOTENT_METHODS.includes(method) &&
          isReplayable(input, init) &&
          attempt < options.maxRetries;
        if (!retryable) {
          throw err;
        }
        console.warn(
          `rateLimiter: network error for ${url}, retry ${attempt + 1}/${options.maxRetries} in ${delay}ms`,
          err,
        );
        continue;
      }

      if (response.status !== 429) {
        return response;
      }

      const retryAfter = parseRetryAfter(
        response.headers && typeof response.headers.get === "function"
          ? response.headers.get("Retry-After")
          : null,
        now(),
      );
      const delay = retryAfter !== null ? retryAfter : backoff(attempt);
      // Every 429 pauses the bucket, including one we give up on.
      pauseUntil(r.key, now() + delay, options.persist);

      if (retryAfter !== null && retryAfter > options.maxRetryAfter) {
        console.warn(
          `rateLimiter: 429 for ${url} with Retry-After ${retryAfter}ms exceeds maxRetryAfter; not retrying`,
        );
        return response;
      }
      if (attempt >= options.maxRetries || !isReplayable(input, init)) {
        console.warn(`rateLimiter: 429 for ${url}, not retrying`);
        return response;
      }
      console.warn(
        `rateLimiter: 429 for ${url}, retry ${attempt + 1}/${options.maxRetries} in ${delay}ms`,
      );
    }
  }

  function wrap(
    fetchFn: FetchLike,
    options?: Partial<RateLimitOptions>,
    wrapOptions?: WrapOptions,
  ): FetchLike {
    return (input, init) =>
      rateLimitedFetch(fetchFn, input, init, options, wrapOptions);
  }

  return { rateLimitedFetch, pauseUntil, wrap };
}
