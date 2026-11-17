import { createFileRoute } from "@tanstack/react-router";
import { panelRequest } from "../panel.server";

export const Route = createFileRoute("/gestion")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const headers = { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" };
        const origin = new URL(process.env.VITRINA_WEB_ORIGIN || request.url).origin;
        if (request.headers.get("Origin") !== origin) {
          return new Response("Origen inválido", { status: 403, headers });
        }
        if (request.headers.get("Content-Type") !== "application/json" || !request.body) {
          return new Response("Datos inválidos", { status: 400, headers });
        }
        try {
          const reader = request.body.getReader();
          const buffer = new Uint8Array(8192);
          let length = 0;
          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              if (length + value.length > buffer.length) {
                await reader.cancel();
                return new Response("Los datos exceden el tamaño permitido", { status: 413, headers });
              }
              buffer.set(value, length);
              length += value.length;
            }
          } finally {
            reader.releaseLock();
          }
          const response = await panelRequest(request, "POST", buffer.buffer.slice(0, length));
          return new Response(response.status === 204 ? null : await response.text(), {
            status: response.status,
            headers,
          });
        } catch {
          return new Response("No se pudo conectar con el servidor", { status: 503, headers });
        }
      },
    },
  },
});
