/**
 * Shared contract for preview-clip audio sources (Deezer, Apple Music, ...).
 *
 * Game logic depends only on this interface, never on a specific provider,
 * so a source can be swapped or disabled (e.g. if a provider locks down
 * access the way Spotify did in late 2024) without touching callers.
 */

export interface TrackQuery {
  artist: string;
  title: string;
  /** External identifier (e.g. ISRC) to use for a more precise lookup when available. */
  isrc?: string;
}

export interface TrackPreview {
  /** Name of the source that served this result, e.g. "deezer". */
  source: string;
  /** Source-native track identifier. */
  trackId: string;
  artist: string;
  title: string;
  album?: string;
  /** Direct URL to a short (typically 30s) promotional preview clip. */
  previewUrl: string;
  durationSeconds?: number;
}

export interface AudioSource {
  readonly name: string;
  /**
   * Look up a track and return its preview clip, or null if the track
   * couldn't be found or has no preview available.
   */
  findPreview(query: TrackQuery): Promise<TrackPreview | null>;
}
