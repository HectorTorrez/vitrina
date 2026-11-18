import { useState } from "react";
import { History, MessageCircle, Plus, X } from "lucide-react";
import type { Product } from "./catalog";
import { formatLocal } from "./booking";
import { Row } from "./PanelCatalog";
import { Field, FormSelect, PanelForm, SectionHead, usePanelAction } from "./PanelForm";
import { field, type Booking, type PanelShop } from "./panel";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";

const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function PanelAgenda({ shop }: { shop: PanelShop }) {
  const [adding, setAdding] = useState(false);
  const services = (shop.products ?? []).filter((item) => item.kind === "service");
  const bookable = services.filter((item) => item.available && !item.hidden);
  const upcoming = (shop.bookings ?? []).filter((booking) => booking.editable);
  const history = (shop.bookings ?? []).filter((booking) => !booking.editable).reverse();
  const serviceName = (slug: string) => services.find((item) => item.slug === slug)?.name;

  return (
    <Card className="rounded-2xl">
      <SectionHead label="Agenda" title="Citas" text="Horarios de El Salvador." />
      <CardContent className="grid gap-4">
        {bookable.length > 0 ? (
          <Collapsible open={adding} onOpenChange={setAdding} className="rounded-xl border">
            <CollapsibleTrigger asChild>
              <button type="button" className="flex w-full items-center gap-3 px-4 py-3.5 text-left font-semibold">
                <span className="grid size-7 place-items-center rounded-full bg-accent text-accent-foreground">
                  <Plus className={"size-4 transition-transform " + (adding ? "rotate-45" : "")} />
                </span>
                Agendar cita
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t px-4 py-5">
              <BookingForm shopSlug={shop.slug} services={bookable} onSaved={() => setAdding(false)} />
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
            Publicá un servicio disponible para agendar nuevas citas.
          </p>
        )}

        <h3 className="mt-3 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Próximas citas</h3>
        {upcoming.length === 0 && (
          <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">No hay citas próximas.</p>
        )}
        <div className="divide-y">
          {upcoming.map((booking) => {
            const name = serviceName(booking.serviceSlug);
            return (
              <Row key={booking.id} summary={
                <>
                  <span className="grid size-13 shrink-0 place-items-center content-center rounded-xl bg-ink-dark font-mono text-[11px] uppercase leading-none text-white">
                    <b className="font-display text-xl leading-none">{booking.startsAt.slice(8, 10)}</b>
                    {months[Number(booking.startsAt.slice(5, 7)) - 1]}
                  </span>
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate font-semibold">{booking.customer}</span>
                    <span className="truncate text-sm text-muted-foreground">
                      {booking.startsAt.slice(11, 16)}–{booking.endsAt.slice(11, 16)} · {name ?? booking.serviceSlug}
                    </span>
                  </span>
                  {booking.source === "web" && <Badge className="bg-accent text-accent-foreground">En línea</Badge>}
                </>
              }>
                {booking.phone && (
                  <Button asChild variant="outline" size="sm" className="justify-self-start rounded-full">
                    <a href={"https://wa.me/" + booking.phone + "?text=" + encodeURIComponent(
                      "Hola " + booking.customer + ", te escribimos de " + shop.name + " por tu cita de " +
                      (name ?? booking.serviceSlug) + " el " + formatLocal(booking.startsAt) + ".",
                    )} target="_blank" rel="noreferrer">
                      <MessageCircle /> Escribir por WhatsApp · +{booking.phone}
                    </a>
                  </Button>
                )}
                <BookingForm shopSlug={shop.slug} services={services} booking={booking} />
                <CancelBooking shopSlug={shop.slug} booking={booking} />
              </Row>
            );
          })}
        </div>

        {history.length > 0 && (
          <Collapsible className="group/history">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="justify-self-start text-muted-foreground">
                <History /> Historial ({history.length})
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-2 grid gap-2 pl-3 text-sm text-muted-foreground">
                {history.map((booking) => (
                  <li key={booking.id} className="flex flex-wrap items-center gap-2">
                    {bookingLabel(booking, serviceName(booking.serviceSlug))}
                    {booking.cancelled && <Badge variant="secondary">Cancelada</Badge>}
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

function CancelBooking({ shopSlug, booking }: { shopSlug: string; booking: Booking }) {
  const { run, pending } = usePanelAction();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="justify-self-start text-destructive hover:bg-destructive/10 hover:text-destructive">
          <X /> Cancelar cita
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Cancelar la cita de {booking.customer}?</AlertDialogTitle>
          <AlertDialogDescription>El horario volverá a quedar libre.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Volver</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={() => void run({ action: "cancelar", shopSlug, booking: { id: booking.id } }, "Cita cancelada")}
          >
            Cancelar cita
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function bookingLabel(booking: Booking, service?: string) {
  return formatLocal(booking.startsAt) + "–" + booking.endsAt.slice(11) +
    " · " + (service ?? booking.serviceSlug) + " · " + booking.customer +
    (booking.source === "web" ? " · Reserva en línea" : "");
}

function BookingForm({ shopSlug, services, booking, onSaved }: {
  shopSlug: string;
  services: Product[];
  booking?: Booking;
  onSaved?: () => void;
}) {
  const options = services
    .filter((item) => item.slug === booking?.serviceSlug || (item.available && !item.hidden))
    .map((item) => ({ value: item.slug, label: item.name }));
  return (
    <PanelForm
      submit={booking ? "Guardar cambios de la cita" : "Confirmar cita"}
      success={booking ? "Cita actualizada" : "Cita agendada"}
      clear={!booking}
      onSaved={onSaved}
      payload={(form) => ({
        action: booking ? "reprogramar" : "agendar",
        shopSlug,
        booking: {
          id: booking?.id ?? 0,
          serviceSlug: field(form, "serviceSlug"),
          customer: field(form, "customer"),
          phone: field(form, "phone"),
          startsAt: field(form, "startsAt"),
        },
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Servicio">
          <FormSelect name="serviceSlug" defaultValue={booking?.serviceSlug} placeholder="Elegí un servicio" required options={options} />
        </Field>
        <Field label="Cliente"><Input name="customer" defaultValue={booking?.customer} required maxLength={160} /></Field>
        <Field label="Teléfono (opcional)">
          <Input name="phone" type="tel" defaultValue={booking?.phone ? "+" + booking.phone : ""} placeholder="+50370000000" maxLength={24} />
        </Field>
        <Field label="Fecha y hora"><Input name="startsAt" type="datetime-local" defaultValue={booking?.startsAt} required /></Field>
      </div>
    </PanelForm>
  );
}
