import { createFileRoute } from "@tanstack/react-router";
import { apiURL } from "../catalog";

export const Route = createFileRoute("/media/$name")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        if (!/^[a-z0-9]{26}\.(jpg|png|webp|gif)$/.test(params.name)) return new Response("No encontrado", { status: 404 });
        const headers: Record<string, string> = {};
        for (const name of ["If-None-Match", "If-Modified-Since", "Range"]) {
          const value = request.headers.get(name);
          if (value) headers[name] = value;
        }
        const res = await fetch(apiURL("/api/media/" + params.name), { headers, signal: AbortSignal.timeout(10000) })
          .catch(() => null);
        if (!res) return new Response("No disponible", { status: 503 });
        return new Response(res.body, { status: res.status, headers: res.headers });
      },
    },
  },
});
