import type { Product } from "./catalog";
import { formatLocal } from "./booking";
import { PanelForm } from "./PanelForm";
import { field, type Booking, type PanelShop } from "./panel";

export function PanelAgenda({ shop }: { shop: PanelShop }) {
  const services = (shop.products ?? []).filter((item) => item.kind === "service");
  const bookable = services.filter((item) => item.available && !item.hidden);
  const upcoming = (shop.bookings ?? []).filter((booking) => booking.editable);
  const history = (shop.bookings ?? []).filter((booking) => !booking.editable).reverse();

  return (
    <section className="panel-section">
      <h2>Agenda</h2>
      <p>Horarios de El Salvador.</p>
      {bookable.length > 0 ? (
        <details>
          <summary>Agendar cita</summary>
          <BookingForm shopSlug={shop.slug} services={bookable} />
        </details>
      ) : <p>Publicá un servicio disponible para agendar nuevas citas.</p>}
      <h3>Próximas citas</h3>
      {upcoming.length === 0 && <p>No hay citas próximas.</p>}
      {upcoming.map((booking) => {
        const name = services.find((item) => item.slug === booking.serviceSlug)?.name;
        return (
          <details key={booking.id}>
            <summary>{bookingLabel(booking, name)}</summary>
            {booking.phone && (
              <p>
                <a href={"https://wa.me/" + booking.phone + "?text=" + encodeURIComponent(
                  "Hola " + booking.customer + ", te escribimos de " + shop.name + " por tu cita de " +
                  (name ?? booking.serviceSlug) + " el " + formatLocal(booking.startsAt) + ".",
                )} target="_blank" rel="noreferrer">Escribir al cliente por WhatsApp ↗</a>
                {" · +" + booking.phone}
              </p>
            )}
            <BookingForm shopSlug={shop.slug} services={services} booking={booking} />
            <details className="panel-cancel">
              <summary>Cancelar cita</summary>
              <PanelForm submit="Confirmar cancelación" payload={() => ({
                action: "cancelar", shopSlug: shop.slug, booking: { id: booking.id },
              })}>
                <p>El horario volverá a quedar libre.</p>
              </PanelForm>
            </details>
          </details>
        );
      })}
      {history.length > 0 && (
        <details>
          <summary>Historial</summary>
          <ul>
            {history.map((booking) => (
              <li key={booking.id}>
                {bookingLabel(booking, services.find((item) => item.slug === booking.serviceSlug)?.name)}
                {booking.cancelled && " · Cancelada"}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function bookingLabel(booking: Booking, service?: string) {
  return formatLocal(booking.startsAt) + "–" + booking.endsAt.slice(11) +
    " · " + (service ?? booking.serviceSlug) + " · " + booking.customer +
    (booking.source === "web" ? " · Reserva en línea" : "");
}

function BookingForm({ shopSlug, services, booking }: {
  shopSlug: string;
  services: Product[];
  booking?: Booking;
}) {
  return (
    <PanelForm submit={booking ? "Guardar cambios de la cita" : "Confirmar cita"} clear={!booking} payload={(form) => ({
      action: booking ? "reprogramar" : "agendar",
      shopSlug,
      booking: {
        id: booking?.id ?? 0,
        serviceSlug: field(form, "serviceSlug"),
        customer: field(form, "customer"),
        phone: field(form, "phone"),
        startsAt: field(form, "startsAt"),
      },
    })}>
      <div className="panel-fields">
        <label>Servicio
          <select name="serviceSlug" defaultValue={booking?.serviceSlug ?? ""} required>
            <option value="">Elegí un servicio</option>
            {services.filter((item) => item.slug === booking?.serviceSlug || (item.available && !item.hidden)).map((item) => (
              <option key={item.slug} value={item.slug}>{item.name}</option>
            ))}
          </select>
        </label>
        <label>Cliente<input name="customer" defaultValue={booking?.customer} required maxLength={160} /></label>
        <label>Teléfono (opcional)<input name="phone" type="tel" defaultValue={booking?.phone ? "+" + booking.phone : ""} placeholder="+50370000000" maxLength={24} /></label>
        <label>Fecha y hora<input name="startsAt" type="datetime-local" defaultValue={booking?.startsAt} required /></label>
      </div>
    </PanelForm>
  );
}
