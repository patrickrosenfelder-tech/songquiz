// JSON calls to the backend's /api routes. In dev, CRA's proxy forwards them to :8080,
// so the session cookie stays same-origin.
export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Couldn't reach the server. Try again.");
  }
  return data;
}
