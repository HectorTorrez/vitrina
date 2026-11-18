import { useEffect, useState } from "react";
import { createServerFn } from "@tanstack/react-start";
import { apiFetch } from "./api";
import { cleanSlugInput, isSlug, slugError, slugify } from "./slug";

/** Whether a public shop already uses this link. Pending sign-ups are checked again by the API. */
const checkShopSlug = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data }): Promise<"free" | "taken" | "unknown"> => {
    if (!isSlug(data)) return "unknown";
    const res = await apiFetch("/api/shops/" + data, { timeout: 4000 }).catch(() => null);
    if (!res) return "unknown";
    if (res.status === 404) return "free";
    return res.ok ? "taken" : "unknown";
  });

export type ShopSlugStatus = "idle" | "checking" | "free" | "taken" | "unknown";

function useShopSlugStatus(slug: string, enabled: boolean) {
  const [status, setStatus] = useState<ShopSlugStatus>("idle");
  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }
    let current = true;
    setStatus("checking");
    const timer = setTimeout(() => {
      checkShopSlug({ data: slug })
        .then((result) => current && setStatus(result))
        .catch(() => current && setStatus("unknown"));
    }, 400);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [slug, enabled]);
  return status;
}

export function useShopSlugField(initial = "") {
  const [slug, setSlug] = useState(initial);
  const [edited, setEdited] = useState(Boolean(initial));
  const invalid = slugError(slug);
  const status = useShopSlugStatus(slug, !invalid);
  return {
    slug,
    status,
    error: invalid ?? (status === "taken" ? "Ese enlace ya lo usa otra tienda." : null),
    followName: (name: string) => !edited && setSlug(slugify(name)),
    type: (value: string) => {
      setSlug(cleanSlugInput(value));
      setEdited(true);
    },
    trim: () => setSlug((current) => current.replace(/-+$/, "")),
    choose: (value: string) => {
      setSlug(value);
      setEdited(true);
    },
    canSuggest: (name: string) => edited && Boolean(name) && slugify(name) !== slug,
    suggest: (name: string) => {
      setSlug(slugify(name));
      setEdited(false);
    },
    reset: () => {
      setSlug("");
      setEdited(false);
    },
  };
}
