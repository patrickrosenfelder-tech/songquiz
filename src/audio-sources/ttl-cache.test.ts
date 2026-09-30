import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TtlCache } from './ttl-cache.ts';

test('returns a stored value before it expires', () => {
  const cache = new TtlCache<string>(10_000);
  cache.set('key', 'value');
  assert.equal(cache.get('key'), 'value');
});

test('returns undefined for an unknown key', () => {
  const cache = new TtlCache<string>(10_000);
  assert.equal(cache.get('missing'), undefined);
});

test('expires entries after the configured TTL', async () => {
  const cache = new TtlCache<string>(10);
  cache.set('key', 'value');
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(cache.get('key'), undefined);
});

test('caches null values distinctly from "not cached"', () => {
  const cache = new TtlCache<string | null>(10_000);
  cache.set('key', null);
  assert.equal(cache.get('key'), null);
});
