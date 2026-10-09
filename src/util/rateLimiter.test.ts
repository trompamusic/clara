import {
  createRateLimiter,
  parseRetryAfter,
  bucketKeyFor,
  requestCost,
  hasAuthHeaders,
  isReplayable,
  RATE_LIMITED_MARK,
  BucketRule,
} from "./rateLimiter";

// jsdom (jest 27) has no ReadableStream; the limiter checks the global.
import { ReadableStream as NodeReadableStream } from "stream/web";
if (typeof (globalThis as any).ReadableStream === "undefined") {
  (globalThis as any).ReadableStream = NodeReadableStream;
}

const POD_A = "https://usera.solidcommunity.net/timeline/1.jsonld";
const POD_B = "https://userb.solidcommunity.net/timeline/2.jsonld";
const IDP = "https://solidcommunity.net/.oidc/token";
const GITHUB = "https://raw.githubusercontent.com/x/y/score.mei";
const AUTH = { headers: { Authorization: "DPoP x", DPoP: "y" } };

function response(
  status: number,
  headers: Record<string, string> = {},
): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  } as unknown as Response;
}

type Answer = Response | Error | (() => Promise<Response>);

// A virtual clock injected into the limiter (its `now` and `wait`), so tests
// are deterministic without jest fake timers (jest 27 here has no async
// timer advancing). tick(ms) advances time, firing due waits in order and
// letting promise chains settle between them.
function createClock(start = 0) {
  let t = start;
  const timers: { at: number; resolve: () => void }[] = [];
  const settle = () => new Promise<void>((r) => setTimeout(r, 0));
  return {
    now: () => t,
    wait: (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push({ at: t + ms, resolve });
      }),
    async tick(ms: number) {
      await settle();
      const end = t + ms;
      for (;;) {
        const due = timers
          .filter((x) => x.at <= end)
          .sort((a, b) => a.at - b.at)[0];
        if (!due) {
          break;
        }
        timers.splice(timers.indexOf(due), 1);
        t = Math.max(t, due.at);
        due.resolve();
        await settle();
      }
      t = end;
      await settle();
    },
  };
}

let clock = createClock();
const createLimiter = () =>
  createRateLimiter({ now: clock.now, wait: clock.wait });

// A fetch mock that records the (virtual) time, url and init of each call and
// answers from a queue, repeating the last answer.
function makeFetch(answers: Answer[]) {
  const calls: {
    url: string;
    t: number;
    init?: RequestInit;
    input: RequestInfo | URL;
  }[] = [];
  const fetchFn = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input instanceof Request ? input.url : input),
      t: clock.now(),
      init,
      input,
    });
    const answer = answers.length > 1 ? answers.shift()! : answers[0];
    if (answer instanceof Error) {
      return Promise.reject(answer);
    }
    if (typeof answer === "function") {
      return answer();
    }
    return Promise.resolve(answer);
  });
  return { fetchFn, calls };
}

const tick = (ms = 0) => clock.tick(ms);
const times = (calls: { t: number }[]) => calls.map((c) => c.t);

const POD_RULES = {
  buckets: [
    {
      hostSuffix: "solidcommunity.net",
      maxRequests: 4,
      windowMs: 10000,
      retryDelay: 10000,
    },
  ],
};

let warn: jest.SpyInstance;
beforeEach(() => {
  clock = createClock();
  sessionStorage.clear();
  warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  warn.mockRestore();
});

describe("parseRetryAfter", () => {
  test("delay-seconds and HTTP-date", () => {
    expect(parseRetryAfter("10", 0)).toBe(10000);
    const now = Date.parse("Wed, 21 Oct 2015 07:28:00 GMT");
    expect(parseRetryAfter("Wed, 21 Oct 2015 07:28:05 GMT", now)).toBe(5000);
    expect(parseRetryAfter("Wed, 21 Oct 2015 07:27:00 GMT", now)).toBe(0);
  });
  test("absent or garbage is null", () => {
    expect(parseRetryAfter(null, 0)).toBeNull();
    expect(parseRetryAfter("", 0)).toBeNull();
    expect(parseRetryAfter("soon", 0)).toBeNull();
  });
});

describe("bucketKeyFor", () => {
  const rules: BucketRule[] = [
    { host: "solidcommunity.net" },
    { hostSuffix: "solidcommunity.net" },
  ];
  test("first matching rule wins; suffix also matches the bare host", () => {
    expect(bucketKeyFor(IDP, rules)).toBe("host:solidcommunity.net");
    expect(bucketKeyFor(POD_A, rules)).toBe("suffix:solidcommunity.net");
    expect(bucketKeyFor(IDP, [rules[1]])).toBe("suffix:solidcommunity.net");
  });
  test("suffix is dot-anchored; unmatched hosts use the default bucket", () => {
    expect(bucketKeyFor("https://notsolidcommunity.net/x", rules)).toBe("");
    expect(bucketKeyFor(GITHUB, rules)).toBe("");
    expect(bucketKeyFor(POD_A, [])).toBe("");
  });
});

describe("requestCost / hasAuthHeaders / isReplayable", () => {
  const origin = "http://localhost:3001";
  test("a plain cross-origin GET costs 1", () => {
    expect(requestCost(POD_A, undefined, origin)).toBe(1);
    expect(
      requestCost(POD_A, { headers: { Accept: "text/turtle" } }, origin),
    ).toBe(1);
  });
  test("Authorization / DPoP headers cost 2 (preflight) in any header shape", () => {
    expect(requestCost(POD_A, AUTH, origin)).toBe(2);
    expect(
      requestCost(POD_A, { headers: new Headers({ DPoP: "x" }) }, origin),
    ).toBe(2);
    expect(
      requestCost(POD_A, { headers: [["authorization", "x"]] }, origin),
    ).toBe(2);
    expect(hasAuthHeaders(POD_A, AUTH)).toBe(true);
    expect(hasAuthHeaders(POD_A, { headers: { Accept: "x" } })).toBe(false);
  });
  test("non-simple methods and JSON bodies cost 2; form posts cost 1", () => {
    expect(requestCost(POD_A, { method: "PATCH" }, origin)).toBe(2);
    expect(
      requestCost(
        POD_A,
        { method: "POST", headers: { "Content-Type": "application/ld+json" } },
        origin,
      ),
    ).toBe(2);
    expect(
      requestCost(
        POD_A,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        },
        origin,
      ),
    ).toBe(1);
  });
  test("same-origin never preflights", () => {
    expect(requestCost(origin + "/api", AUTH, origin)).toBe(1);
  });
  test("a Request object's method and headers are used", () => {
    const req = new Request(POD_A, { method: "PUT" });
    expect(requestCost(req, undefined, origin)).toBe(2);
  });
  test("stream bodies and consumed Requests are not replayable", () => {
    expect(isReplayable(POD_A, { method: "POST", body: "{}" })).toBe(true);
    expect(
      isReplayable(POD_A, { method: "POST", body: new ReadableStream() }),
    ).toBe(false);
    const req = new Request(POD_A, { method: "POST", body: "x" });
    expect(isReplayable(req)).toBe(true);
  });
});

describe("sliding window", () => {
  test("a burst up to the limit goes out immediately, then waits for the window", async () => {
    const limiter = createLimiter();
    const { fetchFn, calls } = makeFetch([response(200)]);
    const p = Promise.all(
      [0, 1, 2, 3, 4].map(() =>
        limiter.rateLimitedFetch(fetchFn, POD_A, undefined, POD_RULES),
      ),
    );
    await tick(0);
    expect(times(calls)).toEqual([0, 0, 0, 0]);
    await tick(9999);
    expect(calls).toHaveLength(4);
    await tick(1);
    expect(times(calls)).toEqual([0, 0, 0, 0, 10000]);
    await p;
  });

  test("authenticated requests cost 2 against the window", async () => {
    const limiter = createLimiter();
    const { fetchFn, calls } = makeFetch([response(200)]);
    const auth = limiter.wrap(fetchFn, POD_RULES, { authenticated: true });
    const p = Promise.all([auth(POD_A), auth(POD_B), auth(POD_A)]);
    await tick(0);
    expect(times(calls)).toEqual([0, 0]);
    await tick(10000);
    expect(times(calls)).toEqual([0, 0, 10000]);
    await p;
  });

  test("the window slides: capacity returns as old starts expire", async () => {
    const limiter = createLimiter();
    const { fetchFn, calls } = makeFetch([response(200)]);
    const auth = limiter.wrap(fetchFn, POD_RULES, { authenticated: true });
    await auth(POD_A); // t=0, cost 2
    await tick(5000);
    await auth(POD_A); // t=5000, cost 2
    const third = auth(POD_A);
    await tick(4999);
    expect(calls).toHaveLength(2);
    await tick(1); // t=10000: the first start leaves the window
    expect(times(calls)).toEqual([0, 5000, 10000]);
    await third;
  });

  test("buckets are independent and the default bucket is unlimited", async () => {
    const limiter = createLimiter();
    const { fetchFn, calls } = makeFetch([response(200)]);
    const p = Promise.all([
      ...[0, 1, 2, 3, 4, 5].map(() =>
        limiter.rateLimitedFetch(fetchFn, GITHUB, undefined, POD_RULES),
      ),
      limiter.rateLimitedFetch(fetchFn, POD_A, undefined, POD_RULES),
    ]);
    await tick(0);
    expect(calls).toHaveLength(7);
    await p;
  });

  test("an unresolved fetch does not block later starts", async () => {
    const limiter = createLimiter();
    const never = () => new Promise<Response>(() => undefined);
    const { fetchFn, calls } = makeFetch([never, response(200)]);
    limiter.rateLimitedFetch(fetchFn, POD_A, undefined, POD_RULES);
    const second = limiter.rateLimitedFetch(
      fetchFn,
      POD_B,
      undefined,
      POD_RULES,
    );
    await tick(0);
    expect(calls).toHaveLength(2);
    await expect(second).resolves.toMatchObject({ status: 200 });
  });

  test("window state survives a new limiter via sessionStorage", async () => {
    const first = createLimiter();
    const { fetchFn, calls } = makeFetch([response(200)]);
    const auth = first.wrap(fetchFn, POD_RULES, { authenticated: true });
    await auth(POD_A); // cost 2 at t=0
    await auth(POD_A); // cost 2 at t=0
    // "Page refresh": a fresh limiter, same sessionStorage.
    const second = createLimiter();
    const p = second.rateLimitedFetch(fetchFn, POD_A, undefined, POD_RULES);
    await tick(0);
    expect(calls).toHaveLength(2);
    await tick(10000);
    expect(times(calls)).toEqual([0, 0, 10000]);
    await p;
  });

  test("persist: false ignores sessionStorage", async () => {
    const opts = { ...POD_RULES, persist: false };
    const first = createLimiter();
    const { fetchFn, calls } = makeFetch([response(200)]);
    const auth = first.wrap(fetchFn, opts, { authenticated: true });
    await auth(POD_A);
    await auth(POD_A);
    const second = createLimiter();
    await second.rateLimitedFetch(fetchFn, POD_A, undefined, opts);
    expect(times(calls)).toEqual([0, 0, 0]);
  });
});

describe("two layers, one account", () => {
  test("the authenticated wrap marks the init it passes down; a marked request passes the inner layer untouched", async () => {
    const limiter = createLimiter();
    const inner = makeFetch([response(200)]);
    const innerFetch = limiter.wrap(inner.fetchFn, POD_RULES); // "window.fetch"
    // Stand-in for the auth library: adds headers, spreads our init, calls the global.
    const authLibraryFetch = (input: RequestInfo | URL, init?: RequestInit) =>
      innerFetch(input, { ...(init || {}), headers: { ...AUTH.headers } });
    const outer = limiter.wrap(authLibraryFetch, POD_RULES, {
      authenticated: true,
    });

    // Window of 4: two authenticated calls fill it; a third waits. If the inner
    // layer also counted them, the second would already have waited.
    const p = Promise.all([outer(POD_A), outer(POD_B), outer(POD_A)]);
    await tick(0);
    expect(times(inner.calls)).toEqual([0, 0]);
    expect((inner.calls[0].init as any)[RATE_LIMITED_MARK]).toBe(true);
    expect(hasAuthHeaders(POD_A, inner.calls[0].init)).toBe(true);
    await tick(10000);
    expect(times(inner.calls)).toEqual([0, 0, 10000]);
    await p;
  });

  test("an unmarked signed request (the auth library's own) is counted but never delayed or retried", async () => {
    const limiter = createLimiter();
    const { fetchFn, calls } = makeFetch([new TypeError("Failed to fetch")]);
    const inner = limiter.wrap(fetchFn, POD_RULES);
    // Fill the window first.
    const auth = limiter.wrap(fetchFn, POD_RULES, { authenticated: true });
    const filler = makeFetch([response(200)]);
    const fillerAuth = limiter.wrap(filler.fetchFn, POD_RULES, {
      authenticated: true,
    });
    await Promise.all([fillerAuth(POD_A), fillerAuth(POD_A)]);
    void auth;
    // The signed token POST goes out at once despite the full window, and its
    // failure is not retried (a retry would reuse a stale DPoP proof).
    const p = inner(IDP, {
      method: "POST",
      headers: AUTH.headers,
      body: "grant=x",
    });
    const rejection = expect(p).rejects.toBeInstanceOf(TypeError);
    await tick(0);
    expect(times(calls)).toEqual([0]);
    await rejection;
    // ...but it was charged: the next queued request must wait for the window.
    const next = limiter.rateLimitedFetch(
      filler.fetchFn,
      POD_A,
      undefined,
      POD_RULES,
    );
    await tick(9999);
    expect(filler.calls).toHaveLength(2);
    await tick(1);
    expect(filler.calls).toHaveLength(3);
    await next;
  });

  test("an unmarked signed request's failure still pauses the bucket", async () => {
    const limiter = createLimiter();
    const { fetchFn, calls } = makeFetch([
      new TypeError("Failed to fetch"),
      response(200),
    ]);
    const inner = limiter.wrap(fetchFn, POD_RULES);
    const post = inner(IDP, {
      method: "POST",
      headers: AUTH.headers,
      body: "grant=x",
    });
    const rejection = expect(post).rejects.toBeInstanceOf(TypeError);
    await tick(0);
    await rejection;
    const get = limiter.rateLimitedFetch(fetchFn, POD_A, undefined, POD_RULES);
    await tick(9999);
    expect(calls).toHaveLength(1);
    await tick(1);
    expect(calls[1].t).toBe(10000);
    await get;
  });

  test("an unmarked signed request's 429 pauses the bucket for Retry-After without retrying", async () => {
    const limiter = createLimiter();
    const { fetchFn, calls } = makeFetch([
      response(429, { "retry-after": "5" }),
      response(200),
    ]);
    const inner = limiter.wrap(fetchFn, POD_RULES);
    const post = inner(IDP, {
      method: "POST",
      headers: AUTH.headers,
      body: "grant=x",
    });
    await tick(0);
    await expect(post).resolves.toMatchObject({ status: 429 });
    expect(calls).toHaveLength(1);
    const get = limiter.rateLimitedFetch(fetchFn, POD_A, undefined, POD_RULES);
    await tick(4999);
    expect(calls).toHaveLength(1);
    await tick(1);
    expect(calls[1].t).toBe(5000);
    await get;
  });

  test("a retry through the authenticated wrap re-enters the auth layer (fresh proof)", async () => {
    const limiter = createLimiter();
    let proof = 0;
    const inner = makeFetch([new TypeError("Failed to fetch"), response(200)]);
    const innerFetch = limiter.wrap(inner.fetchFn, POD_RULES);
    const authLibraryFetch = (input: RequestInfo | URL, init?: RequestInit) =>
      innerFetch(input, {
        ...(init || {}),
        headers: { DPoP: `proof-${++proof}` },
      });
    const outer = limiter.wrap(authLibraryFetch, POD_RULES, {
      authenticated: true,
    });
    const p = outer(POD_A);
    await tick(0);
    await tick(10000);
    expect(times(inner.calls)).toEqual([0, 10000]);
    expect((inner.calls[0].init!.headers as any).DPoP).toBe("proof-1");
    expect((inner.calls[1].init!.headers as any).DPoP).toBe("proof-2");
    await expect(p).resolves.toMatchObject({ status: 200 });
  });
});

describe("network errors (how a block reaches the page)", () => {
  test("a TypeError on a GET is retried after the bucket's retryDelay and pauses the bucket", async () => {
    const limiter = createLimiter();
    const { fetchFn, calls } = makeFetch([
      new TypeError("Failed to fetch"),
      response(200),
    ]);
    const a = limiter.rateLimitedFetch(fetchFn, POD_A, undefined, POD_RULES);
    await tick(0);
    const b = limiter.rateLimitedFetch(fetchFn, POD_B, undefined, POD_RULES);
    await tick(9999);
    expect(calls).toHaveLength(1);
    await tick(1);
    expect(times(calls)).toEqual([0, 10000, 10000]);
    await expect(a).resolves.toMatchObject({ status: 200 });
    await expect(b).resolves.toMatchObject({ status: 200 });
  });

  test("backoff doubles and gives up after maxRetries", async () => {
    const limiter = createLimiter();
    const { fetchFn, calls } = makeFetch([new TypeError("Failed to fetch")]);
    const p = limiter.rateLimitedFetch(fetchFn, POD_A, undefined, {
      ...POD_RULES,
      maxRetries: 2,
      maxBackoffDelay: 60000,
    });
    const rejection = expect(p).rejects.toBeInstanceOf(TypeError);
    await tick(0);
    await tick(10000);
    await tick(20000);
    expect(times(calls)).toEqual([0, 10000, 30000]);
    await rejection;
  });

  test("a non-retryable failure (POST) still pauses the bucket for everyone", async () => {
    const limiter = createLimiter();
    const { fetchFn, calls } = makeFetch([
      new TypeError("Failed to fetch"),
      response(200),
    ]);
    const post = limiter.rateLimitedFetch(
      fetchFn,
      POD_A,
      { method: "POST", body: "{}" },
      POD_RULES,
    );
    const rejection = expect(post).rejects.toBeInstanceOf(TypeError);
    await tick(0);
    await rejection;
    expect(calls).toHaveLength(1);
    const get = limiter.rateLimitedFetch(fetchFn, POD_B, undefined, POD_RULES);
    await tick(9999);
    expect(calls).toHaveLength(1);
    await tick(1);
    expect(calls[1].t).toBe(10000);
    await expect(get).resolves.toMatchObject({ status: 200 });
  });

  test("an exhausted GET still pauses the bucket for the request behind it", async () => {
    const limiter = createLimiter();
    const { fetchFn, calls } = makeFetch([
      new TypeError("Failed to fetch"),
      response(200),
    ]);
    const a = limiter.rateLimitedFetch(fetchFn, POD_A, undefined, {
      ...POD_RULES,
      maxRetries: 0,
    });
    const rejection = expect(a).rejects.toBeInstanceOf(TypeError);
    await tick(0);
    await rejection;
    const b = limiter.rateLimitedFetch(fetchFn, POD_B, undefined, POD_RULES);
    await tick(9999);
    expect(calls).toHaveLength(1);
    await tick(1);
    expect(calls[1].t).toBe(10000);
    await b;
  });

  test("a pause survives a page refresh via sessionStorage", async () => {
    const first = createLimiter();
    const { fetchFn, calls } = makeFetch([
      new TypeError("Failed to fetch"),
      response(200),
    ]);
    const failed = first.rateLimitedFetch(fetchFn, POD_A, undefined, {
      ...POD_RULES,
      maxRetries: 0,
    });
    const rejection = expect(failed).rejects.toBeInstanceOf(TypeError);
    await tick(0);
    await rejection;
    // "Refresh" 3 seconds into the 10 second block.
    await tick(3000);
    const second = createLimiter();
    const login = second.rateLimitedFetch(fetchFn, IDP, undefined, POD_RULES);
    await tick(6999);
    expect(calls).toHaveLength(1);
    await tick(1);
    expect(calls[1].t).toBe(10000);
    await expect(login).resolves.toMatchObject({ status: 200 });
  });

  test("not retried when retryNetworkErrors is false; non-TypeErrors never retried", async () => {
    const limiter = createLimiter();
    const a = makeFetch([new TypeError("Failed to fetch")]);
    const pa = limiter.rateLimitedFetch(a.fetchFn, POD_A, undefined, {
      ...POD_RULES,
      retryNetworkErrors: false,
    });
    const ra = expect(pa).rejects.toBeInstanceOf(TypeError);
    await tick(0);
    await ra;
    expect(a.calls).toHaveLength(1);

    // A fresh limiter: the failure above paused the previous one's bucket.
    const b = makeFetch([new Error("boom")]);
    const pb = createLimiter().rateLimitedFetch(
      b.fetchFn,
      POD_A,
      undefined,
      POD_RULES,
    );
    const rb = expect(pb).rejects.toThrow("boom");
    // The fresh limiter inherits the persisted pause; move past it.
    await tick(10000);
    await rb;
    expect(b.calls).toHaveLength(1);
  });

  test("a GET with a stream body is not retried", async () => {
    const limiter = createLimiter();
    const { fetchFn, calls } = makeFetch([new TypeError("Failed to fetch")]);
    const p = limiter.rateLimitedFetch(
      fetchFn,
      POD_A,
      { body: new ReadableStream() },
      POD_RULES,
    );
    const rejection = expect(p).rejects.toBeInstanceOf(TypeError);
    await tick(0);
    await rejection;
    expect(calls).toHaveLength(1);
  });
});

describe("429 responses (if a server ever exposes one)", () => {
  test("Retry-After is honoured and pauses the bucket", async () => {
    const limiter = createLimiter();
    const { fetchFn, calls } = makeFetch([
      response(429, { "retry-after": "2" }),
      response(200),
    ]);
    const first = limiter.rateLimitedFetch(fetchFn, POD_A, undefined, {});
    await tick(0);
    const second = limiter.rateLimitedFetch(fetchFn, POD_B, undefined, {});
    await tick(1999);
    expect(calls).toHaveLength(1);
    await tick(1);
    expect(times(calls)).toEqual([0, 2000, 2000]);
    await expect(first).resolves.toMatchObject({ status: 200 });
    await expect(second).resolves.toMatchObject({ status: 200 });
  });

  test("a POST Request is cloned per attempt so its body can be sent again", async () => {
    const limiter = createLimiter();
    const { fetchFn, calls } = makeFetch([
      response(429, { "retry-after": "1" }),
      response(200),
    ]);
    const req = new Request(POD_A, { method: "POST", body: "payload" });
    const p = limiter.rateLimitedFetch(fetchFn, req, undefined, {});
    await tick(0);
    await tick(1000);
    expect(calls).toHaveLength(2);
    const bodies = await Promise.all(
      calls.map((c) => (c.input as Request).text()),
    );
    expect(bodies).toEqual(["payload", "payload"]);
    expect(req.bodyUsed).toBe(false);
    await expect(p).resolves.toMatchObject({ status: 200 });
  });

  test("a Retry-After beyond maxRetryAfter is not retried but still pauses", async () => {
    const limiter = createLimiter();
    const { fetchFn, calls } = makeFetch([
      response(429, { "retry-after": "3600" }),
      response(200),
    ]);
    const a = limiter.rateLimitedFetch(fetchFn, POD_A, undefined, {});
    await tick(0);
    await expect(a).resolves.toMatchObject({ status: 429 });
    const c = limiter.rateLimitedFetch(fetchFn, POD_B, undefined, {});
    await tick(3600 * 1000 - 1);
    expect(calls).toHaveLength(1);
    await tick(1);
    expect(calls[1].t).toBe(3600 * 1000);
    await expect(c).resolves.toMatchObject({ status: 200 });
  });

  test("the final, exhausted 429 still pauses the bucket", async () => {
    const limiter = createLimiter();
    const { fetchFn, calls } = makeFetch([response(429), response(200)]);
    const a = limiter.rateLimitedFetch(fetchFn, POD_A, undefined, {
      maxRetries: 0,
    });
    await tick(0);
    await expect(a).resolves.toMatchObject({ status: 429 });
    const c = limiter.rateLimitedFetch(fetchFn, POD_B, undefined, {});
    await tick(999);
    expect(calls).toHaveLength(1);
    await tick(1);
    expect(calls[1].t).toBe(1000);
    await expect(c).resolves.toMatchObject({ status: 200 });
  });

  test("other error statuses are returned immediately", async () => {
    const limiter = createLimiter();
    const { fetchFn, calls } = makeFetch([response(500)]);
    const p = limiter.rateLimitedFetch(fetchFn, POD_A, undefined, {});
    await tick(0);
    await expect(p).resolves.toMatchObject({ status: 500 });
    expect(calls).toHaveLength(1);
  });
});

describe("abort", () => {
  const ONE = {
    buckets: [
      { hostSuffix: "solidcommunity.net", maxRequests: 1, windowMs: 10000 },
    ],
  };

  test("aborting while queued rejects at once, without waiting for the turn", async () => {
    const limiter = createLimiter();
    const { fetchFn, calls } = makeFetch([response(200)]);
    const controller = new AbortController();
    const first = limiter.rateLimitedFetch(fetchFn, POD_A, undefined, ONE);
    const second = limiter.rateLimitedFetch(
      fetchFn,
      POD_B,
      { signal: controller.signal },
      ONE,
    );
    const rejection = expect(second).rejects.toMatchObject({
      name: "AbortError",
    });
    await tick(0);
    controller.abort();
    await tick(0); // no time passes
    await rejection;
    expect(calls).toHaveLength(1);
    await first;
  });

  test("aborting a request behind another waiting request rejects at once", async () => {
    const limiter = createLimiter();
    const { fetchFn, calls } = makeFetch([response(200)]);
    const controller = new AbortController();
    const a = limiter.rateLimitedFetch(fetchFn, POD_A, undefined, ONE); // starts now
    const b = limiter.rateLimitedFetch(fetchFn, POD_B, undefined, ONE); // waits 10s
    const c = limiter.rateLimitedFetch(
      fetchFn,
      POD_A,
      { signal: controller.signal },
      ONE,
    );
    const rejection = expect(c).rejects.toMatchObject({ name: "AbortError" });
    await tick(0);
    controller.abort();
    await tick(0); // no time passes; B is still waiting
    await rejection;
    await tick(10000);
    await a;
    await b;
    // C never started, and B was not disturbed.
    expect(calls.map((x) => x.url)).toEqual([POD_A, POD_B]);
  });

  test("a signal on a Request object is honoured", async () => {
    const limiter = createLimiter();
    const { fetchFn, calls } = makeFetch([response(200)]);
    const controller = new AbortController();
    controller.abort();
    const req = new Request(POD_A, { signal: controller.signal });
    await expect(
      limiter.rateLimitedFetch(fetchFn, req, undefined, ONE),
    ).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(calls).toHaveLength(0);
  });
});
