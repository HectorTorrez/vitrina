// How the web server reaches the Go API and guards what it proxies. Call these only on the server.

export function apiURL(path: string) {
  return (process.env.VITRINA_API_URL || "http://127.0.0.1:8080") + path;
}

/** Calls the API; with `request`, on behalf of its visitor by forwarding their session cookie. */
export function apiFetch(path: string, { request, timeout = 5000, ...init }: RequestInit & { request?: Request; timeout?: number } = {}) {
  const headers = new Headers(init.headers);
  if (request) headers.set("Cookie", request.headers.get("Cookie") || "");
  return fetch(apiURL(path), { ...init, headers, signal: AbortSignal.timeout(timeout), redirect: "error" });
}

export function siteOrigin() {
  return (process.env.VITRINA_WEB_ORIGIN || "http://127.0.0.1:5173").replace(/\/$/, "");
}

export function sameOrigin(request: Request) {
  const origin = URL.parse(process.env.VITRINA_WEB_ORIGIN || request.url);
  return origin && request.headers.get("Origin") === origin.origin ? origin : null;
}

export async function readLimited(request: Request, max: number) {
  if (Number(request.headers.get("Content-Length")) > max) return null;
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const buffer = new Uint8Array(max);
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return buffer.slice(0, length);
      if (length + value.length > max) {
        await reader.cancel();
        return null;
      }
      buffer.set(value, length);
      length += value.length;
    }
  } finally {
    reader.releaseLock();
  }
}
