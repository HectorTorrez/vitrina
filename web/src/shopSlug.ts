import { createServerFn } from "@tanstack/react-start";
import { apiURL } from "./catalog";

/** Whether a public shop already uses this link. Pending sign-ups are checked again by the API. */
export const checkShopSlug = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data }): Promise<"free" | "taken" | "unknown"> => {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(data) || data.length > 64) return "unknown";
    const res = await fetch(apiURL("/api/shops/" + data), { signal: AbortSignal.timeout(4000) }).catch(() => null);
    if (!res) return "unknown";
    if (res.status === 404) return "free";
    return res.ok ? "taken" : "unknown";
  });

import { useEffect, useState } from "react";

/** Debounced availability of a shop link while the person types. */
export function useShopSlugStatus(slug: string, enabled = true) {
  const [status, setStatus] = useState<"idle" | "checking" | "free" | "taken" | "unknown">("idle");
  useEffect(() => {
    if (!enabled || !slug) {
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
