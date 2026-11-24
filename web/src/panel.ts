import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { apiFetch } from "./api";
import type { Shop } from "./catalog";

export type Profile = Omit<Shop, "slug" | "products" | "origin">;
export interface Booking {
  id: number;
  serviceSlug: string;
  customer: string;
  phone: string;
  notes?: string;
  source: "panel" | "web";
  startsAt: string;
  endsAt: string;
  cancelled: boolean;
  editable: boolean;
}

export interface ShopAnalytics {
  views30d: number;
  productViews30d: number;
  whatsappClicks30d: number;
  topItems: { slug: string; views: number }[];
}

export type PanelShop = Omit<Shop, "origin"> & { bookings: Booking[]; analytics?: ShopAnalytics };
export interface PanelAccess {
  email: string;
  operator: boolean;
  shops: PanelShop[];
}

export const getPanel = createServerFn({ method: "GET" }).handler(async (): Promise<PanelAccess | null> => {
  setResponseHeader("Cache-Control", "private, no-store");
  const response = await apiFetch("/api/panel", { request: getRequest(), timeout: 7000 });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("No se pudo cargar el panel");
  return response.json();
});

export function field(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}
