/**
 * Common interface every music preview provider must implement, so the
 * fallback routing in MusicProviderService can treat providers
 * interchangeably regardless of the upstream API's own shape.
 */
class MusicProvider {
  constructor(name, timeoutMs) {
    if (this.constructor === MusicProvider) {
      throw new Error('MusicProvider is abstract and cannot be instantiated directly');
    }
    this.name = name;
    this.timeoutMs = timeoutMs;
  }

  /**
   * @param {string} query free-text search (title, artist, etc.)
   * @returns {Promise<NormalizedTrack[]>}
   */
  // eslint-disable-next-line no-unused-vars
  async search(query) {
    throw new Error(`${this.name} provider does not implement search()`);
  }

  async fetchJson(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`${this.name} responded with HTTP ${res.status}`);
      }
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * @typedef {Object} NormalizedTrack
 * @property {string} id
 * @property {string} source        - provider name, e.g. "deezer" | "apple"
 * @property {string} title
 * @property {string} artist
 * @property {string} album
 * @property {string|null} artworkUrl
 * @property {string|null} previewUrl - 30s (or similar) clip, the field the
 *                                      game actually needs to play a round
 * @property {number|null} durationMs
 */

module.exports = MusicProvider;
