import { createFileRoute } from "@tanstack/react-router";
import { apiFetch, readLimited, sameOrigin } from "../api";

export const Route = createFileRoute("/gestion")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const headers = { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" };
        if (!sameOrigin(request)) {
          return new Response("Origen inválido", { status: 403, headers });
        }
        if (request.headers.get("Content-Type") !== "application/json" || !request.body) {
          return new Response("Datos inválidos", { status: 400, headers });
        }
        try {
          const body = await readLimited(request, 32 * 1024);
          if (!body) {
            return new Response("Los datos exceden el tamaño permitido", { status: 413, headers });
          }
          const response = await apiFetch("/api/panel", {
            request, method: "POST", headers: { "Content-Type": "application/json" }, body, timeout: 7000,
          });
          return new Response(response.status === 204 ? null : await response.text(), { status: response.status, headers });
        } catch {
          return new Response("No se pudo conectar con el servidor", { status: 503, headers });
        }
      },
    },
  },
});
