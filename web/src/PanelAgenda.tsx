import { useState, type ReactNode } from "react";
import { ChevronDown, History, MessageCircle, Plus, X } from "lucide-react";
import type { Product } from "./catalog";
import { formatLocal, getMonthShort } from "./booking";
import { useI18n } from "./i18n";
import { Field, FormSelect, PanelForm, SectionHead, usePanelAction } from "./PanelForm";
import { field, type Booking, type PanelShop } from "./panel";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";

export function PanelAgenda({ shop }: { shop: PanelShop }) {
  const { locale, t } = useI18n();
  const [adding, setAdding] = useState(false);
  const services = shop.products.filter((item) => item.kind === "service");
  const bookable = services.filter((item) => item.available && !item.hidden);
  const upcoming = shop.bookings.filter((booking) => booking.editable);
  const history = shop.bookings.filter((booking) => !booking.editable).reverse();
  const serviceName = (slug: string) => services.find((item) => item.slug === slug)?.name;
  const months = getMonthShort(locale);

  return (
    <div className="grid gap-6">
      <SectionHead
        label={t("panel.nav.agenda")} title={t("agenda.title")}
        text={upcoming.length ? `${upcoming.length} ${t("agenda.upcoming").toLowerCase()}` : undefined}
      />
      <div className="grid gap-4">
        {bookable.length > 0 ? (
          <Collapsible open={adding} onOpenChange={setAdding} className="rounded-2xl border bg-card">
            <CollapsibleTrigger asChild>
              <button type="button" className="flex w-full items-center gap-3 px-4 py-3.5 text-left font-semibold">
                <span className="grid size-7 place-items-center rounded-full bg-accent text-accent-foreground">
                  <Plus className={"size-4 transition-transform " + (adding ? "rotate-45" : "")} />
                </span>
                {t("agenda.schedule")}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t px-4 py-5">
              <BookingForm shopSlug={shop.slug} services={bookable} onSaved={() => setAdding(false)} />
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <p className="rounded-2xl border border-dashed bg-card p-6 text-center text-muted-foreground">
            {t("agenda.needService")}
          </p>
        )}

        <h3 className="mt-3 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{t("agenda.upcoming")}</h3>
        {upcoming.length === 0 && (
          <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-muted-foreground">{t("agenda.noUpcoming")}</p>
        )}
        {upcoming.length > 0 && <div className="divide-y overflow-hidden rounded-2xl border bg-card">
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
                  {booking.source === "web" && <Badge className="bg-accent text-accent-foreground">{t("agenda.online")}</Badge>}
                </>
              }>
                {booking.phone && (
                  <Button asChild variant="outline" size="sm" className="justify-self-start rounded-full">
                    <a href={"https://wa.me/" + booking.phone + "?text=" + encodeURIComponent(
                      "Hola " + booking.customer + ", te escribimos de " + shop.name + " por tu cita de " +
                      (name ?? booking.serviceSlug) + " el " + formatLocal(booking.startsAt, true, locale) + ".",
                    )} target="_blank" rel="noreferrer">
                      <MessageCircle /> {t("agenda.writeWa")} · +{booking.phone}
                    </a>
                  </Button>
                )}
                <BookingForm shopSlug={shop.slug} services={services} booking={booking} />
                <CancelBooking shopSlug={shop.slug} booking={booking} />
              </Row>
            );
          })}
        </div>}

        {history.length > 0 && (
          <Collapsible className="group/history">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="justify-self-start text-muted-foreground">
                <History /> {t("agenda.history")} ({history.length})
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-2 grid gap-2 pl-3 text-sm text-muted-foreground">
                {history.map((booking) => (
                  <li key={booking.id} className="flex flex-wrap items-center gap-2">
                    {bookingLabel(booking, serviceName(booking.serviceSlug), locale)}
                    {booking.cancelled && <Badge variant="secondary">{t("agenda.cancelled")}</Badge>}
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}

function Row({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  return (
    <Collapsible className="group/row">
      <CollapsibleTrigger asChild>
        <button type="button" className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-muted/50">
          {summary}
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/row:rotate-180" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="grid gap-6 border-t bg-muted/20 px-4 pt-5 pb-6">{children}</CollapsibleContent>
    </Collapsible>
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

function bookingLabel(booking: Booking, service?: string, locale: "es" | "en" = "es") {
  return formatLocal(booking.startsAt, true, locale) + "–" + booking.endsAt.slice(11) +
    " · " + (service ?? booking.serviceSlug) + " · " + booking.customer +
    (booking.source === "web" ? (locale === "en" ? " · Online" : " · Reserva en línea") : "");
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
