import { createFileRoute } from "@tanstack/react-router";
import { apiURL } from "../api";
import { isSlug } from "../slug";

const sseHeaders = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
};

export const Route = createFileRoute("/eventos/tienda/$shop")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        if (!isSlug(params.shop)) {
          return new Response("Tienda inválida", { status: 400 });
        }
        try {
          const upstream = await fetch(apiURL("/api/shops/" + params.shop + "/stream"), {
            headers: { Accept: "text/event-stream" },
            signal: request.signal,
            redirect: "error",
          });
          if (!upstream.ok || !upstream.body) {
            return new Response("No disponible", { status: upstream.status || 503 });
          }
          return new Response(upstream.body, { status: 200, headers: sseHeaders });
        } catch {
          return new Response("No disponible", { status: 503 });
        }
      },
    },
  },
});
