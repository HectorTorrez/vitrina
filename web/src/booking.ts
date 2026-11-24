import { createServerFn } from "@tanstack/react-start";
import { apiFetch } from "./api";
import type { StaffMember } from "./catalog";
import { isSlug } from "./slug";

export const getSlots = createServerFn({ method: "GET" })
  .validator((input: { shop: string; service: string; date: string; staff?: string; excludeToken?: string }) => input)
  .handler(async ({ data }): Promise<{ slots: string[]; error?: string }> => {
    if (!isSlug(data.shop) || !isSlug(data.service) || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
      return { slots: [], error: "Fecha inválida" };
    }
    const query = new URLSearchParams({ service: data.service, date: data.date });
    if (data.staff) query.set("staff", data.staff);
    if (data.excludeToken) query.set("excludeToken", data.excludeToken);
    const res = await apiFetch("/api/shops/" + data.shop + "/slots?" + query).catch(() => null);
    if (!res) return { slots: [], error: "No se pudo consultar la agenda" };
    if (!res.ok) return { slots: [], error: (await res.text()).trim() || "No se pudo consultar la agenda" };
    return res.json();
  });

export interface BookingRequest {
  shop: string;
  service: string;
  staffId?: string;
  startsAt: string;
  customer: string;
  phone: string;
  email?: string;
  notes?: string;
}

export const createBooking = createServerFn({ method: "POST" })
  .validator((input: BookingRequest) => input)
  .handler(async ({ data }): Promise<{ ok: true; startsAt: string; endsAt: string; staffName?: string; manageToken?: string } | { ok: false; error: string }> => {
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
    return {
      ok: true,
      startsAt: result.startsAt,
      endsAt: result.endsAt,
      staffName: result.staffName || undefined,
      manageToken: result.manageToken || undefined,
    };
  });

export interface PublicBookingDetail {
  token: string;
  shopSlug: string;
  shopName: string;
  shopTheme: string;
  shopTimezone: string;
  shopLocale: "" | "es" | "en";
  shopWhatsapp: string;
  serviceSlug: string;
  serviceName: string;
  durationMinutes: number;
  staffId?: string;
  staffName?: string;
  eligibleStaff: StaffMember[];
  customer: string;
  phone: string;
  email?: string;
  notes?: string;
  startsAt: string;
  endsAt: string;
  cancelled: boolean;
  canCancel: boolean;
  canReschedule: boolean;
  cancelNoticeHours: number;
  horizonDays: number;
}

const tokenRe = /^[a-f0-9]{16,64}$/;

export const getPublicBooking = createServerFn({ method: "GET" })
  .validator((token: string) => token)
  .handler(async ({ data }): Promise<PublicBookingDetail | null> => {
    if (!tokenRe.test(data)) return null;
    const res = await apiFetch("/api/bookings/" + data).catch(() => null);
    if (!res || res.status === 404) return null;
    if (!res.ok) throw new Error("No se pudo cargar la cita");
    return res.json();
  });

export const cancelPublicBooking = createServerFn({ method: "POST" })
  .validator((token: string) => token)
  .handler(async ({ data }): Promise<{ ok: true; booking: PublicBookingDetail } | { ok: false; error: string }> => {
    if (!tokenRe.test(data)) return { ok: false, error: "Enlace inválido" };
    const res = await apiFetch("/api/bookings/" + data + "/cancel", { method: "POST", timeout: 7000 }).catch(() => null);
    if (!res) return { ok: false, error: "No se pudo conectar con la agenda" };
    if (!res.ok) return { ok: false, error: (await res.text()).trim() || "No se pudo cancelar la cita" };
    return { ok: true, booking: await res.json() };
  });

export const reschedulePublicBooking = createServerFn({ method: "POST" })
  .validator((input: { token: string; startsAt: string; staffId?: string }) => input)
  .handler(async ({ data }): Promise<{ ok: true; booking: PublicBookingDetail } | { ok: false; error: string }> => {
    if (!tokenRe.test(data.token)) return { ok: false, error: "Enlace inválido" };
    const res = await apiFetch("/api/bookings/" + data.token + "/reschedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startsAt: data.startsAt, staffId: data.staffId || "" }),
      timeout: 7000,
    }).catch(() => null);
    if (!res) return { ok: false, error: "No se pudo conectar con la agenda" };
    if (!res.ok) return { ok: false, error: (await res.text()).trim() || "No se pudo reprogramar la cita" };
    return { ok: true, booking: await res.json() };
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
export function shopToday(offsetDays = 0, timeZone = zone) {
  const now = new Date(Date.now() + offsetDays * 86400000);
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timeZone || zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  }
}

function compactLocal(value: string) {
  return value.replace(/[-:]/g, "") + "00";
}

export function googleCalendarUrl(opts: { title: string; startsAt: string; endsAt: string; details?: string; timeZone?: string }) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates: `${compactLocal(opts.startsAt)}/${compactLocal(opts.endsAt)}`,
    ctz: opts.timeZone || zone,
    ...(opts.details ? { details: opts.details } : {}),
  });
  return "https://calendar.google.com/calendar/render?" + params.toString();
}

export function buildIcsContent(opts: { title: string; startsAt: string; endsAt: string; details?: string; timeZone?: string }) {
  const tz = opts.timeZone || zone;
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, "\\$&");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Vitrina//Booking//EN",
    "BEGIN:VEVENT",
    `DTSTART;TZID=${tz}:${compactLocal(opts.startsAt)}`,
    `DTEND;TZID=${tz}:${compactLocal(opts.endsAt)}`,
    `SUMMARY:${esc(opts.title)}`,
    ...(opts.details ? [`DESCRIPTION:${esc(opts.details)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/** Formats a shop-local "YYYY-MM-DDTHH:MM" for people, e.g. "martes 18 de febrero, 10:00". */
export function formatLocal(value: string, withTime = true, locale: "es" | "en" = "es") {
  const [date, time] = value.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const label = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-SV", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, d)));
  return withTime && time ? label + ", " + time : label;
}
