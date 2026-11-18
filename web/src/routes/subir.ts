import { createFileRoute } from "@tanstack/react-router";
import { apiFetch, readLimited, sameOrigin } from "../api";

export const Route = createFileRoute("/subir")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const headers = { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" };
        if (!sameOrigin(request)) {
          return new Response("Origen inválido", { status: 403, headers });
        }
        const body = await readLimited(request, 5 * 1024 * 1024).catch(() => undefined);
        if (body === undefined) return new Response("Elegí una foto", { status: 400, headers });
        if (!body) return new Response("La foto supera los 5 MB", { status: 413, headers });
        if (body.byteLength === 0) return new Response("Elegí una foto", { status: 400, headers });
        const res = await apiFetch("/api/panel/images", {
          request, method: "POST", headers: { "Content-Type": "application/octet-stream" }, body, timeout: 20000,
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
