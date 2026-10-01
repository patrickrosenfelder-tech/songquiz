const MusicProvider = require('./MusicProvider');

/**
 * Deezer's public search API returns a 30s MP3 preview URL directly, with
 * no auth/API key required, which makes it a good primary source.
 * Docs: https://developers.deezer.com/api/search
 */
class DeezerProvider extends MusicProvider {
  constructor(timeoutMs, options) {
    super('deezer', timeoutMs, options);
  }

  async search(query) {
    const cacheKey = `search:${query.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}`;
    const data = await this.fetchJson(url);

    if (!data || !Array.isArray(data.data)) {
      throw new Error('deezer returned an unexpected payload');
    }

    const results = data.data
      .filter((track) => track.preview)
      .map((track) => ({
        id: String(track.id),
        source: 'deezer',
        title: track.title,
        artist: track.artist ? track.artist.name : 'Unknown',
        album: track.album ? track.album.title : '',
        artworkUrl: track.album ? track.album.cover_medium : null,
        previewUrl: track.preview,
        durationMs: typeof track.duration === 'number' ? track.duration * 1000 : null,
      }));

    this.cache.set(cacheKey, results);
    return results;
  }
}

module.exports = DeezerProvider;
