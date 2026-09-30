import jwt from "jsonwebtoken";

/**
 * Apple caps developer token lifetime at 6 months (15777000s). We default to
 * a much shorter rotation window so a leaked token has a small blast radius
 * and so rotation logic actually gets exercised well before the hard cap.
 */
export const APPLE_MAX_TOKEN_TTL_SECONDS = 15_777_000;
const DEFAULT_TOKEN_TTL_SECONDS = 12 * 60 * 60; // 12 hours
/** Refresh this long before expiry so an in-flight request never races a rotation. */
const REFRESH_SKEW_SECONDS = 5 * 60;

export interface AppleMusicTokenConfig {
  /** Apple Developer Team ID (issuer). */
  teamId: string;
  /** ID of the MusicKit private key registered in the Apple Developer portal. */
  keyId: string;
  /** PEM-encoded ES256 private key (.p8 file contents) for that key ID. */
  privateKey: string;
  /** Token lifetime in seconds; capped at Apple's 6-month maximum. */
  tokenTtlSeconds?: number;
  /** Injectable clock for tests. */
  now?: () => number;
}

/**
 * Generates and caches an Apple Music (MusicKit) developer JWT, rotating it
 * before expiry. This is the app-level developer token used for catalog
 * lookups — distinct from a per-user MusicKit token, which isn't needed for
 * public catalog search/preview URLs.
 */
export class AppleMusicTokenProvider {
  private readonly teamId: string;
  private readonly keyId: string;
  private readonly privateKey: string;
  private readonly tokenTtlSeconds: number;
  private readonly now: () => number;

  private cachedToken: string | null = null;
  private cachedExpiryMs = 0;

  constructor(config: AppleMusicTokenConfig) {
    if (!config.teamId || !config.keyId || !config.privateKey) {
      throw new Error(
        "AppleMusicTokenProvider requires teamId, keyId, and privateKey",
      );
    }
    this.teamId = config.teamId;
    this.keyId = config.keyId;
    this.privateKey = config.privateKey;
    this.tokenTtlSeconds = Math.min(
      config.tokenTtlSeconds ?? DEFAULT_TOKEN_TTL_SECONDS,
      APPLE_MAX_TOKEN_TTL_SECONDS,
    );
    this.now = config.now ?? (() => Date.now());
  }

  /** Returns a valid developer token, generating a fresh one if none is cached or it's near expiry. */
  getToken(): string {
    const nowMs = this.now();
    if (this.cachedToken && nowMs < this.cachedExpiryMs - REFRESH_SKEW_SECONDS * 1000) {
      return this.cachedToken;
    }
    return this.rotate(nowMs);
  }

  private rotate(nowMs: number): string {
    const nowSeconds = Math.floor(nowMs / 1000);
    const token = jwt.sign({}, this.privateKey, {
      algorithm: "ES256",
      issuer: this.teamId,
      keyid: this.keyId,
      expiresIn: this.tokenTtlSeconds,
    });
    this.cachedToken = token;
    this.cachedExpiryMs = (nowSeconds + this.tokenTtlSeconds) * 1000;
    return token;
  }
}
