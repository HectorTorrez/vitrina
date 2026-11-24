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
  category?: string;
  badge?: "" | "new" | "popular" | "sale";
  priceCents: number;
  compareAtCents?: number;
  available: boolean;
  artwork: string;
  imageUrl?: string;
  /** Extra photos shown after imageUrl on the product page. */
  gallery?: string[];
  position: number;
  hidden: boolean;
  options: { name: string; values: string[]; prices?: number[] }[];
}
export interface ShopStyle {
  font?: "" | "fraunces" | "bricolage" | "playfair" | "dm-sans" | "space-grotesk";
  bgColor?: string;
  surfaceColor?: string;
  inkColor?: string;
  radius?: "" | "sharp" | "soft" | "pill";
  buttonStyle?: "" | "solid" | "outline" | "soft";
  heroLayout?: "" | "left" | "center" | "compact";
  catalogLayout?: "" | "grid" | "list";
  cardAspect?: "" | "4/5" | "1/1" | "4/3";
  veilOpacity?: number;
  announcement?: string;
}

export interface Shop {
  slug: string;
  name: string;
  description: string;
  theme: string;
  accentColor?: string;
  locale?: "" | "es" | "en";
  timezone?: string;
  currency?: string;
  style?: ShopStyle;
  logoUrl?: string;
  backgroundUrl?: string;
  instagram: string;
  tiktok: string;
  facebook?: string;
  website?: string;
  address?: string;
  mapUrl?: string;
  whatsapp: string;
  /** Seven entries, Sunday first; empty when online booking is off. */
  hours: { open: string; close: string }[];
  blockedDates?: string[];
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

const formatters = new Map<string, Intl.NumberFormat>();
export const price = (cents: number, locale: "es" | "en" = "es", currency = "USD") => {
  const code = currency || "USD";
  const key = `${locale}:${code}`;
  let fmt = formatters.get(key);
  if (!fmt) {
    try {
      fmt = new Intl.NumberFormat(locale === "en" ? "en-US" : "es-SV", { style: "currency", currency: code });
    } catch {
      fmt = new Intl.NumberFormat(locale === "en" ? "en-US" : "es-SV", { style: "currency", currency: "USD" });
    }
    formatters.set(key, fmt);
  }
  return fmt.format(cents / 100);
};

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
