import { AppleMusicTokenProvider } from "./apple-music-token.js";
import type { AudioSource, PreviewResult, TrackQuery } from "./types.js";

const DEFAULT_BASE_URL = "https://api.music.apple.com";
const DEFAULT_STOREFRONT = "us";

interface AppleMusicSongAttributes {
  name: string;
  artistName: string;
  durationInMillis?: number;
  previews?: { url: string }[];
}

interface AppleMusicSearchResponse {
  results?: {
    songs?: {
      data?: { id: string; attributes: AppleMusicSongAttributes }[];
    };
  };
}

export interface AppleMusicSourceConfig {
  tokenProvider: AppleMusicTokenProvider;
  /** Apple Music storefront country code, e.g. "us", "gb". */
  storefront?: string;
  baseUrl?: string;
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

/**
 * Secondary/fallback preview-clip source backed by Apple Music's catalog
 * search API. Same gray-zone legal posture as the Deezer source this
 * implements the shared AudioSource interface alongside: a promotional
 * preview, not a game-use license.
 */
export class AppleMusicSource implements AudioSource {
  readonly name = "apple-music";

  private readonly tokenProvider: AppleMusicTokenProvider;
  private readonly storefront: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: AppleMusicSourceConfig) {
    this.tokenProvider = config.tokenProvider;
    this.storefront = config.storefront ?? DEFAULT_STOREFRONT;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async findPreview(query: TrackQuery): Promise<PreviewResult | null> {
    const term = `${query.artist} ${query.title}`.trim();
    const url = new URL(`/v1/catalog/${this.storefront}/search`, this.baseUrl);
    url.searchParams.set("term", term);
    url.searchParams.set("types", "songs");
    url.searchParams.set("limit", "1");

    const response = await this.fetchImpl(url, {
      headers: {
        Authorization: `Bearer ${this.tokenProvider.getToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Apple Music catalog search failed with status ${response.status}`,
      );
    }

    const body = (await response.json()) as AppleMusicSearchResponse;
    const song = body.results?.songs?.data?.[0];
    if (!song) {
      return null;
    }

    const previewUrl = song.attributes.previews?.[0]?.url;
    if (!previewUrl) {
      return null;
    }

    return {
      source: this.name,
      previewUrl,
      title: song.attributes.name,
      artist: song.attributes.artistName,
      durationSeconds: song.attributes.durationInMillis
        ? Math.round(song.attributes.durationInMillis / 1000)
        : undefined,
      externalId: song.id,
    };
  }
}
