import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarCheck, CalendarDays, CalendarPlus, Check, Copy, Download, ExternalLink, Loader2, UserRound } from "lucide-react";
import { buildIcsContent, createBooking, formatLocal, getMonthShort, getSlots, getWeekdayShort, googleCalendarUrl, shopToday } from "./booking";
import type { Product, StaffMember } from "./catalog";
import { useI18n, type Locale } from "./i18n";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { useCopied } from "@/lib/useCopied";

function parts(date: string, locale: Locale) {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { day: d, weekday: getWeekdayShort(locale)[weekday], month: getMonthShort(locale)[m - 1] };
}

function groupSlots(slots: string[], t: (key: "booking.morning" | "booking.afternoon" | "booking.evening") => string) {
  const groups = [
    { label: t("booking.morning"), items: slots.filter((s) => s < "12:00") },
    { label: t("booking.afternoon"), items: slots.filter((s) => s >= "12:00" && s < "18:00") },
    { label: t("booking.evening"), items: slots.filter((s) => s >= "18:00") },
  ];
  return groups.filter((group) => group.items.length);
}

const fieldClass = "h-12 w-full rounded-xl border border-store-rule bg-store-surface px-4 text-base text-store-ink outline-none transition placeholder:text-store-muted focus:border-store-ink aria-invalid:border-red-500";
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function PublicBooking({
  shop,
  shopName,
  timeZone,
  horizonDays,
  staff,
  service,
}: {
  shop: string;
  shopName?: string;
  timeZone?: string;
  horizonDays?: number;
  staff?: StaffMember[];
  service: Product;
}) {
  const { locale, t } = useI18n();
  const en = locale === "en";
  const [copied, copy] = useCopied(2000);
  const horizon = horizonDays && horizonDays > 0 ? horizonDays : 60;
  const eligibleStaff = useMemo(
    () => (staff ?? []).filter((m) => m.active && (!m.serviceSlugs?.length || m.serviceSlugs.includes(service.slug))),
    [staff, service.slug],
  );

  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState(() => shopToday(0, timeZone));
  const [slots, setSlots] = useState<string[] | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [slotError, setSlotError] = useState("");
  const [time, setTime] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ startsAt: string; endsAt: string; staffName?: string; manageToken?: string }>();
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const days = Array.from({ length: Math.min(14, horizon + 1) }, (_, i) => shopToday(i, timeZone));

  useEffect(() => {
    if (staffId && !eligibleStaff.some((m) => m.id === staffId)) {
      setStaffId("");
    }
  }, [eligibleStaff, staffId]);

  useEffect(() => {
    let current = true;
    setLoadingSlots(true);
    setTime("");
    setSlotError("");
    getSlots({ data: { shop, service: service.slug, date, staff: staffId || undefined } })
      .then((result) => {
        if (!current) return;
        setSlots(result.slots);
        setSlotError(result.error ?? "");
      })
      .catch(() => current && setSlotError(t("booking.errLoad")))
      .finally(() => current && setLoadingSlots(false));
    return () => { current = false; };
  }, [shop, service.slug, date, staffId]);

  const nameError = customer.trim().length < 2 ? t("booking.nameError") : null;
  const phoneError = phone.replace(/\D/g, "").length < 8 ? t("booking.phoneError") : null;
  const emailTrim = email.trim();
  const emailError = emailTrim && !emailRe.test(emailTrim)
    ? (en ? "Please enter a valid email address." : "Escribí un correo electrónico válido.")
    : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!time || pending) return;
    if (nameError || phoneError || emailError) {
      setShowErrors(true);
      return;
    }
    setPending(true);
    setError("");
    try {
      const result = await createBooking({
        data: {
          shop,
          service: service.slug,
          staffId: staffId || undefined,
          startsAt: date + "T" + time,
          customer: customer.trim(),
          phone: phone.trim(),
          email: emailTrim || undefined,
          notes: notes.trim() || undefined,
        },
      });
      if (result.ok) {
        setDone({
          startsAt: result.startsAt,
          endsAt: result.endsAt,
          staffName: result.staffName,
          manageToken: result.manageToken,
        });
      } else {
        setError(result.error);
        const fresh = await getSlots({ data: { shop, service: service.slug, date, staff: staffId || undefined } });
        setSlots(fresh.slots);
        if (!fresh.slots.includes(time)) setTime("");
      }
    } catch {
      setError(t("booking.errSubmit"));
    } finally {
      setPending(false);
    }
  }

  if (done) {
    const calTitle = `${service.name}${shopName ? " · " + shopName : ""}`;
    const calDetails = [
      done.staffName ? `${en ? "Specialist" : "Especialista"}: ${done.staffName}` : "",
      notes.trim(),
    ].filter(Boolean).join("\n") || undefined;
    const calOpts = { title: calTitle, startsAt: done.startsAt, endsAt: done.endsAt, details: calDetails, timeZone };
    const downloadIcs = () => {
      const blob = new Blob([buildIcsContent(calOpts)], { type: "text/calendar;charset=utf-8" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${service.slug}.ics`;
      a.click();
      URL.revokeObjectURL(href);
    };
    const managePath = done.manageToken ? `/cita/${done.manageToken}` : "";
    const manageFullUrl = managePath && typeof window !== "undefined" ? window.location.origin + managePath : managePath;
    return (
      <div className="grid gap-4 rounded-3xl border border-store-rule bg-store-surface p-6" role="status">
        <span className="grid size-12 place-items-center rounded-full bg-green-100 text-green-700"><CalendarCheck className="size-6" /></span>
        <div className="grid gap-1.5">
          <h2 className="font-store text-2xl">{t("booking.confirmedTitle")}</h2>
          <p className="font-semibold">{service.name} · {formatLocal(done.startsAt, true, locale)} ({service.durationMinutes} min)</p>
          {done.staffName && (
            <p className="text-sm font-medium text-store-muted">
              {en ? "With " : "Con "}{done.staffName}
            </p>
          )}
          <p className="text-store-muted">
            {emailTrim
              ? (en ? "We sent a confirmation to your email with your booking link." : "Te enviamos la confirmación y tu enlace de autogestión por correo.")
              : t("booking.confirmedDesc")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {done.manageToken && (
            <Link
              to="/cita/$token"
              params={{ token: done.manageToken }}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-store-accent px-4 text-sm font-semibold text-store-accent-ink transition hover:opacity-90"
            >
              <ExternalLink className="size-4" /> {en ? "Manage my booking" : "Gestionar mi cita"}
            </Link>
          )}
          {done.manageToken && (
            <button
              type="button"
              onClick={() => void copy(manageFullUrl)}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-store-rule px-4 text-sm font-medium transition hover:border-store-ink"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? (en ? "Link copied" : "Enlace copiado") : (en ? "Copy link" : "Copiar enlace")}
            </button>
          )}
          <a
            href={googleCalendarUrl(calOpts)} target="_blank" rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-full border border-store-rule px-4 text-sm font-medium transition hover:border-store-ink"
          >
            <CalendarPlus className="size-4" /> Google Calendar
          </a>
          <button
            type="button" onClick={downloadIcs}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-store-rule px-4 text-sm font-medium transition hover:border-store-ink"
          >
            <Download className="size-4" /> {en ? "Download .ics" : "Descargar .ics"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="grid gap-5 rounded-3xl border border-store-rule bg-store-surface p-5 @3xl:p-6" onSubmit={submit} noValidate>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-store text-2xl">{t("booking.title")}</h2>
        <DatePicker
          value={date}
          onChange={(d) => d && setDate(d)}
          min={shopToday(0, timeZone)}
          max={shopToday(horizon, timeZone)}
          locale={locale}
          align="end"
          trigger={
            <button
              type="button"
              aria-label={t("booking.otherDate")}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-store-rule px-3 text-sm font-medium transition hover:border-store-ink"
            >
              <CalendarDays className="size-4" /> {t("booking.otherDate")}
            </button>
          }
        />
      </div>

      {eligibleStaff.length > 0 && (
        <div className="grid gap-2">
          <p className="text-xs font-medium tracking-wide text-store-muted uppercase">
            {en ? "Specialist" : "Especialista"}
          </p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={en ? "Specialist" : "Especialista"}>
            <button
              type="button"
              role="radio"
              aria-checked={staffId === ""}
              onClick={() => setStaffId("")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition",
                staffId === "" ? "border-store-ink bg-store-ink text-store-bg" : "border-store-rule hover:border-store-ink",
              )}
            >
              <UserRound className="size-3.5" />
              {en ? "Any available" : "Cualquiera disponible"}
            </button>
            {eligibleStaff.map((member) => (
              <button
                key={member.id}
                type="button"
                role="radio"
                aria-checked={staffId === member.id}
                onClick={() => setStaffId(member.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition",
                  staffId === member.id ? "border-store-ink bg-store-ink text-store-bg" : "border-store-rule hover:border-store-ink",
                )}
              >
                <span>{member.name}</span>
                {member.role && <span className="text-xs opacity-70">· {member.role}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="-mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] @3xl:-mx-6 @3xl:px-6" role="radiogroup" aria-label="Date">
        {(days.includes(date) ? days : [date, ...days]).map((day) => {
          const { day: number, weekday, month } = parts(day, locale);
          const active = day === date;
          return (
            <button
              key={day} type="button" role="radio" aria-checked={active} onClick={() => setDate(day)}
              className={cn(
                "grid w-16 shrink-0 snap-start justify-items-center gap-0.5 rounded-2xl border py-2.5 transition",
                active ? "border-store-accent bg-store-accent text-store-accent-ink" : "border-store-rule hover:border-store-ink",
              )}
            >
              <span className="text-xs capitalize opacity-75">{day === shopToday(0, timeZone) ? t("booking.today") : weekday}</span>
              <span className="text-xl leading-none font-semibold">{number}</span>
              <span className="text-xs opacity-75">{month}</span>
            </button>
          );
        })}
      </div>

      <div className="grid min-h-36 content-start gap-3" aria-live="polite" aria-busy={loadingSlots}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium capitalize">{formatLocal(date, false, locale)}</p>
          {loadingSlots && slots !== null && (
            <Loader2 className="size-3.5 animate-spin text-store-muted" aria-hidden="true" />
          )}
        </div>
        {slots === null && !slotError && (
          <div className="grid grid-cols-4 gap-2 @lg:grid-cols-5">
            {Array.from({ length: 10 }, (_, i) => <span key={i} className="h-10 animate-pulse rounded-xl bg-store-soft" />)}
          </div>
        )}
        {slotError && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{slotError}</p>}
        {slots !== null && !slotError && (
          <div className={cn("grid gap-3 transition-opacity duration-150", loadingSlots && "pointer-events-none opacity-45")}>
            {slots.length === 0 ? (
              <p className="rounded-xl bg-store-soft px-4 py-3 text-sm">{t("booking.noSlots")}</p>
            ) : (
              groupSlots(slots, t).map((group) => (
                <div key={group.label} className="grid gap-2">
                  <p className="text-xs font-medium tracking-wide text-store-muted uppercase">{group.label}</p>
                  <div className="grid grid-cols-4 gap-2 @lg:grid-cols-5">
                    {group.items.map((slot) => (
                      <button
                        key={slot} type="button" aria-pressed={time === slot} onClick={() => setTime(slot)}
                        className={cn(
                          "h-10 rounded-xl border font-mono text-sm transition",
                          time === slot ? "border-store-ink bg-store-ink text-store-bg" : "border-store-rule hover:border-store-ink",
                        )}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {time && (
        <fieldset disabled={pending} className="grid gap-3 border-t border-store-rule pt-5">
          <legend className="sr-only">{t("booking.nameLabel")}</legend>
          <div className="grid gap-1.5">
            <label htmlFor="booking-name" className="text-sm font-medium">{t("booking.nameLabel")}</label>
            <input id="booking-name" value={customer} onChange={(e) => setCustomer(e.target.value)} maxLength={160} autoComplete="name"
              placeholder={t("booking.namePlaceholder")} className={fieldClass} aria-invalid={showErrors && nameError ? true : undefined} />
            {showErrors && nameError && <p className="text-sm text-red-600">{nameError}</p>}
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="booking-phone" className="text-sm font-medium">{t("booking.phoneLabel")}</label>
            <input id="booking-phone" value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" maxLength={24} autoComplete="tel"
              placeholder="+503 7000 0000" className={fieldClass} aria-invalid={showErrors && phoneError ? true : undefined} />
            {showErrors && phoneError && <p className="text-sm text-red-600">{phoneError}</p>}
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="booking-email" className="text-sm font-medium">
              {en ? "Email" : "Correo electrónico"} <span className="font-normal text-store-muted">{t("common.optional")}</span>
            </label>
            <input
              id="booking-email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" maxLength={200} autoComplete="email"
              placeholder={en ? "For confirmation and reminders" : "Para recibir confirmación y recordatorios"}
              className={fieldClass} aria-invalid={showErrors && emailError ? true : undefined}
            />
            {showErrors && emailError && <p className="text-sm text-red-600">{emailError}</p>}
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="booking-notes" className="text-sm font-medium">
              {en ? "Notes" : "Notas"} <span className="font-normal text-store-muted">{t("common.optional")}</span>
            </label>
            <textarea
              id="booking-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} rows={2}
              placeholder={en ? "Preferences, allergies, or special requests" : "Preferencias, alergias o comentarios"}
              className="w-full rounded-xl border border-store-rule bg-store-surface px-4 py-3 text-base text-store-ink outline-none transition placeholder:text-store-muted focus:border-store-ink"
            />
          </div>
          <button type="submit" className="mt-1 flex h-13 items-center justify-center gap-2 rounded-full bg-store-accent px-6 font-semibold text-store-accent-ink transition hover:opacity-90 disabled:opacity-60">
            {pending && <Loader2 className="size-4 animate-spin" />}
            {pending ? t("booking.booking") : `${t("booking.submitAt")} ${time}`}
          </button>
        </fieldset>
      )}
      {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </form>
  );
}
