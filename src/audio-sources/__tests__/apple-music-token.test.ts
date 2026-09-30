import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { AppleMusicTokenProvider } from "../apple-music-token.js";

// Freshly generated EC P-256 key for tests only — not a real Apple credential.
const TEST_PRIVATE_KEY = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIP3/dHnl2MIRPp7hmjcg6cvaDecrY5qenz0Xl2kseFZ7oAoGCCqGSM49
AwEHoUQDQgAEwvTGkMSbnNnUkte23A2zhP/rZNk7lwHB+3GFXnJXvuBvrbnO1dcr
FFR5AHCVw6EooLJI0HFYeYwlfep6TZYGVA==
-----END EC PRIVATE KEY-----`;

const TEST_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEwvTGkMSbnNnUkte23A2zhP/rZNk7
lwHB+3GFXnJXvuBvrbnO1dcrFFR5AHCVw6EooLJI0HFYeYwlfep6TZYGVA==
-----END PUBLIC KEY-----`;

describe("AppleMusicTokenProvider", () => {
  it("generates an ES256 JWT signed with the developer key, with team/key id claims", () => {
    const provider = new AppleMusicTokenProvider({
      teamId: "TEAM123",
      keyId: "KEY456",
      privateKey: TEST_PRIVATE_KEY,
    });

    const token = provider.getToken();
    const decoded = jwt.verify(token, TEST_PUBLIC_KEY, {
      algorithms: ["ES256"],
    }) as jwt.JwtPayload;

    expect(decoded.iss).toBe("TEAM123");
    const header = jwt.decode(token, { complete: true })?.header;
    expect(header?.alg).toBe("ES256");
    expect(header?.kid).toBe("KEY456");
  });

  it("caches the token across calls within the TTL window", () => {
    let time = 1_000_000_000_000;
    const provider = new AppleMusicTokenProvider({
      teamId: "TEAM123",
      keyId: "KEY456",
      privateKey: TEST_PRIVATE_KEY,
      tokenTtlSeconds: 3600,
      now: () => time,
    });

    const first = provider.getToken();
    time += 10_000; // 10s later, well within TTL
    const second = provider.getToken();

    expect(second).toBe(first);
  });

  it("rotates the token once the refresh skew window is reached", () => {
    let time = 1_000_000_000_000;
    const provider = new AppleMusicTokenProvider({
      teamId: "TEAM123",
      keyId: "KEY456",
      privateKey: TEST_PRIVATE_KEY,
      tokenTtlSeconds: 3600,
      now: () => time,
    });

    const first = provider.getToken();
    time += 3600_000 - 60_000; // inside the 5-minute refresh skew before expiry
    const second = provider.getToken();

    expect(second).not.toBe(first);
  });

  it("throws when required config is missing", () => {
    expect(
      () =>
        new AppleMusicTokenProvider({
          teamId: "",
          keyId: "KEY456",
          privateKey: TEST_PRIVATE_KEY,
        }),
    ).toThrow();
  });
});
