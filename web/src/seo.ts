export const siteLanguage = "es-SV";
export const siteName = "Vitrina";
export const siteDescription = "Catálogo, citas en línea y WhatsApp en un solo enlace para negocios de El Salvador.";
export const noIndex = { name: "robots", content: "noindex" };

export function pageHead({ title, description, url, image, structuredData, indexable = true }: {
  title: string;
  description: string;
  url: string;
  image?: string;
  structuredData: Record<string, unknown>;
  indexable?: boolean;
}) {
  const text = Array.from(description.replace(/\s+/g, " ").trim()).slice(0, 200).join("");
  return {
    meta: [
      { title },
      { name: "description", content: text },
      indexable ? { name: "robots", content: "max-image-preview:large" } : noIndex,
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: siteName },
      { property: "og:locale", content: "es_SV" },
      { property: "og:title", content: title },
      { property: "og:description", content: text },
      { property: "og:url", content: url },
      ...(image ? [{ property: "og:image", content: image }] : []),
      { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: text },
      ...(image ? [{ name: "twitter:image", content: image }] : []),
    ],
    links: [{ rel: "canonical", href: url }],
    scripts: [{
      type: "application/ld+json",
      // Keep merchant-supplied text from closing the script while preserving valid JSON.
      children: JSON.stringify({ "@context": "https://schema.org", ...structuredData }).replace(/</g, "\\u003c"),
    }],
  };
}
