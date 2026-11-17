import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import type { Shop } from "./catalog";

export type Profile = Omit<Shop, "products">;
export interface Booking {
  id: number;
  serviceSlug: string;
  customer: string;
  startsAt: string;
  endsAt: string;
  cancelled: boolean;
  editable: boolean;
}

export type PanelShop = Shop & { slug: string; bookings: Booking[] | null };
export interface PanelAccess {
  email: string;
  operator: boolean;
  shops: PanelShop[];
}

export const getPanel = createServerFn({ method: "GET" }).handler(async (): Promise<PanelAccess | null> => {
  setResponseHeader("Cache-Control", "private, no-store");
  const { panelRequest } = await import("./panel.server");
  const response = await panelRequest(getRequest(), "GET");
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("No se pudo cargar el panel");
  return response.json();
});

export function field(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}
