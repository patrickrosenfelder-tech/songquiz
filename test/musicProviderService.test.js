const test = require('node:test');
const assert = require('node:assert/strict');
const MusicProviderService = require('../src/services/musicProviders/MusicProviderService');

function fakeFetch(responses) {
  return async (url) => {
    for (const [match, handler] of responses) {
      if (url.includes(match)) return handler();
    }
    throw new Error(`no fake response registered for ${url}`);
  };
}

test('uses the primary provider when it succeeds', async () => {
  global.fetch = fakeFetch([
    [
      'api.deezer.com',
      () => ({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 1,
              title: 'Song A',
              artist: { name: 'Artist A' },
              album: { title: 'Album A', cover_medium: 'x' },
              preview: 'https://deezer.example/preview.mp3',
              duration: 30,
            },
          ],
        }),
      }),
    ],
  ]);

  const service = new MusicProviderService({ primaryProviderName: 'deezer', timeoutMs: 1000 });
  const { source, degraded, tracks } = await service.search('song a');

  assert.equal(source, 'deezer');
  assert.equal(degraded, false);
  assert.equal(tracks[0].previewUrl, 'https://deezer.example/preview.mp3');
});

test('falls back to the secondary provider when the primary errors', async () => {
  global.fetch = fakeFetch([
    ['api.deezer.com', () => ({ ok: false, status: 503, json: async () => ({}) })],
    [
      'itunes.apple.com',
      () => ({
        ok: true,
        json: async () => ({
          results: [
            {
              trackId: 99,
              trackName: 'Song A',
              artistName: 'Artist A',
              collectionName: 'Album A',
              artworkUrl100: 'y',
              previewUrl: 'https://apple.example/preview.m4a',
              trackTimeMillis: 30000,
            },
          ],
        }),
      }),
    ],
  ]);

  const service = new MusicProviderService({ primaryProviderName: 'deezer', timeoutMs: 1000 });
  const { source, degraded, tracks } = await service.search('song a');

  assert.equal(source, 'apple');
  assert.equal(degraded, true);
  assert.equal(tracks[0].previewUrl, 'https://apple.example/preview.m4a');
});

test('throws when both providers fail', async () => {
  global.fetch = fakeFetch([
    ['api.deezer.com', () => ({ ok: false, status: 500, json: async () => ({}) })],
    ['itunes.apple.com', () => ({ ok: false, status: 500, json: async () => ({}) })],
  ]);

  const service = new MusicProviderService({ primaryProviderName: 'deezer', timeoutMs: 1000 });
  await assert.rejects(() => service.search('song a'), /All music preview providers failed/);
});
