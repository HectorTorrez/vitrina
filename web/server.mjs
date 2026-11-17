// Production entry: serves the built client assets and hands everything else to TanStack Start.
import { fileURLToPath } from "node:url";
import { serve } from "srvx";
import { staticMiddleware } from "srvx/static";
import app from "./dist/server/server.js";

const client = fileURLToPath(new URL("./dist/client", import.meta.url));
const assets = staticMiddleware({ dir: client, maxAge: 31536000, immutable: true });
const publicFiles = staticMiddleware({ dir: client, maxAge: 3600 });

serve({
  port: Number(process.env.PORT || 3000),
  hostname: process.env.HOST || "127.0.0.1",
  gracefulShutdown: true,
  middleware: [
    (request, next) => {
      const { pathname } = new URL(request.url);
      if (pathname.startsWith("/assets/")) return assets(request, next);
      if (pathname.startsWith("/obras/") || pathname.startsWith("/landing/")) return publicFiles(request, next);
      return next();
    },
  ],
  fetch: (request) => app.fetch(request),
});
