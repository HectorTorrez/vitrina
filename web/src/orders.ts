import { createServerFn } from "@tanstack/react-start";
import { apiFetch } from "./api";
import { isSlug } from "./slug";

export interface OrderItem {
  slug: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  choices?: Record<string, string>;
}

export type OrderStatus = "new" | "confirmed" | "delivered" | "cancelled";

export interface PanelOrder {
  id: number;
  code: string;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  items: OrderItem[];
  subtotalCents: number;
  deliveryMethod: "" | "pickup" | "delivery";
  deliveryFeeCents: number;
  deliveryAddress: string;
  paymentMethod: string;
  couponCode: string;
  discountCents: number;
  totalCents: number;
  notes: string;
  stockDeducted: boolean;
  createdAt: string;
  localCreatedAt: string;
  localMonth: string;
}

export interface ShopCoupon {
  id: number;
  code: string;
  kind: "percent" | "fixed";
  value: number;
  minOrderCents: number;
  expiresDate: string;
  active: boolean;
  uses: number;
  createdAt: string;
}

export interface CouponValidationResult {
  code: string;
  kind: "percent" | "fixed";
  value: number;
  discountCents: number;
  minOrderCents: number;
}

export const validateCoupon = createServerFn({ method: "POST" })
  .validator((input: { shop: string; code: string; subtotalCents: number }) => input)
  .handler(async ({ data }): Promise<{ ok: true; coupon: CouponValidationResult } | { ok: false; error: string }> => {
    if (!isSlug(data.shop)) return { ok: false, error: "Tienda inválida" };
    const res = await apiFetch("/api/shops/" + data.shop + "/coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: data.code, subtotalCents: data.subtotalCents }),
      timeout: 5000,
    }).catch(() => null);
    if (!res) return { ok: false, error: "No se pudo validar el cupón" };
    if (!res.ok) return { ok: false, error: (await res.text()).trim() || "Cupón inválido" };
    return { ok: true, coupon: await res.json() };
  });

export interface CreateOrderRequest {
  shop: string;
  customerName?: string;
  customerPhone?: string;
  deliveryMethod?: "" | "pickup" | "delivery";
  deliveryAddress?: string;
  paymentMethod?: string;
  couponCode?: string;
  notes?: string;
  items: { slug: string; quantity: number; choices?: Record<string, string> }[];
}

export interface CreateOrderResponse {
  id: number;
  code: string;
  subtotalCents: number;
  discountCents: number;
  deliveryFeeCents: number;
  totalCents: number;
}

export const createOrder = createServerFn({ method: "POST" })
  .validator((input: CreateOrderRequest) => input)
  .handler(async ({ data }): Promise<{ ok: true; order: CreateOrderResponse } | { ok: false; error: string }> => {
    if (!isSlug(data.shop)) return { ok: false, error: "Tienda inválida" };
    const { shop, ...body } = data;
    const res = await apiFetch("/api/shops/" + shop + "/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      timeout: 7000,
    }).catch(() => null);
    if (!res) return { ok: false, error: "No se pudo registrar el pedido. Intentá de nuevo." };
    if (!res.ok) return { ok: false, error: (await res.text()).trim() || "No se pudo registrar el pedido" };
    return { ok: true, order: await res.json() };
  });
