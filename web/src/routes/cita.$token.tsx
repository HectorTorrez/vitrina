import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ArrowLeft, CalendarCheck, CalendarClock, CalendarDays, CalendarPlus, CalendarX2,
  Clock, Download, Loader2, MessageCircle, UserRound,
} from "lucide-react";
import {
  buildIcsContent, cancelPublicBooking, formatLocal, getMonthShort, getPublicBooking,
  getSlots, getWeekdayShort, googleCalendarUrl, reschedulePublicBooking, shopToday,
  type PublicBookingDetail,
} from "../booking";
import { useI18n, type Locale } from "../i18n";
import { noIndex } from "../seo";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/cita/$token")({
  loader: async ({ params }) => {
    const booking = await getPublicBooking({ data: params.token });
    if (!booking) throw notFound();
    return booking;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.serviceName} · ${loaderData.shopName}` : "Mi cita · Vitrina" },
      noIndex,
    ],
  }),
  component: ManageBookingPage,
});

function dateParts(date: string, locale: Locale) {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { day: d, weekday: getWeekdayShort(locale)[weekday], month: getMonthShort(locale)[m - 1] };
}

function ManageBookingPage() {
  const initial = Route.useLoaderData();
  const { locale: appLocale } = useI18n();
  const locale: Locale = initial.shopLocale === "en" || initial.shopLocale === "es" ? initial.shopLocale : appLocale;
  const en = locale === "en";

  const [booking, setBooking] = useState<PublicBookingDetail>(initial);
  const [rescheduling, setRescheduling] = useState(false);
  const [date, setDate] = useState(() => booking.startsAt.slice(0, 10));
  const [staffId, setStaffId] = useState(booking.staffId ?? "");
  const [slots, setSlots] = useState<string[] | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [feedback, setFeedback] = useState("");
  const dateInputRef = useRef<HTMLInputElement>(null);

  function openDatePicker() {
    const input = dateInputRef.current;
    if (!input) return;
    try {
      if (typeof input.showPicker === "function") {
        input.showPicker();
        return;
      }
    } catch {
      // Fallback for browsers that restrict showPicker
    }
    input.focus();
    input.click();
  }

  const horizon = booking.horizonDays || 60;
  const days = Array.from({ length: Math.min(14, horizon + 1) }, (_, i) => shopToday(i, booking.shopTimezone));

  useEffect(() => {
    if (!rescheduling) return;
    let active = true;
    setLoadingSlots(true);
    setSelectedTime("");
    setSlotError("");
    getSlots({
      data: {
        shop: booking.shopSlug,
        service: booking.serviceSlug,
        date,
        staff: staffId || undefined,
        excludeToken: booking.token,
      },
    })
      .then((res) => {
        if (!active) return;
        setSlots(res.slots);
        setSlotError(res.error ?? "");
      })
      .catch(() => active && setSlotError(en ? "Could not load available times" : "No se pudieron consultar los horarios"))
      .finally(() => active && setLoadingSlots(false));
    return () => { active = false; };
  }, [rescheduling, booking.shopSlug, booking.serviceSlug, booking.token, date, staffId, en]);

  async function handleCancel() {
    setBusy(true);
    setActionError("");
    setFeedback("");
    try {
      const res = await cancelPublicBooking({ data: booking.token });
      if (res.ok) {
        setBooking(res.booking);
        setRescheduling(false);
        setFeedback(en ? "Your appointment has been cancelled." : "Tu cita ha sido cancelada.");
      } else {
        setActionError(res.error);
      }
    } catch {
      setActionError(en ? "Could not cancel the appointment." : "No se pudo cancelar la cita.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReschedule() {
    if (!selectedTime) return;
    setBusy(true);
    setActionError("");
    setFeedback("");
    try {
      const res = await reschedulePublicBooking({
        data: { token: booking.token, startsAt: `${date}T${selectedTime}`, staffId: staffId || undefined },
      });
      if (res.ok) {
        setBooking(res.booking);
        setRescheduling(false);
        setSelectedTime("");
        setFeedback(en ? "Your appointment has been rescheduled." : "Tu cita fue reprogramada con éxito.");
      } else {
        setActionError(res.error);
      }
    } catch {
      setActionError(en ? "Could not reschedule the appointment." : "No se pudo reprogramar la cita.");
    } finally {
      setBusy(false);
    }
  }

  const calTitle = `${booking.serviceName} · ${booking.shopName}`;
  const calDetails = [
    booking.staffName ? `${en ? "Specialist" : "Especialista"}: ${booking.staffName}` : "",
    booking.notes ?? "",
  ].filter(Boolean).join("\n") || undefined;
  const calOpts = { title: calTitle, startsAt: booking.startsAt, endsAt: booking.endsAt, details: calDetails, timeZone: booking.shopTimezone };

  const downloadIcs = () => {
    const blob = new Blob([buildIcsContent(calOpts)], { type: "text/calendar;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${booking.serviceSlug}.ics`;
    a.click();
    URL.revokeObjectURL(href);
  };

  const waHref = booking.shopWhatsapp
    ? `https://wa.me/${booking.shopWhatsapp}?text=${encodeURIComponent(
        en
          ? `Hi ${booking.shopName}, I'm reaching out about my ${booking.serviceName} appointment on ${formatLocal(booking.startsAt, true, locale)}.`
          : `Hola ${booking.shopName}, te escribo por mi cita de ${booking.serviceName} el ${formatLocal(booking.startsAt, true, locale)}.`,
      )}`
    : null;

  return (
    <div className="min-h-dvh bg-canvas px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto grid max-w-xl gap-6">
        <div className="flex items-center justify-between gap-3">
          <Link
            to="/tienda/$shop"
            params={{ shop: booking.shopSlug }}
            className="inline-flex h-9 items-center gap-1.5 rounded-full pr-3 pl-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> {booking.shopName}
          </Link>
        </div>

        <div className="grid gap-5 rounded-3xl border bg-card p-6 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="grid gap-1">
              <span className={cn(
                "inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                booking.cancelled ? "bg-destructive/10 text-destructive" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
              )}>
                {booking.cancelled ? <CalendarX2 className="size-3.5" /> : <CalendarCheck className="size-3.5" />}
                {booking.cancelled ? (en ? "Cancelled" : "Cancelada") : (en ? "Confirmed" : "Confirmada")}
              </span>
              <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">{booking.serviceName}</h1>
              <p className="text-sm text-muted-foreground">{booking.shopName}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 font-mono text-xs text-muted-foreground">
              <Clock className="size-3.5" /> {booking.durationMinutes} min
            </span>
          </div>

          <div className="grid gap-2.5 rounded-2xl bg-muted/50 p-4 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{en ? "Date & time" : "Fecha y hora"}</span>
              <span className="font-semibold capitalize">{formatLocal(booking.startsAt, true, locale)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{en ? "Time zone" : "Zona horaria"}</span>
              <span className="font-mono text-xs">{booking.shopTimezone}</span>
            </div>
            {booking.staffName && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{en ? "Specialist" : "Especialista"}</span>
                <span className="font-medium">{booking.staffName}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{en ? "Customer" : "Cliente"}</span>
              <span className="font-medium">{booking.customer}</span>
            </div>
            {booking.notes && (
              <div className="border-t pt-2.5">
                <span className="text-xs font-medium text-muted-foreground">{en ? "Notes" : "Notas"}</span>
                <p className="mt-0.5 text-sm">{booking.notes}</p>
              </div>
            )}
          </div>

          {feedback && (
            <p role="status" className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              {feedback}
            </p>
          )}
          {actionError && (
            <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
              {actionError}
            </p>
          )}

          {!booking.cancelled && (
            <div className="flex flex-wrap gap-2">
              <a
                href={googleCalendarUrl(calOpts)} target="_blank" rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition hover:bg-muted"
              >
                <CalendarPlus className="size-4" /> Google Calendar
              </a>
              <button
                type="button" onClick={downloadIcs}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition hover:bg-muted"
              >
                <Download className="size-4" /> {en ? "Download .ics" : "Descargar .ics"}
              </button>
              {waHref && (
                <a
                  href={waHref} target="_blank" rel="noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition hover:bg-muted"
                >
                  <MessageCircle className="size-4" /> WhatsApp
                </a>
              )}
            </div>
          )}

          {!booking.cancelled && (booking.canReschedule || booking.canCancel) && (
            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
              {booking.canReschedule && (
                <Button
                  type="button"
                  variant={rescheduling ? "secondary" : "default"}
                  className="rounded-full"
                  onClick={() => {
                    setRescheduling((v) => !v);
                    setActionError("");
                  }}
                >
                  <CalendarClock className="size-4" />
                  {rescheduling ? (en ? "Close reschedule" : "Cerrar reprogramación") : (en ? "Reschedule" : "Reprogramar cita")}
                </Button>
              )}
              {booking.canCancel && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="ghost" className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive">
                      <CalendarX2 className="size-4" /> {en ? "Cancel booking" : "Cancelar cita"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{en ? "Cancel this appointment?" : "¿Cancelar esta cita?"}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {en
                          ? "The time slot will be released immediately and the business will be notified."
                          : "El horario quedará libre de inmediato y avisaremos al negocio."}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{en ? "Keep booking" : "Volver"}</AlertDialogCancel>
                      <AlertDialogAction
                        disabled={busy}
                        className="bg-destructive text-white hover:bg-destructive/90"
                        onClick={() => void handleCancel()}
                      >
                        {en ? "Yes, cancel" : "Sí, cancelar"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}

          {!booking.cancelled && !booking.canCancel && (
            <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
              {booking.cancelNoticeHours > 0
                ? (en
                    ? `Online changes are available up to ${booking.cancelNoticeHours}h before the appointment. Contact ${booking.shopName} directly if you need help.`
                    : `Los cambios en línea están disponibles hasta ${booking.cancelNoticeHours}h antes de la cita. Escribile a ${booking.shopName} si necesitás ayuda.`)
                : (en ? "This appointment can no longer be modified online." : "Esta cita ya no se puede modificar en línea.")}
            </div>
          )}

          {rescheduling && booking.canReschedule && (
            <div className="grid gap-4 border-t pt-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">{en ? "Choose a new time" : "Elegí un nuevo horario"}</h2>
                <div className="relative inline-flex">
                  <button
                    type="button"
                    onClick={openDatePicker}
                    className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition hover:bg-muted"
                  >
                    <CalendarDays className="size-3.5" /> {en ? "Other date" : "Otra fecha"}
                  </button>
                  <input
                    ref={dateInputRef}
                    type="date" value={date} min={shopToday(0, booking.shopTimezone)} max={shopToday(horizon, booking.shopTimezone)}
                    tabIndex={-1}
                    aria-label={en ? "Other date" : "Otra fecha"}
                    className="pointer-events-none absolute inset-0 size-full opacity-0"
                    onChange={(e) => e.target.value && setDate(e.target.value)}
                  />
                </div>
              </div>

              {booking.eligibleStaff.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setStaffId("")}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                      staffId === "" ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
                    )}
                  >
                    <UserRound className="size-3" /> {en ? "Any available" : "Cualquiera"}
                  </button>
                  {booking.eligibleStaff.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setStaffId(m.id)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                        staffId === m.id ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
                      )}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex snap-x gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
                {(days.includes(date) ? days : [date, ...days]).map((day) => {
                  const p = dateParts(day, locale);
                  const active = day === date;
                  return (
                    <button
                      key={day} type="button" onClick={() => setDate(day)}
                      className={cn(
                        "grid w-14 shrink-0 snap-start justify-items-center gap-0.5 rounded-xl border py-2 text-xs transition",
                        active ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
                      )}
                    >
                      <span className="capitalize opacity-75">{p.weekday}</span>
                      <span className="text-base font-semibold leading-none">{p.day}</span>
                      <span className="opacity-75">{p.month}</span>
                    </button>
                  );
                })}
              </div>

              <div className="min-h-24" aria-busy={loadingSlots}>
                {slots === null && !slotError && (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                    {Array.from({ length: 10 }, (_, i) => <span key={i} className="h-9 animate-pulse rounded-xl bg-muted" />)}
                  </div>
                )}
                {slotError && <p className="text-sm text-destructive">{slotError}</p>}
                {slots !== null && !slotError && (
                  <div className={cn("transition-opacity duration-150", loadingSlots && "pointer-events-none opacity-45")}>
                    {slots.length === 0 ? (
                      <p className="rounded-xl bg-muted/60 px-3.5 py-2.5 text-sm text-muted-foreground">
                        {en ? "No open slots on this day. Try another date." : "No hay horarios libres ese día. Probá otra fecha."}
                      </p>
                    ) : (
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                        {slots.map((slot) => (
                          <button
                            key={slot} type="button" onClick={() => setSelectedTime(slot)}
                            className={cn(
                              "h-9 rounded-xl border font-mono text-sm transition",
                              selectedTime === slot ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
                            )}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {selectedTime && (
                <Button type="button" disabled={busy} className="rounded-full" onClick={() => void handleReschedule()}>
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  {en ? `Confirm new time (${selectedTime})` : `Confirmar nuevo horario (${selectedTime})`}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
