/**
 * Simple TTL cache: stores results with expiration time.
 */
class Cache {
  constructor(ttlMs = 6 * 60 * 60 * 1000) {
    this.ttlMs = ttlMs;
    this.store = new Map();
  }

  set(key, value) {
    const expiresAt = Date.now() + this.ttlMs;
    this.store.set(key, { value, expiresAt });
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  clear() {
    this.store.clear();
  }
}

module.exports = Cache;
