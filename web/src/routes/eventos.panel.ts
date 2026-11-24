import { createFileRoute } from "@tanstack/react-router";
import { apiURL } from "../api";

const sseHeaders = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
};

export const Route = createFileRoute("/eventos/panel")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const upstream = await fetch(apiURL("/api/panel/stream"), {
            headers: {
              Accept: "text/event-stream",
              Cookie: request.headers.get("Cookie") || "",
            },
            signal: request.signal,
            redirect: "error",
          });
          if (upstream.status === 401) {
            return new Response(null, { status: 401 });
          }
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
