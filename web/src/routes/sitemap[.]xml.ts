import { createFileRoute } from "@tanstack/react-router";
import { fetchDirectory, siteOrigin } from "../catalog";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const origin = siteOrigin();
        const shops = await fetchDirectory().catch(() => null);
        if (!shops) return new Response("No disponible", { status: 503 });
        const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;");
        const urls = [origin + "/", ...shops.flatMap((shop) => [
          origin + "/tienda/" + shop.slug,
          ...shop.products.map((product) => origin + "/tienda/" + shop.slug + "/" + product),
        ])];
        const body = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          urls.map((url) => "  <url><loc>" + escape(url) + "</loc></url>").join("\n") + "\n</urlset>\n";
        return new Response(body, {
          headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
