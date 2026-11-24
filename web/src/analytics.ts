import { createServerFn } from "@tanstack/react-start";
import { apiFetch } from "./api";
import { isSlug } from "./slug";

export type ShopEventType = "shop_view" | "product_view" | "whatsapp_click";

export const recordShopEvent = createServerFn({ method: "POST" })
  .validator((input: { shop: string; type: ShopEventType; target?: string }) => input)
  .handler(async ({ data }): Promise<void> => {
    if (!isSlug(data.shop)) return;
    if (data.target && !isSlug(data.target)) return;
    await apiFetch("/api/shops/" + data.shop + "/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: data.type, target: data.target ?? "" }),
      timeout: 3000,
    }).catch(() => undefined);
  });

export function trackEvent(shop: string, type: ShopEventType, target?: string) {
  void recordShopEvent({ data: { shop, type, target } }).catch(() => undefined);
}
