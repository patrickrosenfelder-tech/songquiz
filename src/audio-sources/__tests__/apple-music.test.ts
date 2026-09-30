import { describe, expect, it, vi } from "vitest";
import { AppleMusicSource } from "../apple-music.js";
import type { AppleMusicTokenProvider } from "../apple-music-token.js";

function fakeTokenProvider(token = "fake-dev-token"): AppleMusicTokenProvider {
  return { getToken: () => token } as unknown as AppleMusicTokenProvider;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("AppleMusicSource", () => {
  it("returns a preview result extracted from a matching song", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        results: {
          songs: {
            data: [
              {
                id: "12345",
                attributes: {
                  name: "Test Song",
                  artistName: "Test Artist",
                  durationInMillis: 210000,
                  previews: [{ url: "https://example.com/preview.m4a" }],
                },
              },
            ],
          },
        },
      }),
    );

    const source = new AppleMusicSource({
      tokenProvider: fakeTokenProvider(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await source.findPreview({
      artist: "Test Artist",
      title: "Test Song",
    });

    expect(result).toEqual({
      source: "apple-music",
      previewUrl: "https://example.com/preview.m4a",
      title: "Test Song",
      artist: "Test Artist",
      durationSeconds: 210,
      externalId: "12345",
    });

    const [calledUrl, calledInit] = fetchImpl.mock.calls[0];
    expect(String(calledUrl)).toContain("/v1/catalog/us/search");
    expect(String(calledUrl)).toContain("types=songs");
    expect((calledInit as RequestInit).headers).toEqual({
      Authorization: "Bearer fake-dev-token",
    });
  });

  it("uses the configured storefront", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ results: {} }));
    const source = new AppleMusicSource({
      tokenProvider: fakeTokenProvider(),
      storefront: "gb",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await source.findPreview({ artist: "A", title: "B" });

    const [calledUrl] = fetchImpl.mock.calls[0];
    expect(String(calledUrl)).toContain("/v1/catalog/gb/search");
  });

  it("returns null when there is no matching song", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ results: {} }));
    const source = new AppleMusicSource({
      tokenProvider: fakeTokenProvider(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await source.findPreview({
      artist: "Nobody",
      title: "Nothing",
    });

    expect(result).toBeNull();
  });

  it("returns null when the matched song has no preview clip", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        results: {
          songs: {
            data: [
              {
                id: "1",
                attributes: {
                  name: "No Preview Song",
                  artistName: "Someone",
                  previews: [],
                },
              },
            ],
          },
        },
      }),
    );

    const source = new AppleMusicSource({
      tokenProvider: fakeTokenProvider(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await source.findPreview({
      artist: "Someone",
      title: "No Preview Song",
    });

    expect(result).toBeNull();
  });

  it("throws on a non-ok HTTP response instead of treating it as a miss", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ errors: [] }, 401));
    const source = new AppleMusicSource({
      tokenProvider: fakeTokenProvider(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(
      source.findPreview({ artist: "A", title: "B" }),
    ).rejects.toThrow(/401/);
  });
});
