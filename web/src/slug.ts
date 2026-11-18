export const slugPattern = "[a-z0-9]+(-[a-z0-9]+)*";
const slugRegex = new RegExp("^" + slugPattern + "$");

/** "Luna Uñas & Spa" → "luna-unas-spa" */
export function slugify(name: string, max = 64) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/, "");
}

/** Normalizes what the person types into a link while keeping a trailing dash so they can keep typing. */
export function cleanSlugInput(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "")
    .slice(0, 64);
}

/** Why a link is not valid, or null. */
export function slugError(slug: string): string | null {
  if (!slug) return "Elegí un enlace.";
  if (slug.length > 64) return "El enlace puede tener hasta 64 caracteres.";
  if (!slugRegex.test(slug)) return "Usá solo minúsculas, números y guiones (sin guion al inicio ni al final).";
  return null;
}

/** First free variant of `base` that is not in `taken`: base, base-2, base-3… */
export function uniqueSlug(base: string, taken: Iterable<string>) {
  const used = new Set(taken);
  const root = base || "ficha";
  if (!used.has(root)) return root;
  for (let n = 2; ; n++) {
    const suffix = "-" + n;
    const candidate = root.slice(0, 64 - suffix.length).replace(/-+$/, "") + suffix;
    if (!used.has(candidate)) return candidate;
  }
}
