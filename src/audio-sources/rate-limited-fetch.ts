/**
 * Wraps fetch with:
 *  - request spacing, so a burst of lookups doesn't hammer the provider
 *  - retry-with-backoff when the provider signals a rate limit
 *
 * Deezer has no published hard quota for anonymous use, but is known to
 * throttle bursts (HTTP 429, or a body-level quota error). Both are treated
 * the same way here: back off and retry a bounded number of times.
 */

export interface RateLimitedFetchOptions {
  /** Minimum time between requests leaving this limiter, in ms. */
  minIntervalMs?: number;
  /** Max retry attempts after a rate-limit signal, before giving up. */
  maxRetries?: number;
  /** Base delay for exponential backoff between retries, in ms. */
  baseBackoffMs?: number;
  fetchImpl?: typeof fetch;
}

export function isRateLimitResponse(response: Response): boolean {
  return response.status === 429;
}

export class RateLimitedFetch {
  private readonly minIntervalMs: number;
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;
  private readonly fetchImpl: typeof fetch;
  private nextAvailableAt = 0;
  /** Serializes scheduling so concurrent callers don't all read the same nextAvailableAt. */
  private queue: Promise<void> = Promise.resolve();

  constructor(options: RateLimitedFetchOptions = {}) {
    this.minIntervalMs = options.minIntervalMs ?? 100;
    this.maxRetries = options.maxRetries ?? 3;
    this.baseBackoffMs = options.baseBackoffMs ?? 500;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async fetch(url: string, init?: RequestInit): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      await this.waitForSlot();
      const response = await this.fetchImpl(url, init);

      if (!isRateLimitResponse(response) || attempt >= this.maxRetries) {
        return response;
      }

      const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
      const backoffMs = retryAfterMs ?? this.baseBackoffMs * 2 ** attempt;
      await sleep(backoffMs);
    }
  }

  /** Chains onto the previous caller's wait so concurrent callers claim distinct, ordered slots. */
  private waitForSlot(): Promise<void> {
    const next = this.queue.then(async () => {
      const wait = this.nextAvailableAt - Date.now();
      if (wait > 0) await sleep(wait);
      this.nextAvailableAt = Date.now() + this.minIntervalMs;
    });
    this.queue = next;
    return next;
  }
}

function parseRetryAfterMs(headerValue: string | null): number | undefined {
  if (!headerValue) return undefined;
  const seconds = Number(headerValue);
  return Number.isFinite(seconds) ? seconds * 1000 : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
