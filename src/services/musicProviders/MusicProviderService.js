const DeezerProvider = require('./DeezerProvider');
const AppleMusicProvider = require('./AppleMusicProvider');

/**
 * Single entry point the rest of the app calls to get track previews.
 * Callers never talk to Deezer or Apple directly — this is the
 * abstraction layer the issue asks for, and it owns fallback routing:
 * try the configured primary provider first, and if it errors, times
 * out, or returns zero usable results, retry against the other source
 * before giving up.
 */
class MusicProviderService {
  constructor({ primaryProviderName, timeoutMs }) {
    const providers = {
      deezer: new DeezerProvider(timeoutMs),
      apple: new AppleMusicProvider(timeoutMs),
    };

    const primaryName = providers[primaryProviderName] ? primaryProviderName : 'deezer';
    const fallbackName = primaryName === 'deezer' ? 'apple' : 'deezer';

    this.providers = providers;
    this.primary = providers[primaryName];
    this.fallback = providers[fallbackName];
  }

  /**
   * @param {string} query
   * @returns {Promise<{ tracks: NormalizedTrack[], source: string, degraded: boolean }>}
   */
  async search(query) {
    if (!query || !query.trim()) {
      throw new Error('query is required');
    }

    const attempt = async (provider) => {
      const tracks = await provider.search(query);
      if (!tracks.length) {
        throw new Error(`${provider.name} returned no previewable tracks`);
      }
      return tracks;
    };

    try {
      const tracks = await attempt(this.primary);
      return { tracks, source: this.primary.name, degraded: false };
    } catch (primaryError) {
      try {
        const tracks = await attempt(this.fallback);
        return { tracks, source: this.fallback.name, degraded: true };
      } catch (fallbackError) {
        const error = new Error(
          `All music preview providers failed for query "${query}": ` +
            `${this.primary.name}: ${primaryError.message}; ${this.fallback.name}: ${fallbackError.message}`
        );
        error.cause = { primaryError, fallbackError };
        throw error;
      }
    }
  }

  /**
   * Convenience helper for game rounds: fetch one random-ish track for a
   * query and return just what a round needs to play a clip and later
   * check a guess.
   */
  async getRoundTrack(query) {
    const { tracks, source, degraded } = await this.search(query);
    const track = tracks[Math.floor(Math.random() * tracks.length)];
    return { ...track, resolvedSource: source, degraded };
  }
}

module.exports = MusicProviderService;
