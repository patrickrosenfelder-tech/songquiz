import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreviewResolver, normalizeTrack } from '../src/music-sources.js';

test('uses providers in priority order and normalizes their catalog data', async () => {
  const resolver = createPreviewResolver([
    { name: 'deezer', findPreview: async () => null },
    { name: 'apple-music', findPreview: async () => ({ id: 7, name: 'Song', artists: [{ name: 'Artist' }], album: { title: 'Album' }, previewUrl: 'https://clips.example/song.mp3' }) },
  ]);
  const result = await resolver.resolve({ title: 'Song', artist: 'Artist' });
  assert.equal(result.status, 'available');
  assert.deepEqual(result.track, { id: '7', title: 'Song', artist: 'Artist', album: 'Album', artworkUrl: null, previewUrl: 'https://clips.example/song.mp3', durationMs: null, source: 'apple-music' });
});

test('continues after a provider failure and reports it for observability', async () => {
  const resolver = createPreviewResolver([
    { name: 'deezer', findPreview: async () => { throw new Error('rate limited'); } },
    { name: 'backup', findPreview: async () => ({ title: 'Song', artist: 'Artist', preview: 'https://clips.example/song.mp3' }) },
  ]);
  const result = await resolver.resolve('Song');
  assert.equal(result.track.source, 'backup');
  assert.deepEqual(result.failures, [{ source: 'deezer', error: 'rate limited' }]);
});

test('returns an explicit unavailable result when no source supplies a preview', async () => {
  const resolver = createPreviewResolver([{ name: 'deezer', findPreview: async () => ({ title: 'Song' }) }]);
  assert.deepEqual(await resolver.resolve('Song'), { status: 'unavailable', track: null, failures: [] });
});

test('normalizes Deezer-style preview field names', () => {
  assert.equal(normalizeTrack({ id: 1, title: 'Song', artist: 'Artist', preview: 'clip' }, 'deezer').artist, 'Artist');
});
