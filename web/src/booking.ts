import { createServerFn } from "@tanstack/react-start";
import { apiFetch } from "./api";
import { isSlug } from "./slug";

export const getSlots = createServerFn({ method: "GET" })
  .validator((input: { shop: string; service: string; date: string }) => input)
  .handler(async ({ data }): Promise<{ slots: string[]; error?: string }> => {
    if (!isSlug(data.shop) || !isSlug(data.service) || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
      return { slots: [], error: "Fecha inválida" };
    }
    const query = new URLSearchParams({ service: data.service, date: data.date });
    const res = await apiFetch("/api/shops/" + data.shop + "/slots?" + query).catch(() => null);
    if (!res) return { slots: [], error: "No se pudo consultar la agenda" };
    if (!res.ok) return { slots: [], error: (await res.text()).trim() || "No se pudo consultar la agenda" };
    return res.json();
  });

export interface BookingRequest {
  shop: string;
  service: string;
  startsAt: string;
  customer: string;
  phone: string;
}

export const createBooking = createServerFn({ method: "POST" })
  .validator((input: BookingRequest) => input)
  .handler(async ({ data }): Promise<{ ok: true; startsAt: string; endsAt: string } | { ok: false; error: string }> => {
    if (!isSlug(data.shop)) return { ok: false, error: "Tienda inválida" };
    const { shop, ...booking } = data;
    const res = await apiFetch("/api/shops/" + shop + "/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(booking),
      timeout: 7000,
    }).catch(() => null);
    if (!res) return { ok: false, error: "No se pudo conectar con la agenda. Intentá de nuevo." };
    if (res.status === 404) return { ok: false, error: "Este servicio ya no admite reservas." };
    if (!res.ok) return { ok: false, error: (await res.text()).trim() || "No se pudo reservar" };
    const result = await res.json();
    return { ok: true, startsAt: result.startsAt, endsAt: result.endsAt };
  });

// Same zone as shopZone in api/models.go.
const zone = "America/El_Salvador";

export const weekdayShort = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
export const monthShort = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const weekdayShortByLocale = {
  es: weekdayShort,
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
} as const;

const monthShortByLocale = {
  es: monthShort,
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
} as const;

export function getWeekdayShort(locale: "es" | "en" = "es") {
  return weekdayShortByLocale[locale];
}

export function getMonthShort(locale: "es" | "en" = "es") {
  return monthShortByLocale[locale];
}

/** Today (plus `offsetDays`) in the shop's time zone as YYYY-MM-DD. */
export function shopToday(offsetDays = 0) {
  const now = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Formats a shop-local "YYYY-MM-DDTHH:MM" for people, e.g. "martes 18 de febrero, 10:00". */
export function formatLocal(value: string, withTime = true, locale: "es" | "en" = "es") {
  const [date, time] = value.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const label = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-SV", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, d)));
  return withTime && time ? label + ", " + time : label;
}
