import { createFileRoute } from "@tanstack/react-router";
import { configuredHomeShop, siteOrigin } from "../api";
import { fetchDirectory } from "../catalog";
import { siteDescription, siteDescriptionEn, siteName } from "../seo";

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async () => {
        const origin = siteOrigin();
        const home = configuredHomeShop();
        const shops = await fetchDirectory().catch(() => []);
        const activeShops = shops.filter((s) => s.products.length > 0).slice(0, 50);

        const lines = [
          "# " + siteName,
          "",
          "> " + siteDescription,
          "> " + siteDescriptionEn,
          "",
          "Vitrina permite a negocios locales publicar catálogos de productos y servicios con variantes, precios y reservas de citas en línea (turnos cada 15 minutos) conectadas con WhatsApp, todo en un solo enlace.",
          "",
          "Vitrina enables local businesses to publish product and service catalogs with variants, transparent pricing, and 15-minute online appointment booking connected to WhatsApp in a single shareable link.",
          "",
          "## Páginas principales / Main pages",
          "",
          ...(home
            ? ["- [Tienda de inicio](" + origin + "/tienda/" + home + "): catálogo de la tienda principal."]
            : [
                "- [Vitrina (Español)](" + origin + "/): plataforma de catálogos, citas en línea y pedidos por WhatsApp.",
                "- [Vitrina (English)](" + origin + "/en): online catalogs, appointment bookings, and WhatsApp orders.",
              ]),
          "- [Sitemap](" + origin + "/sitemap.xml): índice completo de tiendas y fichas públicas / full index of public shops and items.",
        ];

        if (activeShops.length > 0) {
          lines.push("", "## Tiendas públicas / Public shops", "");
          for (const shop of activeShops) {
            const desc = shop.description?.replace(/\s+/g, " ").trim();
            const suffix = desc ? ": " + desc : "";
            lines.push(`- [${shop.name}](${origin}/tienda/${shop.slug})${suffix}`);
          }
        }

        lines.push("");

        return new Response(lines.join("\n"), {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
