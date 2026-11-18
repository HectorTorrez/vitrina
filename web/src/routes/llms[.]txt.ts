import { createFileRoute } from "@tanstack/react-router";
import { configuredHomeShop, siteOrigin } from "../api";
import { siteDescription, siteName } from "../seo";

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: () => {
        const origin = siteOrigin();
        const home = configuredHomeShop();
        return new Response([
          "# " + siteName,
          "",
          "> " + siteDescription,
          "",
          "Las tiendas publican fichas de productos y servicios con precios en dólares estadounidenses. Cada negocio indica sus opciones de contacto y reserva.",
          "",
          "## Páginas públicas",
          "",
          home
            ? "- [Tienda de inicio](" + origin + "/tienda/" + home + "): catálogo de la tienda que abre al entrar."
            : "- [Vitrina](" + origin + "/): cómo funcionan los catálogos, las citas y los pedidos por WhatsApp.",
          "- [Mapa del sitio](" + origin + "/sitemap.xml): enlaces a las tiendas y fichas públicas.",
          "",
        ].join("\n"), {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
