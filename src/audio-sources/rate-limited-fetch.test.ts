import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RateLimitedFetch } from './rate-limited-fetch.ts';

test('spaces out consecutive requests by at least minIntervalMs', async () => {
  const timestamps: number[] = [];
  const fetchImpl = async () => {
    timestamps.push(Date.now());
    return new Response('{}', { status: 200 });
  };

  const limiter = new RateLimitedFetch({ minIntervalMs: 50, fetchImpl });
  await Promise.all([limiter.fetch('a'), limiter.fetch('b'), limiter.fetch('c')]);

  assert.equal(timestamps.length, 3);
  assert.ok(timestamps[1] - timestamps[0] >= 45, `gap was ${timestamps[1] - timestamps[0]}ms`);
  assert.ok(timestamps[2] - timestamps[1] >= 45, `gap was ${timestamps[2] - timestamps[1]}ms`);
});

test('retries on 429 honoring Retry-After, then returns the successful response', async () => {
  let attempts = 0;
  const fetchImpl = async () => {
    attempts++;
    if (attempts < 3) return new Response(null, { status: 429, headers: { 'retry-after': '0' } });
    return new Response('ok', { status: 200 });
  };

  const limiter = new RateLimitedFetch({ minIntervalMs: 0, fetchImpl, maxRetries: 5 });
  const response = await limiter.fetch('a');

  assert.equal(response.status, 200);
  assert.equal(attempts, 3);
});

test('stops retrying after maxRetries and returns the last 429 response', async () => {
  let attempts = 0;
  const fetchImpl = async () => {
    attempts++;
    return new Response(null, { status: 429, headers: { 'retry-after': '0' } });
  };

  const limiter = new RateLimitedFetch({ minIntervalMs: 0, fetchImpl, maxRetries: 2 });
  const response = await limiter.fetch('a');

  assert.equal(response.status, 429);
  assert.equal(attempts, 3); // initial attempt + 2 retries
});
