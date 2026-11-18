import { createFileRoute } from "@tanstack/react-router";
import { apiFetch } from "../api";

export const Route = createFileRoute("/media/$name")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const headers: Record<string, string> = {};
        for (const name of ["If-None-Match", "If-Modified-Since", "Range"]) {
          const value = request.headers.get(name);
          if (value) headers[name] = value;
        }
        const res = await apiFetch("/api/media/" + encodeURIComponent(params.name), { headers, timeout: 10000 }).catch(() => null);
        if (!res) return new Response("No disponible", { status: 503 });
        return new Response(res.body, { status: res.status, headers: res.headers });
      },
    },
  },
});
