const MusicProvider = require('./MusicProvider');

/**
 * Uses Apple's public iTunes Search API, which needs no API key and
 * returns a `previewUrl` (30s AAC clip) per track. The full Apple Music
 * (MusicKit) API offers the same catalog plus longer previews but requires
 * a paid developer account and a signed JWT — swap this provider's
 * fetchJson call for a MusicKit request if that becomes available, the
 * rest of the interface stays the same.
 * Docs: https://performance-partners.apple.com/search-api
 */
class AppleMusicProvider extends MusicProvider {
  constructor(timeoutMs) {
    super('apple', timeoutMs);
  }

  async search(query) {
    const url = `https://itunes.apple.com/search?media=music&entity=song&limit=25&term=${encodeURIComponent(query)}`;
    const data = await this.fetchJson(url);

    if (!data || !Array.isArray(data.results)) {
      throw new Error('apple returned an unexpected payload');
    }

    return data.results
      .filter((track) => track.previewUrl)
      .map((track) => ({
        id: String(track.trackId),
        source: 'apple',
        title: track.trackName,
        artist: track.artistName || 'Unknown',
        album: track.collectionName || '',
        artworkUrl: track.artworkUrl100 || null,
        previewUrl: track.previewUrl,
        durationMs: typeof track.trackTimeMillis === 'number' ? track.trackTimeMillis : null,
      }));
  }
}

module.exports = AppleMusicProvider;
