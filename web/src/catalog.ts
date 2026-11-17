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
}
const fetchShop = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data }): Promise<Shop> => {
    if (!/^[a-z0-9-]+$/.test(data)) throw notFound();
    const api = process.env.VITRINA_API_URL || "http://127.0.0.1:8080";
    const res = await fetch(api + "/api/shops/" + encodeURIComponent(data), {
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 404) throw notFound();
    if (!res.ok) throw new Error("No se pudo consultar la tienda");
    return res.json();
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
