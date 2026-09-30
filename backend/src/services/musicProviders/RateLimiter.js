/**
 * Simple rate limiter: ensures a minimum interval between outgoing requests
 * to prevent API burst limits.
 */
class RateLimiter {
  constructor(minIntervalMs = 100) {
    this.minIntervalMs = minIntervalMs;
    this.lastRequestTime = 0;
  }

  async wait() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minIntervalMs) {
      await new Promise((resolve) => setTimeout(resolve, this.minIntervalMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }
}

module.exports = RateLimiter;
