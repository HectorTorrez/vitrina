import { createFileRoute } from "@tanstack/react-router";
import { configuredHomeShop, siteOrigin } from "../api";
import { fetchDirectory } from "../catalog";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const origin = siteOrigin();
        const shops = await fetchDirectory().catch(() => null);
        if (!shops) return new Response("No disponible", { status: 503 });
        const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
        const esUrl = escape(origin + "/");
        const enUrl = escape(origin + "/en");
        const landingAlternates = [
          `    <xhtml:link rel="alternate" hreflang="es" href="${esUrl}" />`,
          `    <xhtml:link rel="alternate" hreflang="en" href="${enUrl}" />`,
          `    <xhtml:link rel="alternate" hreflang="x-default" href="${esUrl}" />`,
        ].join("\n");

        const landingEntries = configuredHomeShop() ? [] : [
          `  <url>\n    <loc>${esUrl}</loc>\n${landingAlternates}\n  </url>`,
          `  <url>\n    <loc>${enUrl}</loc>\n${landingAlternates}\n  </url>`,
        ];

        const shopEntries = shops.flatMap((shop) => [
          origin + "/tienda/" + shop.slug,
          ...shop.products.map((product) => origin + "/tienda/" + shop.slug + "/" + product),
        ]).map((url) => `  <url><loc>${escape(url)}</loc></url>`);

        const body =
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
          [...landingEntries, ...shopEntries].join("\n") +
          "\n</urlset>\n";
        return new Response(body, {
          headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
