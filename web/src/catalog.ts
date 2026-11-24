import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";
import { queryOptions } from "@tanstack/react-query";
import { apiFetch, siteOrigin } from "./api";
import { isSlug } from "./slug";

export interface Product {
  kind: "product" | "service";
  durationMinutes: number;
  slug: string;
  name: string;
  description?: string;
  priceCents: number;
  available: boolean;
  artwork: string;
  imageUrl?: string;
  /** Extra photos shown after imageUrl on the product page. */
  gallery?: string[];
  position: number;
  hidden: boolean;
  options: { name: string; values: string[]; prices?: number[] }[];
}
export interface Shop {
  slug: string;
  name: string;
  description: string;
  theme: string;
  accentColor?: string;
  locale?: "" | "es" | "en";
  logoUrl?: string;
  backgroundUrl?: string;
  instagram: string;
  tiktok: string;
  whatsapp: string;
  /** Seven entries, Sunday first; empty when online booking is off. */
  hours: { open: string; close: string }[];
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

export async function fetchDirectory(): Promise<DirectoryEntry[]> {
  const res = await apiFetch("/api/shops");
  if (!res.ok) throw new Error("No se pudieron consultar las tiendas");
  return res.json();
}

const fetchShop = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data }): Promise<Shop> => {
    if (!isSlug(data)) throw notFound();
    const res = await apiFetch("/api/shops/" + data);
    if (res.status === 404) throw notFound();
    if (!res.ok) throw new Error("No se pudo consultar la tienda");
    return { ...(await res.json()), origin: siteOrigin() };
  });

export const shopQuery = (slug: string) =>
  queryOptions({
    queryKey: ["shop", slug],
    queryFn: () => fetchShop({ data: slug }),
  });

export function acceptsBookings(shop: Pick<Shop, "hours">) {
  return shop.hours.some((day) => day.open);
}

const usdEs = new Intl.NumberFormat("es-SV", {
  style: "currency",
  currency: "USD",
});
const usdEn = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
export const price = (cents: number, locale: "es" | "en" = "es") => (locale === "en" ? usdEn : usdEs).format(cents / 100);

export function totalPrice(product: Product, choices: Record<string, string> = {}) {
  return product.options.reduce((total, option) => {
    const index = Math.max(0, option.values.indexOf(choices[option.name] ?? option.values[0]));
    return total + (option.prices?.[index] ?? 0);
  }, product.priceCents);
}

export function hasSurcharges(product: Product) {
  return product.options.some((option) => option.prices?.some((cents) => cents > 0));
}

/** Every photo of a product, main photo first. */
export function productImages(product: Product) {
  const main = productImage(product);
  return [...(main ? [main] : []), ...(product.gallery ?? [])];
}

export function productImage(product: Product) {
  if (product.imageUrl) return product.imageUrl;
  if (product.artwork) return "/obras/" + encodeURIComponent(product.artwork) + ".svg";
}
