/** Provider-agnostic preview lookup. */

/**
 * Convert a provider's catalog object to the shape used by game code.
 * @param {Record<string, any>} track
 * @param {string} source
 */
export function normalizeTrack(track, source) {
  const artists = Array.isArray(track.artists)
    ? track.artists.map((artist) => artist?.name).filter(Boolean).join(', ')
    : track.artists;
  const album = typeof track.album === 'object' ? track.album?.title ?? track.album?.name : track.album;
  const previewUrl = track.previewUrl ?? track.preview_url ?? track.preview;

  if (!track.title && !track.name) throw new TypeError(`${source} returned a track without a title`);
  if (!previewUrl) return null;
  return {
    id: String(track.id ?? track.trackId ?? `${source}:${track.title}:${track.artist ?? artists ?? ''}`),
    title: track.title ?? track.name,
    artist: track.artist ?? track.artistName ?? artists ?? 'Unknown artist',
    album: album ?? null,
    artworkUrl: track.artworkUrl ?? track.artwork_url ?? null,
    previewUrl,
    durationMs: track.durationMs ?? track.duration ?? null,
    source,
  };
}

/**
 * Providers need only a name and `findPreview(query)` method. It may return a
 * native catalog track, null for no match, or throw when its service fails.
 * @param {Array<{name: string, findPreview(query: unknown): Promise<Record<string, any>|null>|Record<string, any>|null}>} providers
 */
export function createPreviewResolver(providers = []) {
  const registered = [];
  function addProvider(provider) {
    if (!provider?.name || typeof provider.findPreview !== 'function') throw new TypeError('A preview provider needs a name and findPreview(query) function');
    if (registered.some((item) => item.name === provider.name)) throw new Error(`A provider named ${provider.name} is already registered`);
    registered.push(provider);
    return resolver;
  }
  async function resolve(query) {
    const failures = [];
    for (const provider of registered) {
      try {
        const rawTrack = await provider.findPreview(query);
        if (!rawTrack) continue;
        const track = normalizeTrack(rawTrack, provider.name);
        if (track) return { status: 'available', track, failures };
      } catch (error) {
        failures.push({ source: provider.name, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return { status: 'unavailable', track: null, failures };
  }
  const resolver = { addProvider, resolve, get providers() { return registered.map(({ name }) => name); } };
  providers.forEach(addProvider);
  return resolver;
}
