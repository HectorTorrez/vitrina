import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";
import { queryOptions } from "@tanstack/react-query";
export interface Product {
  kind: "product" | "service";
  durationMinutes: number;
  slug: string;
  name: string;
  priceCents: number;
  available: boolean;
  artwork: string;
  imageUrl?: string;
  position: number;
  hidden: boolean;
  options: { name: string; values: string[] }[];
}
export interface Shop {
  name: string;
  description: string;
  theme: string;
  instagram: string;
  tiktok: string;
  whatsapp: string;
  products: Product[];
  /** Public origin of the site, added by the web server for absolute share links. */
  origin: string;
}
export interface DirectoryEntry {
  slug: string;
  name: string;
  description: string;
  theme: string;
  products: string[];
}
export function apiURL(path: string) {
  return (process.env.VITRINA_API_URL || "http://127.0.0.1:8080") + path;
}
export function siteOrigin() {
  return (process.env.VITRINA_WEB_ORIGIN || "http://127.0.0.1:5173").replace(/\/$/, "");
}
export async function fetchDirectory(): Promise<DirectoryEntry[]> {
  const res = await fetch(apiURL("/api/shops"), { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error("No se pudieron consultar las tiendas");
  return res.json();
}
const fetchShop = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data }): Promise<Shop> => {
    if (!/^[a-z0-9-]+$/.test(data)) throw notFound();
    const res = await fetch(apiURL("/api/shops/" + encodeURIComponent(data)), {
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 404) throw notFound();
    if (!res.ok) throw new Error("No se pudo consultar la tienda");
    return { ...(await res.json()), origin: siteOrigin() };
  });
export const shopQuery = (slug: string) =>
  queryOptions({
    queryKey: ["shop", slug],
    queryFn: () => fetchShop({ data: slug }),
  });
const usd = new Intl.NumberFormat("es-SV", {
  style: "currency",
  currency: "USD",
});
export const price = (cents: number) => usd.format(cents / 100);

export function productImage(product: Product) {
  if (product.imageUrl) return product.imageUrl;
  if (product.artwork) return "/obras/" + encodeURIComponent(product.artwork) + ".svg";
}

export function shareMeta({ title, description, url, image }: {
  title: string;
  description: string;
  url: string;
  image?: string;
}) {
  const text = description.slice(0, 200);
  return {
    meta: [
      { title },
      { name: "description", content: text },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Vitrina" },
      { property: "og:locale", content: "es_SV" },
      { property: "og:title", content: title },
      { property: "og:description", content: text },
      { property: "og:url", content: url },
      ...(image ? [{ property: "og:image", content: image }] : []),
      { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}
