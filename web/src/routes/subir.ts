import { createFileRoute } from "@tanstack/react-router";
import { apiURL } from "../catalog";

const maxBytes = 5 * 1024 * 1024;

export const Route = createFileRoute("/subir")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const headers = { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" };
        const origin = URL.parse(process.env.VITRINA_WEB_ORIGIN || request.url);
        if (!origin || request.headers.get("Origin") !== origin.origin) {
          return new Response("Origen inválido", { status: 403, headers });
        }
        if (Number(request.headers.get("Content-Length") || 0) > maxBytes) {
          return new Response("La foto supera los 5 MB", { status: 413, headers });
        }
        const body = await request.arrayBuffer().catch(() => null);
        if (!body || body.byteLength === 0) return new Response("Elegí una foto", { status: 400, headers });
        if (body.byteLength > maxBytes) return new Response("La foto supera los 5 MB", { status: 413, headers });
        const res = await fetch(apiURL("/api/panel/images"), {
          method: "POST",
          headers: { Cookie: request.headers.get("Cookie") || "", "Content-Type": "application/octet-stream" },
          body,
          signal: AbortSignal.timeout(20000),
          redirect: "error",
        }).catch(() => null);
        if (!res) return new Response("No se pudo conectar con el servidor", { status: 503, headers });
        return new Response(await res.text(), {
          status: res.status,
          headers: { ...headers, "Content-Type": res.headers.get("Content-Type") || headers["Content-Type"] },
        });
      },
    },
  },
});
