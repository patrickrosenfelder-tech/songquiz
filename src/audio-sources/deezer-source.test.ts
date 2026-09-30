import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DeezerAudioSource } from './deezer-source.ts';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function fakeFetch(handler: (url: string) => Response) {
  const calls: string[] = [];
  const fetchImpl = async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    return handler(url);
  };
  return { fetchImpl, calls };
}

test('search returns a preview for a matching track', async () => {
  const { fetchImpl, calls } = fakeFetch(() =>
    jsonResponse({
      data: [
        {
          id: 123,
          title: 'Song Title',
          preview: 'https://cdn.deezer.example/preview/123.mp3',
          artist: { name: 'Some Artist' },
          album: { title: 'Some Album' },
          duration: 213,
        },
      ],
    }),
  );

  const source = new DeezerAudioSource({ fetchImpl, minRequestIntervalMs: 0 });
  const preview = await source.findPreview({ artist: 'Some Artist', title: 'Song Title' });

  assert.deepEqual(preview, {
    source: 'deezer',
    trackId: '123',
    artist: 'Some Artist',
    title: 'Song Title',
    album: 'Some Album',
    previewUrl: 'https://cdn.deezer.example/preview/123.mp3',
    durationSeconds: 213,
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0], /\/search\?q=/);
});

test('prefers an exact artist-name match over Deezer\'s top-ranked free-text result', async () => {
  const { fetchImpl } = fakeFetch(() =>
    jsonResponse({
      data: [
        { id: 1, title: 'Yellow', preview: 'https://cdn.deezer.example/preview/1.mp3', artist: { name: 'Cover Band' } },
        { id: 2, title: 'Yellow', preview: 'https://cdn.deezer.example/preview/2.mp3', artist: { name: 'Coldplay' } },
      ],
    }),
  );

  const source = new DeezerAudioSource({ fetchImpl, minRequestIntervalMs: 0 });
  const preview = await source.findPreview({ artist: 'Coldplay', title: 'Yellow' });

  assert.equal(preview?.trackId, '2');
});

test('returns null when the track has no preview clip', async () => {
  const { fetchImpl } = fakeFetch(() =>
    jsonResponse({ data: [{ id: 1, title: 'No Preview', preview: '' }] }),
  );

  const source = new DeezerAudioSource({ fetchImpl, minRequestIntervalMs: 0 });
  const preview = await source.findPreview({ artist: 'X', title: 'No Preview' });

  assert.equal(preview, null);
});

test('returns null when nothing matches', async () => {
  const { fetchImpl } = fakeFetch(() => jsonResponse({ data: [] }));

  const source = new DeezerAudioSource({ fetchImpl, minRequestIntervalMs: 0 });
  const preview = await source.findPreview({ artist: 'Nobody', title: 'Nothing' });

  assert.equal(preview, null);
});

test('returns null when Deezer responds with an API error object', async () => {
  const { fetchImpl } = fakeFetch(() =>
    jsonResponse({ error: { type: 'DataException', message: 'bad query', code: 800 } }),
  );

  const source = new DeezerAudioSource({ fetchImpl, minRequestIntervalMs: 0 });
  const preview = await source.findPreview({ artist: 'X', title: 'Y' });

  assert.equal(preview, null);
});

test('prefers ISRC lookup over search when an ISRC is provided', async () => {
  const { fetchImpl, calls } = fakeFetch((url) => {
    if (url.includes('/track/isrc:')) {
      return jsonResponse({
        id: 999,
        title: 'Exact Match',
        preview: 'https://cdn.deezer.example/preview/999.mp3',
        artist: { name: 'Artist' },
      });
    }
    throw new Error(`unexpected request: ${url}`);
  });

  const source = new DeezerAudioSource({ fetchImpl, minRequestIntervalMs: 0 });
  const preview = await source.findPreview({ artist: 'Artist', title: 'Exact Match', isrc: 'USABC1234567' });

  assert.equal(preview?.trackId, '999');
  assert.equal(calls.length, 1);
  assert.match(calls[0], /\/track\/isrc:USABC1234567/);
});

test('falls back to search when ISRC lookup finds nothing', async () => {
  const { fetchImpl, calls } = fakeFetch((url) => {
    if (url.includes('/track/isrc:')) return jsonResponse({ error: { type: 'DataException', code: 800 } });
    return jsonResponse({
      data: [{ id: 42, title: 'Fallback', preview: 'https://cdn.deezer.example/preview/42.mp3' }],
    });
  });

  const source = new DeezerAudioSource({ fetchImpl, minRequestIntervalMs: 0 });
  const preview = await source.findPreview({ artist: 'Artist', title: 'Fallback', isrc: 'UNKNOWN0000000' });

  assert.equal(preview?.trackId, '42');
  assert.equal(calls.length, 2);
});

test('caches repeat lookups for the same track instead of re-hitting the API', async () => {
  const { fetchImpl, calls } = fakeFetch(() =>
    jsonResponse({ data: [{ id: 7, title: 'Cached', preview: 'https://cdn.deezer.example/preview/7.mp3' }] }),
  );

  const source = new DeezerAudioSource({ fetchImpl, minRequestIntervalMs: 0 });
  const query = { artist: 'Artist', title: 'Cached' };

  const first = await source.findPreview(query);
  const second = await source.findPreview({ artist: 'ARTIST', title: 'cached' }); // case-insensitive cache key

  assert.deepEqual(second, first);
  assert.equal(calls.length, 1);
});

test('caches a "no preview" result too, so it does not retry every round', async () => {
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse({ data: [] }));

  const source = new DeezerAudioSource({ fetchImpl, minRequestIntervalMs: 0 });
  const query = { artist: 'Nobody', title: 'Nothing' };

  await source.findPreview(query);
  await source.findPreview(query);

  assert.equal(calls.length, 1);
});

test('retries after a 429 rate-limit response and eventually succeeds', async () => {
  let attempts = 0;
  const fetchImpl = async () => {
    attempts++;
    if (attempts === 1) return new Response(null, { status: 429, headers: { 'retry-after': '0' } });
    return jsonResponse({ data: [{ id: 5, title: 'Retried', preview: 'https://cdn.deezer.example/preview/5.mp3' }] });
  };

  const source = new DeezerAudioSource({ fetchImpl, minRequestIntervalMs: 0 });
  const preview = await source.findPreview({ artist: 'Artist', title: 'Retried' });

  assert.equal(preview?.trackId, '5');
  assert.equal(attempts, 2);
});

test('gives up and returns null after exhausting retries on persistent rate limiting', async () => {
  const { fetchImpl, calls } = fakeFetch(() => new Response(null, { status: 429, headers: { 'retry-after': '0' } }));

  const source = new DeezerAudioSource({ fetchImpl, minRequestIntervalMs: 0 });
  const preview = await source.findPreview({ artist: 'Artist', title: 'AlwaysLimited' });

  assert.equal(preview, null);
  assert.ok(calls.length > 1); // confirms retries actually happened, not just one shot
});
