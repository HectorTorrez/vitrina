import { useEffect, useState, type FormEvent } from "react";
import { CalendarCheck, CalendarDays, Loader2 } from "lucide-react";
import { createBooking, formatLocal, getSlots, monthShort, shopToday, weekdayShort } from "./booking";
import type { Product } from "./catalog";
import { cn } from "@/lib/utils";

function parts(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { day: d, weekday: weekdayShort[weekday], month: monthShort[m - 1] };
}

function groupSlots(slots: string[]) {
  const groups = [
    { label: "Mañana", items: slots.filter((s) => s < "12:00") },
    { label: "Tarde", items: slots.filter((s) => s >= "12:00" && s < "18:00") },
    { label: "Noche", items: slots.filter((s) => s >= "18:00") },
  ];
  return groups.filter((group) => group.items.length);
}

const fieldClass = "h-12 w-full rounded-xl border border-store-rule bg-store-surface px-4 text-base text-store-ink outline-none transition placeholder:text-store-muted focus:border-store-ink aria-invalid:border-red-500";

export function PublicBooking({ shop, service }: { shop: string; service: Product }) {
  const [date, setDate] = useState(() => shopToday());
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotError, setSlotError] = useState("");
  const [time, setTime] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string>();
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const days = Array.from({ length: 14 }, (_, i) => shopToday(i));

  useEffect(() => {
    let current = true;
    setSlots(null);
    setTime("");
    setSlotError("");
    getSlots({ data: { shop, service: service.slug, date } })
      .then((result) => {
        if (!current) return;
        setSlots(result.slots);
        setSlotError(result.error ?? "");
      })
      .catch(() => current && setSlotError("No se pudo consultar la agenda"));
    return () => { current = false; };
  }, [shop, service.slug, date]);

  const nameError = customer.trim().length < 2 ? "Escribí tu nombre." : null;
  const phoneError = phone.replace(/\D/g, "").length < 8 ? "Escribí un número de al menos 8 dígitos." : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!time || pending) return;
    if (nameError || phoneError) {
      setShowErrors(true);
      return;
    }
    setPending(true);
    setError("");
    try {
      const result = await createBooking({
        data: { shop, service: service.slug, startsAt: date + "T" + time, customer: customer.trim(), phone: phone.trim() },
      });
      if (result.ok) setDone(result.startsAt);
      else {
        setError(result.error);
        const fresh = await getSlots({ data: { shop, service: service.slug, date } });
        setSlots(fresh.slots);
        if (!fresh.slots.includes(time)) setTime("");
      }
    } catch {
      setError("No se pudo reservar. Intentá de nuevo.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="grid gap-3 rounded-3xl border border-store-rule bg-store-surface p-6" role="status">
        <span className="grid size-12 place-items-center rounded-full bg-green-100 text-green-700"><CalendarCheck className="size-6" /></span>
        <h2 className="font-store text-2xl">¡Cita reservada!</h2>
        <p className="font-semibold">{service.name} · {formatLocal(done)} ({service.durationMinutes} min)</p>
        <p className="text-store-muted">El negocio recibió tu reserva. Si necesitás cambiarla, escribiles directamente.</p>
      </div>
    );
  }

  return (
    <form className="grid gap-5 rounded-3xl border border-store-rule bg-store-surface p-5 @3xl:p-6" onSubmit={submit} noValidate>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-store text-2xl">Reservar cita</h2>
        <label className="relative inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-store-rule px-3 text-sm font-medium hover:border-store-ink">
          <CalendarDays className="size-4" /> Otra fecha
          <input
            type="date" value={date} min={shopToday()} max={shopToday(60)} aria-label="Elegir otra fecha"
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={(event) => event.target.value && setDate(event.target.value)}
          />
        </label>
      </div>

      <div className="-mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] @3xl:-mx-6 @3xl:px-6" role="radiogroup" aria-label="Fecha">
        {(days.includes(date) ? days : [date, ...days]).map((day) => {
          const { day: number, weekday, month } = parts(day);
          const active = day === date;
          return (
            <button
              key={day} type="button" role="radio" aria-checked={active} onClick={() => setDate(day)}
              className={cn(
                "grid w-16 shrink-0 snap-start justify-items-center gap-0.5 rounded-2xl border py-2.5 transition",
                active ? "border-store-accent bg-store-accent text-store-accent-ink" : "border-store-rule hover:border-store-ink",
              )}
            >
              <span className="text-xs capitalize opacity-75">{day === shopToday() ? "hoy" : weekday}</span>
              <span className="text-xl leading-none font-semibold">{number}</span>
              <span className="text-xs opacity-75">{month}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-3" aria-live="polite">
        <p className="text-sm font-medium capitalize">{formatLocal(date, false)}</p>
        {slots === null && !slotError && (
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 8 }, (_, i) => <span key={i} className="h-10 animate-pulse rounded-xl bg-store-soft" />)}
          </div>
        )}
        {slotError && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{slotError}</p>}
        {slots?.length === 0 && !slotError && (
          <p className="rounded-xl bg-store-soft px-4 py-3 text-sm">No hay horarios libres ese día. Probá con otra fecha.</p>
        )}
        {slots && groupSlots(slots).map((group) => (
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
        ))}
      </div>

      {time && (
        <fieldset disabled={pending} className="grid gap-3 border-t border-store-rule pt-5">
          <legend className="sr-only">Tus datos</legend>
          <div className="grid gap-1.5">
            <label htmlFor="booking-name" className="text-sm font-medium">Nombre</label>
            <input id="booking-name" value={customer} onChange={(e) => setCustomer(e.target.value)} maxLength={160} autoComplete="name"
              placeholder="¿A nombre de quién?" className={fieldClass} aria-invalid={showErrors && nameError ? true : undefined} />
            {showErrors && nameError && <p className="text-sm text-red-600">{nameError}</p>}
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="booking-phone" className="text-sm font-medium">WhatsApp o teléfono</label>
            <input id="booking-phone" value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" maxLength={24} autoComplete="tel"
              placeholder="+503 7000 0000" className={fieldClass} aria-invalid={showErrors && phoneError ? true : undefined} />
            {showErrors && phoneError && <p className="text-sm text-red-600">{phoneError}</p>}
          </div>
          <button type="submit" className="mt-1 flex h-13 items-center justify-center gap-2 rounded-full bg-store-accent px-6 font-semibold text-store-accent-ink transition hover:opacity-90 disabled:opacity-60">
            {pending && <Loader2 className="size-4 animate-spin" />}
            {pending ? "Reservando…" : `Reservar a las ${time}`}
          </button>
        </fieldset>
      )}
      {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </form>
  );
}
