import { useEffect, useState, type FormEvent } from "react";
import { createBooking, formatLocal, getSlots, shopToday } from "./booking";
import type { Product } from "./catalog";

export function PublicBooking({ shop, service }: { shop: string; service: Product }) {
  const [date, setDate] = useState(() => shopToday());
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotError, setSlotError] = useState("");
  const [time, setTime] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string>();

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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!time || pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const result = await createBooking({
        data: {
          shop, service: service.slug, startsAt: date + "T" + time,
          customer: String(form.get("customer") ?? ""), phone: String(form.get("phone") ?? ""),
        },
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
      <div className="booking" role="status">
        <h2>Cita reservada</h2>
        <p>{service.name} · {formatLocal(done)} ({service.durationMinutes} min).</p>
        <p>El negocio recibió tu reserva. Si necesitás cambiarla, escribiles directamente.</p>
      </div>
    );
  }

  return (
    <form className="booking" onSubmit={submit}>
      <h2>Reservar cita</h2>
      <label className="booking-date">Fecha
        <input type="date" value={date} min={shopToday()} max={shopToday(60)} required
          onChange={(event) => event.target.value && setDate(event.target.value)} />
      </label>
      <fieldset>
        <legend>Horarios disponibles · {formatLocal(date, false)}</legend>
        {slots === null && !slotError && <p>Consultando horarios…</p>}
        {slotError && <p role="alert">{slotError}</p>}
        {slots?.length === 0 && !slotError && <p>No hay horarios libres ese día. Probá con otra fecha.</p>}
        <div className="slots">
          {slots?.map((slot) => (
            <label key={slot}>
              <input type="radio" name="slot" value={slot} checked={time === slot} onChange={() => setTime(slot)} />
              {slot}
            </label>
          ))}
        </div>
      </fieldset>
      {time && (
        <fieldset disabled={pending} className="booking-contact">
          <label>Nombre<input name="customer" required maxLength={160} autoComplete="name" /></label>
          <label>WhatsApp o teléfono<input name="phone" type="tel" required placeholder="+503 7000 0000" maxLength={24} autoComplete="tel" /></label>
          <button type="submit">{pending ? "Reservando…" : "Reservar " + time}</button>
        </fieldset>
      )}
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
