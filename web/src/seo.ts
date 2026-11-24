import type { Shop } from "./catalog";
import type { Locale } from "./i18n";

export const siteLanguage = "es-SV";
export const siteName = "Vitrina";
export const siteDescription = "Catálogo, citas en línea y WhatsApp en un solo enlace para negocios de El Salvador.";
export const siteDescriptionEn = "Online catalog, appointment bookings, and WhatsApp in a single link for local businesses.";
export const noIndex = { name: "robots", content: "noindex" };

export function siteDescriptionFor(locale: Locale) {
  return locale === "en" ? siteDescriptionEn : siteDescription;
}

export function htmlLang(locale: Locale) {
  return locale === "en" ? "en" : siteLanguage;
}

export function ogLocale(locale: Locale) {
  return locale === "en" ? "en_US" : "es_SV";
}

export function resolveShopLocale(locale?: "" | "es" | "en"): Locale {
  return locale === "en" ? "en" : "es";
}

const schemaDays = [
  "https://schema.org/Sunday",
  "https://schema.org/Monday",
  "https://schema.org/Tuesday",
  "https://schema.org/Wednesday",
  "https://schema.org/Thursday",
  "https://schema.org/Friday",
  "https://schema.org/Saturday",
];

function socialUrl(value: string | undefined, base?: string): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!base) return "https://" + raw.replace(/^\/+/, "");
  return base + raw.replace(/^@/, "");
}

export function shopLocalBusinessSchema(shop: Shop, url: string, description: string, image?: string) {
  const sameAs = [
    socialUrl(shop.instagram, "https://instagram.com/"),
    socialUrl(shop.tiktok, "https://tiktok.com/@"),
    socialUrl(shop.facebook, "https://facebook.com/"),
    socialUrl(shop.website),
  ].filter((v): v is string => Boolean(v));

  const openingHoursSpecification = shop.hours.flatMap((day, idx) => {
    const blocks = day.blocks?.length ? day.blocks : (day.open && day.close ? [{ open: day.open, close: day.close }] : []);
    return blocks
      .filter((b) => b.open && b.close)
      .map((b) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: schemaDays[idx],
        opens: b.open,
        closes: b.close,
      }));
  });

  const phone = shop.whatsapp?.replace(/[^\d+]/g, "");
  const logo = shop.logoUrl ? new URL(shop.logoUrl, shop.origin).href : undefined;

  return {
    "@type": "LocalBusiness",
    "@id": url + "#negocio",
    name: shop.name,
    url,
    description,
    ...(logo ? { logo } : {}),
    ...(image ? { image } : {}),
    ...(phone ? { telephone: phone.startsWith("+") ? phone : "+" + phone } : {}),
    ...(shop.address?.trim() ? { address: shop.address.trim() } : {}),
    ...(shop.mapUrl?.trim() ? { hasMap: shop.mapUrl.trim() } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(openingHoursSpecification.length ? { openingHoursSpecification } : {}),
  };
}

export function pageHead({ title, description, url, image, structuredData, indexable = true, locale = "es", alternates, alternateLocales }: {
  title: string;
  description: string;
  url: string;
  image?: string;
  structuredData: Record<string, unknown>;
  indexable?: boolean;
  locale?: Locale;
  alternates?: { hrefLang: string; href: string }[];
  alternateLocales?: Locale[];
}) {
  const text = Array.from(description.replace(/\s+/g, " ").trim()).slice(0, 200).join("");
  return {
    meta: [
      { title },
      { name: "description", content: text },
      indexable ? { name: "robots", content: "max-image-preview:large" } : noIndex,
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: siteName },
      { property: "og:locale", content: ogLocale(locale) },
      ...(alternateLocales ?? []).map((alt) => ({ property: "og:locale:alternate", content: ogLocale(alt) })),
      { property: "og:title", content: title },
      { property: "og:description", content: text },
      { property: "og:url", content: url },
      ...(image ? [{ property: "og:image", content: image }] : []),
      { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: text },
      ...(image ? [{ name: "twitter:image", content: image }] : []),
    ],
    links: [
      { rel: "canonical", href: url },
      ...(alternates ?? []).map((alt) => ({ rel: "alternate", hrefLang: alt.hrefLang, href: alt.href })),
    ],
    scripts: [{
      type: "application/ld+json",
      // Keep merchant-supplied text from closing the script while preserving valid JSON.
      children: JSON.stringify({ "@context": "https://schema.org", ...structuredData }).replace(/</g, "\\u003c"),
    }],
  };
}
