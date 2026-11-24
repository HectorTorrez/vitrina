import { useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Columns3, Copy,
  History, List, Mail, MessageCircle, Plus, UserRound, X,
} from "lucide-react";
import type { Product, StaffMember } from "./catalog";
import { formatLocal, getMonthShort, getWeekdayShort, shopToday } from "./booking";
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
import { DatePicker, DateTimePicker } from "@/components/ui/date-picker";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCopied } from "@/lib/useCopied";

type AgendaView = "list" | "day" | "week";

function shiftDate(isoDate: string, deltaDays: number) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

function weekStartMonday(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  return shiftDate(isoDate, offset);
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

const staffColors = [
  "border-l-sky-500 bg-sky-500/10 text-sky-950 dark:text-sky-100",
  "border-l-violet-500 bg-violet-500/10 text-violet-950 dark:text-violet-100",
  "border-l-emerald-500 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100",
  "border-l-amber-500 bg-amber-500/10 text-amber-950 dark:text-amber-100",
  "border-l-rose-500 bg-rose-500/10 text-rose-950 dark:text-rose-100",
];

export function PanelAgenda({ shop }: { shop: PanelShop }) {
  const { locale, t } = useI18n();
  const en = locale === "en";
  const [view, setView] = useState<AgendaView>("list");
  const [adding, setAdding] = useState(false);
  const [prefillStartsAt, setPrefillStartsAt] = useState<string | undefined>();
  const [prefillStaffId, setPrefillStaffId] = useState<string | undefined>();
  const [selectedStaff, setSelectedStaff] = useState<string>("all");
  const [focusDate, setFocusDate] = useState(() => shopToday(0, shop.timezone));
  const [inspectBooking, setInspectBooking] = useState<Booking | null>(null);

  const services = shop.products.filter((item) => item.kind === "service");
  const bookable = services.filter((item) => item.available && !item.hidden);
  const staff = shop.staff ?? [];
  const activeStaff = staff.filter((m) => m.active);
  const serviceName = (slug: string) => services.find((item) => item.slug === slug)?.name;
  const months = getMonthShort(locale);

  const filteredBookings = useMemo(
    () => selectedStaff === "all" ? shop.bookings : shop.bookings.filter((b) => (b.staffId || "") === selectedStaff),
    [shop.bookings, selectedStaff],
  );
  const upcoming = filteredBookings.filter((booking) => booking.editable);
  const history = filteredBookings.filter((booking) => !booking.editable).reverse();

  const staffColor = (staffId?: string) => {
    if (!staffId) return "border-l-accent bg-accent/15 text-foreground";
    const idx = staff.findIndex((m) => m.id === staffId);
    return staffColors[(idx >= 0 ? idx : 0) % staffColors.length];
  };

  const quickSchedule = (dateTime: string, staffId?: string) => {
    setPrefillStartsAt(dateTime);
    setPrefillStaffId(staffId);
    setAdding(true);
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHead
          label={t("panel.nav.agenda")} title={t("agenda.title")}
          text={upcoming.length ? `${upcoming.length} ${t("agenda.upcoming").toLowerCase()}` : undefined}
        />
        <div className="inline-flex rounded-full border bg-card p-1">
          {([
            { id: "list", label: en ? "List" : "Lista", icon: List },
            { id: "day", label: en ? "Day" : "Día", icon: CalendarDays },
            { id: "week", label: en ? "Week" : "Semana", icon: Columns3 },
          ] as const).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition",
                  view === tab.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" /> {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {staff.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedStaff("all")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
              selectedStaff === "all" ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            <UserRound className="size-3" /> {en ? "All specialists" : "Todos"}
          </button>
          {staff.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedStaff(m.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
                selectedStaff === m.id ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {m.name}
            </button>
          ))}
        </div>
      )}

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
              <BookingForm
                key={`${prefillStartsAt ?? ""}-${prefillStaffId ?? ""}`}
                shopSlug={shop.slug}
                services={bookable}
                staff={staff}
                defaultStartsAt={prefillStartsAt}
                defaultStaffId={prefillStaffId}
                onSaved={() => {
                  setAdding(false);
                  setPrefillStartsAt(undefined);
                  setPrefillStaffId(undefined);
                }}
              />
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <p className="rounded-2xl border border-dashed bg-card p-6 text-center text-muted-foreground">
            {t("agenda.needService")}
          </p>
        )}

        {view === "day" && (
          <DayCalendarView
            shop={shop}
            date={focusDate}
            onDateChange={setFocusDate}
            bookings={filteredBookings.filter((b) => !b.cancelled && b.startsAt.startsWith(focusDate))}
            columns={selectedStaff === "all" && activeStaff.length > 1 ? activeStaff : null}
            serviceName={serviceName}
            staffColor={staffColor}
            onSelectBooking={setInspectBooking}
            onClickEmptySlot={bookable.length > 0 ? quickSchedule : undefined}
          />
        )}

        {view === "week" && (
          <WeekCalendarView
            shop={shop}
            focusDate={focusDate}
            onDateChange={setFocusDate}
            onOpenDay={(d) => { setFocusDate(d); setView("day"); }}
            bookings={filteredBookings.filter((b) => !b.cancelled)}
            serviceName={serviceName}
            staffColor={staffColor}
            onSelectBooking={setInspectBooking}
          />
        )}

        {view === "list" && (
          <>
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
                          {booking.staffName ? ` · ${booking.staffName}` : ""}
                        </span>
                      </span>
                      {booking.source === "web" && <Badge className="bg-accent text-accent-foreground">{t("agenda.online")}</Badge>}
                    </>
                  }>
                    <BookingDetailsPanel shop={shop} booking={booking} services={services} staff={staff} serviceName={name} />
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
          </>
        )}
      </div>

      <Sheet open={Boolean(inspectBooking)} onOpenChange={(open) => !open && setInspectBooking(null)}>
        <SheetContent className="overflow-y-auto p-6 sm:max-w-lg">
          {inspectBooking && (
            <>
              <div className="grid gap-1 pr-10">
                <SheetTitle>{inspectBooking.customer}</SheetTitle>
                <SheetDescription>
                  {formatLocal(inspectBooking.startsAt, true, locale)}–{inspectBooking.endsAt.slice(11, 16)} · {serviceName(inspectBooking.serviceSlug) ?? inspectBooking.serviceSlug}
                  {inspectBooking.staffName ? ` · ${inspectBooking.staffName}` : ""}
                </SheetDescription>
              </div>
              <div className="mt-5 grid gap-5">
                <BookingDetailsPanel
                  shop={shop}
                  booking={inspectBooking}
                  services={services}
                  staff={staff}
                  serviceName={serviceName(inspectBooking.serviceSlug)}
                  onDone={() => setInspectBooking(null)}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DayCalendarView({
  shop,
  date,
  onDateChange,
  bookings,
  columns,
  serviceName,
  staffColor,
  onSelectBooking,
  onClickEmptySlot,
}: {
  shop: PanelShop;
  date: string;
  onDateChange: (d: string) => void;
  bookings: Booking[];
  columns: StaffMember[] | null;
  serviceName: (slug: string) => string | undefined;
  staffColor: (staffId?: string) => string;
  onSelectBooking: (b: Booking) => void;
  onClickEmptySlot?: (dateTime: string, staffId?: string) => void;
}) {
  const { locale } = useI18n();
  const en = locale === "en";
  const today = shopToday(0, shop.timezone);
  const blocked = shop.blockedDates?.includes(date);

  // Determine visible hour range from shop hours & bookings.
  let startHour = 8;
  let endHour = 20;
  for (const d of shop.hours) {
    const blocks = d.blocks?.length ? d.blocks : (d.open && d.close ? [{ open: d.open, close: d.close }] : []);
    for (const b of blocks) {
      startHour = Math.min(startHour, Math.floor(toMinutes(b.open) / 60));
      endHour = Math.max(endHour, Math.ceil(toMinutes(b.close) / 60));
    }
  }
  for (const b of bookings) {
    startHour = Math.min(startHour, Math.floor(toMinutes(b.startsAt.slice(11, 16)) / 60));
    endHour = Math.max(endHour, Math.ceil(toMinutes(b.endsAt.slice(11, 16)) / 60));
  }
  startHour = Math.max(0, startHour);
  endHour = Math.min(24, Math.max(startHour + 4, endHour));
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const hourHeight = 56;

  const colDefs = columns
    ? columns.map((m) => ({ id: m.id, label: m.name, items: bookings.filter((b) => b.staffId === m.id) }))
    : [{ id: "", label: formatLocal(date, false, locale), items: bookings }];

  return (
    <div className="grid gap-3 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="outline" size="icon-sm" className="rounded-full" onClick={() => onDateChange(shiftDate(date, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => onDateChange(today)}>
            {en ? "Today" : "Hoy"}
          </Button>
          <Button type="button" variant="outline" size="icon-sm" className="rounded-full" onClick={() => onDateChange(shiftDate(date, 1))}>
            <ChevronRight className="size-4" />
          </Button>
          <span className="ml-2 text-sm font-semibold capitalize">{formatLocal(date, false, locale)}</span>
          {blocked && <Badge variant="secondary">{en ? "Blocked" : "Bloqueado"}</Badge>}
        </div>
        <DatePicker value={date} onChange={(d) => d && onDateChange(d)} locale={locale} align="end" className="h-8 w-44 text-xs" />
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[460px]">
          {columns && (
            <div className="grid border-b pb-2" style={{ gridTemplateColumns: `56px repeat(${colDefs.length}, minmax(140px, 1fr))` }}>
              <span />
              {colDefs.map((col) => (
                <div key={col.id} className="px-2 text-xs font-semibold text-foreground">{col.label}</div>
              ))}
            </div>
          )}
          <div className="relative grid" style={{ gridTemplateColumns: `56px repeat(${colDefs.length}, minmax(140px, 1fr))` }}>
            <div>
              {hours.map((h) => (
                <div key={h} style={{ height: hourHeight }} className="pr-2 pt-0.5 text-right font-mono text-[11px] text-muted-foreground">
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>
            {colDefs.map((col) => (
              <div key={col.id || "single"} className="relative border-l">
                {hours.map((h) => {
                  const hh = String(h).padStart(2, "0") + ":00";
                  return (
                    <button
                      key={h}
                      type="button"
                      style={{ height: hourHeight }}
                      onClick={() => onClickEmptySlot?.(`${date}T${hh}`, col.id || undefined)}
                      className="block w-full border-b border-dashed border-border/60 text-left transition hover:bg-muted/40"
                      title={onClickEmptySlot ? (en ? `Book at ${hh}` : `Agendar a las ${hh}`) : undefined}
                    />
                  );
                })}
                {col.items.map((b) => {
                  const topMin = toMinutes(b.startsAt.slice(11, 16)) - startHour * 60;
                  const durMin = Math.max(20, toMinutes(b.endsAt.slice(11, 16)) - toMinutes(b.startsAt.slice(11, 16)));
                  const top = (topMin / 60) * hourHeight;
                  const height = Math.max(28, (durMin / 60) * hourHeight - 2);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => onSelectBooking(b)}
                      style={{ top, height }}
                      className={cn(
                        "absolute right-1 left-1 overflow-hidden rounded-lg border-l-4 px-2 py-1 text-left shadow-xs transition hover:brightness-95",
                        staffColor(b.staffId),
                      )}
                    >
                      <div className="truncate text-xs font-semibold leading-tight">
                        {b.startsAt.slice(11, 16)} · {b.customer}
                      </div>
                      <div className="truncate text-[11px] opacity-80">
                        {serviceName(b.serviceSlug) ?? b.serviceSlug}
                        {!columns && b.staffName ? ` · ${b.staffName}` : ""}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WeekCalendarView({
  shop,
  focusDate,
  onDateChange,
  onOpenDay,
  bookings,
  serviceName,
  staffColor,
  onSelectBooking,
}: {
  shop: PanelShop;
  focusDate: string;
  onDateChange: (d: string) => void;
  onOpenDay: (d: string) => void;
  bookings: Booking[];
  serviceName: (slug: string) => string | undefined;
  staffColor: (staffId?: string) => string;
  onSelectBooking: (b: Booking) => void;
}) {
  const { locale } = useI18n();
  const en = locale === "en";
  const today = shopToday(0, shop.timezone);
  const start = weekStartMonday(focusDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => shiftDate(start, i));
  const weekdays = getWeekdayShort(locale);
  const months = getMonthShort(locale);

  return (
    <div className="grid gap-3 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="outline" size="icon-sm" className="rounded-full" onClick={() => onDateChange(shiftDate(start, -7))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => onDateChange(today)}>
            {en ? "This week" : "Esta semana"}
          </Button>
          <Button type="button" variant="outline" size="icon-sm" className="rounded-full" onClick={() => onDateChange(shiftDate(start, 7))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {start} — {weekDays[6]}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-7">
        {weekDays.map((day) => {
          const [y, m, d] = day.split("-").map(Number);
          const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
          const dayBookings = bookings.filter((b) => b.startsAt.startsWith(day));
          const blocked = shop.blockedDates?.includes(day);
          const closed = shop.hours.length === 7 && !shop.hours[dow]?.open && !shop.hours[dow]?.blocks?.length;
          const isToday = day === today;
          return (
            <div key={day} className={cn("grid content-start gap-2 rounded-xl border p-2.5 min-h-36", isToday && "border-foreground", (blocked || closed) && "bg-muted/40")}>
              <button type="button" onClick={() => onOpenDay(day)} className="flex items-baseline justify-between text-left hover:underline">
                <span className="text-xs font-medium capitalize text-muted-foreground">{weekdays[dow]}</span>
                <span className={cn("font-mono text-sm font-semibold", isToday && "rounded-full bg-foreground px-1.5 text-background")}>
                  {d} {months[m - 1]}
                </span>
              </button>
              {blocked && <span className="text-[11px] text-muted-foreground">{en ? "Blocked" : "Bloqueado"}</span>}
              {!blocked && closed && <span className="text-[11px] text-muted-foreground">{en ? "Closed" : "Cerrado"}</span>}
              <div className="grid gap-1.5">
                {dayBookings.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onSelectBooking(b)}
                    className={cn("grid rounded-lg border-l-3 px-2 py-1.5 text-left text-xs transition hover:brightness-95", staffColor(b.staffId))}
                  >
                    <span className="font-mono text-[11px] font-semibold">{b.startsAt.slice(11, 16)}</span>
                    <span className="truncate font-medium">{b.customer}</span>
                    <span className="truncate text-[11px] opacity-75">{serviceName(b.serviceSlug) ?? b.serviceSlug}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BookingDetailsPanel({
  shop,
  booking,
  services,
  staff,
  serviceName,
  onDone,
}: {
  shop: PanelShop;
  booking: Booking;
  services: Product[];
  staff: StaffMember[];
  serviceName?: string;
  onDone?: () => void;
}) {
  const { locale, t } = useI18n();
  const en = locale === "en";
  const [copied, copy] = useCopied(2000);
  const manageUrl = booking.manageToken && typeof window !== "undefined" ? `${window.location.origin}/cita/${booking.manageToken}` : "";

  return (
    <>
      {booking.notes && (
        <p className="rounded-xl border bg-card px-3.5 py-2.5 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{en ? "Notes: " : "Notas: "}</span>
          {booking.notes}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {booking.phone && (
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <a href={"https://wa.me/" + booking.phone + "?text=" + encodeURIComponent(
              "Hola " + booking.customer + ", te escribimos de " + shop.name + " por tu cita de " +
              (serviceName ?? booking.serviceSlug) + " el " + formatLocal(booking.startsAt, true, locale) + ".",
            )} target="_blank" rel="noreferrer">
              <MessageCircle /> {t("agenda.writeWa")} · +{booking.phone}
            </a>
          </Button>
        )}
        {booking.email && (
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <a href={`mailto:${booking.email}`}>
              <Mail /> {booking.email}
            </a>
          </Button>
        )}
        {booking.manageToken && (
          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => void copy(manageUrl)}>
            {copied ? <Check /> : <Copy />}
            {copied ? (en ? "Link copied" : "Enlace copiado") : (en ? "Client link" : "Enlace del cliente")}
          </Button>
        )}
      </div>
      {booking.editable && (
        <>
          <BookingForm shopSlug={shop.slug} services={services} staff={staff} booking={booking} onSaved={onDone} />
          <CancelBooking shopSlug={shop.slug} booking={booking} onCancelled={onDone} />
        </>
      )}
    </>
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

function CancelBooking({ shopSlug, booking, onCancelled }: { shopSlug: string; booking: Booking; onCancelled?: () => void }) {
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
            onClick={async () => {
              if (await run({ action: "cancelar", shopSlug, booking: { id: booking.id } }, "Cita cancelada")) {
                onCancelled?.();
              }
            }}
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
    " · " + (service ?? booking.serviceSlug) +
    (booking.staffName ? " · " + booking.staffName : "") +
    " · " + booking.customer +
    (booking.source === "web" ? (locale === "en" ? " · Online" : " · Reserva en línea") : "");
}

function BookingForm({ shopSlug, services, staff = [], booking, defaultStartsAt, defaultStaffId, onSaved }: {
  shopSlug: string;
  services: Product[];
  staff?: StaffMember[];
  booking?: Booking;
  defaultStartsAt?: string;
  defaultStaffId?: string;
  onSaved?: () => void;
}) {
  const { locale } = useI18n();
  const options = services
    .filter((item) => item.slug === booking?.serviceSlug || (item.available && !item.hidden))
    .map((item) => ({ value: item.slug, label: item.name }));
  const staffOptions = [
    { value: "__none__", label: "Sin asignar" },
    ...staff.map((m) => ({ value: m.id, label: m.role ? `${m.name} (${m.role})` : m.name })),
  ];
  return (
    <PanelForm
      submit={booking ? "Guardar cambios de la cita" : "Confirmar cita"}
      success={booking ? "Cita actualizada" : "Cita agendada"}
      clear={!booking}
      onSaved={onSaved}
      payload={(form) => {
        const rawStaff = field(form, "staffId");
        return {
          action: booking ? "reprogramar" : "agendar",
          shopSlug,
          booking: {
            id: booking?.id ?? 0,
            serviceSlug: field(form, "serviceSlug"),
            staffId: rawStaff === "__none__" ? "" : rawStaff,
            customer: field(form, "customer"),
            phone: field(form, "phone"),
            startsAt: field(form, "startsAt"),
          },
        };
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Servicio">
          <FormSelect name="serviceSlug" defaultValue={booking?.serviceSlug} placeholder="Elegí un servicio" required options={options} />
        </Field>
        <Field label="Cliente"><Input name="customer" defaultValue={booking?.customer} required maxLength={160} /></Field>
        <Field label="Teléfono (opcional)">
          <Input name="phone" type="tel" defaultValue={booking?.phone ? "+" + booking.phone : ""} placeholder="+50370000000" maxLength={24} />
        </Field>
        <Field label="Fecha y hora">
          <DateTimePicker name="startsAt" defaultValue={booking?.startsAt ?? defaultStartsAt} locale={locale} required />
        </Field>
        {staff.length > 0 && (
          <Field label="Especialista (opcional)">
            <FormSelect
              name="staffId"
              defaultValue={booking?.staffId || defaultStaffId || "__none__"}
              options={staffOptions}
            />
          </Field>
        )}
      </div>
    </PanelForm>
  );
}
