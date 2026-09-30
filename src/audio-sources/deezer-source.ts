import { RateLimitedFetch } from './rate-limited-fetch.ts';
import { TtlCache } from './ttl-cache.ts';
import type { AudioSource, TrackPreview, TrackQuery } from './types.ts';

const DEFAULT_BASE_URL = 'https://api.deezer.com';
const DEFAULT_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h: Deezer's catalog/preview URLs are effectively static.

interface DeezerTrack {
  id: number;
  title: string;
  preview: string; // empty string when no preview clip exists
  artist?: { name?: string };
  album?: { title?: string };
  duration?: number;
}

interface DeezerSearchResponse {
  data?: DeezerTrack[];
  error?: DeezerApiError;
}

interface DeezerTrackResponse extends Partial<DeezerTrack> {
  error?: DeezerApiError;
}

interface DeezerApiError {
  type?: string;
  message?: string;
  code?: number;
}

export interface DeezerAudioSourceOptions {
  baseUrl?: string;
  cacheTtlMs?: number;
  /** Minimum time between outgoing requests, in ms — keeps repeated searches from bursting the API. */
  minRequestIntervalMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Primary audio source: Deezer's public, unauthenticated catalog API.
 *
 * No developer token/app review is required today, which is why this is
 * primary — but that access could tighten without notice (Spotify removed
 * equivalent public preview access in late 2024). This class only implements
 * `AudioSource`; nothing outside `audio-sources/` should import Deezer
 * specifics directly.
 */
export class DeezerAudioSource implements AudioSource {
  readonly name = 'deezer';

  private readonly baseUrl: string;
  private readonly cache: TtlCache<TrackPreview | null>;
  private readonly rateLimitedFetch: RateLimitedFetch;

  constructor(options: DeezerAudioSourceOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.cache = new TtlCache(options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS);
    this.rateLimitedFetch = new RateLimitedFetch({
      minIntervalMs: options.minRequestIntervalMs,
      fetchImpl: options.fetchImpl,
    });
  }

  async findPreview(query: TrackQuery): Promise<TrackPreview | null> {
    const cacheKey = this.cacheKeyFor(query);
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) return cached;

    const track = query.isrc
      ? (await this.lookupByIsrc(query.isrc)) ?? (await this.search(query))
      : await this.search(query);

    const preview = track ? toTrackPreview(track) : null;
    this.cache.set(cacheKey, preview);
    return preview;
  }

  private cacheKeyFor(query: TrackQuery): string {
    return query.isrc
      ? `isrc:${query.isrc}`
      : `search:${query.artist.trim().toLowerCase()}::${query.title.trim().toLowerCase()}`;
  }

  private async lookupByIsrc(isrc: string): Promise<DeezerTrack | null> {
    const response = await this.get<DeezerTrackResponse>(`/track/isrc:${encodeURIComponent(isrc)}`);
    if (!response || response.error || !response.id) return null;
    return response as DeezerTrack;
  }

  private async search(query: TrackQuery): Promise<DeezerTrack | null> {
    // Deezer's documented `artist:"x" track:"y"` advanced filter syntax currently returns zero
    // results when both filters are combined (verified live against api.deezer.com), even
    // though each filter works alone. Plain free-text search doesn't have that problem and
    // Deezer's own relevance ranking reliably surfaces the right track first, so search that
    // way and just guard against a same-titled track by the wrong artist outranking it.
    const q = `${sanitizeQueryTerm(query.artist)} ${sanitizeQueryTerm(query.title)}`.trim();
    const response = await this.get<DeezerSearchResponse>(`/search?q=${encodeURIComponent(q)}`);
    if (!response || response.error || !response.data?.length) return null;
    return pickBestMatch(response.data, query.artist);
  }

  private async get<T>(path: string): Promise<T | null> {
    const response = await this.rateLimitedFetch.fetch(`${this.baseUrl}${path}`);
    if (!response.ok) return null;
    return (await response.json()) as T;
  }
}

function toTrackPreview(track: DeezerTrack): TrackPreview | null {
  if (!track.preview) return null; // Deezer returns "" (not a missing field) when no preview clip exists.
  return {
    source: 'deezer',
    trackId: String(track.id),
    artist: track.artist?.name ?? '',
    title: track.title,
    album: track.album?.title,
    previewUrl: track.preview,
    durationSeconds: track.duration,
  };
}

/** Strips characters Deezer's query parser treats as advanced-search syntax (quotes, field-filter colons). */
function sanitizeQueryTerm(value: string): string {
  return value.replace(/[":]/g, ' ').trim();
}

/** Prefers an exact (case-insensitive) artist-name match over Deezer's raw relevance ranking. */
function pickBestMatch(tracks: DeezerTrack[], artist: string): DeezerTrack {
  const normalizedArtist = normalize(artist);
  const exactArtistMatch = tracks.find((track) => normalize(track.artist?.name ?? '') === normalizedArtist);
  return exactArtistMatch ?? tracks[0];
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}
