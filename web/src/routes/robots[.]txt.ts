import { createFileRoute } from "@tanstack/react-router";
import { siteOrigin } from "../api";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () => new Response(
        ["User-agent: *", "Disallow: /auth", "Disallow: /gestion", "Disallow: /subir", "",
          "Sitemap: " + siteOrigin() + "/sitemap.xml", ""].join("\n"),
        { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" } },
      ),
    },
  },
});
