/**
 * Shared contract for preview-clip audio sources (Deezer, Apple Music, etc).
 * Game logic depends only on this interface, never on a specific provider,
 * so sources can be added/reordered/disabled without touching callers.
 */

export interface TrackQuery {
  artist: string;
  title: string;
}

export interface PreviewResult {
  /** Which source resolved this preview, e.g. "apple-music" or "deezer". */
  source: string;
  /** Direct URL to the short promotional preview clip audio. */
  previewUrl: string;
  /** Track title as returned by the source's catalog. */
  title: string;
  /** Primary artist name as returned by the source's catalog. */
  artist: string;
  /** Approximate preview clip duration in seconds, if the source reports one. */
  durationSeconds?: number;
  /** Opaque per-source identifier for the matched catalog entry. */
  externalId?: string;
}

export interface AudioSource {
  /** Stable identifier used in PreviewResult.source and logs, e.g. "apple-music". */
  readonly name: string;

  /**
   * Look up a preview clip for the given artist/title.
   * Resolves to null (not a rejection) when the source has no match or no
   * preview available for the matched track — that is an expected, common
   * outcome for a promotional-preview catalog, not an error.
   */
  findPreview(query: TrackQuery): Promise<PreviewResult | null>;
}
