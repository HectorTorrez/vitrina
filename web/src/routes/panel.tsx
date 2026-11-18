import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight, ArrowUpRight, CalendarDays, Check, Copy, LayoutGrid, LogOut, Menu, MessageCircle, Package, Palette, Plus, Store,
  type LucideIcon,
} from "lucide-react";
import { getPanel, type PanelShop } from "../panel";
import { PanelAgenda } from "../PanelAgenda";
import { PanelCatalog } from "../PanelCatalog";
import { SectionHead } from "../PanelForm";
import { CreateShopWizard, ProfileEditor } from "../PanelProfile";
import { formatLocal } from "../booking";
import { acceptsBookings } from "../catalog";
import { useCopied } from "@/lib/useCopied";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

type Section = "inicio" | "catalogo" | "agenda" | "tienda" | "alta";
const sections: Section[] = ["inicio", "catalogo", "agenda", "tienda", "alta"];

export const Route = createFileRoute("/panel")({
  validateSearch: (search: Record<string, unknown>): { seccion?: Section; tienda?: string } => ({
    seccion: sections.includes(search.seccion as Section) ? (search.seccion as Section) : undefined,
    tienda: typeof search.tienda === "string" ? search.tienda.slice(0, 64) : undefined,
  }),
  beforeLoad: async () => {
    const panel = await getPanel();
    if (!panel) throw redirect({ to: "/ingresar" });
    return { panel };
  },
  headers: () => ({ "Cache-Control": "private, no-store" }),
  head: () => ({ meta: [{ title: "Panel · Vitrina" }] }),
  component: Panel,
});

const nav: { value: Section; label: string; icon: LucideIcon }[] = [
  { value: "inicio", label: "Inicio", icon: LayoutGrid },
  { value: "catalogo", label: "Catálogo", icon: Package },
  { value: "agenda", label: "Agenda", icon: CalendarDays },
  { value: "tienda", label: "Mi tienda", icon: Palette },
];


function Panel() {
  const { panel } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const shop = panel.shops.find((s) => s.slug === search.tienda) ?? panel.shops[0];
  const section: Section = search.seccion === "alta" && panel.operator ? "alta"
    : shop && search.seccion && search.seccion !== "alta" ? search.seccion
    : shop ? "inicio" : "alta";
  const go = (seccion: Section) => {
    setMenuOpen(false);
    void navigate({ search: (prev) => ({ ...prev, seccion }) });
  };
  const switchShop = (tienda: string) => {
    setMenuOpen(false);
    void navigate({ search: { tienda, seccion: section === "alta" ? "inicio" : section } });
  };
  const items = [...(shop ? nav : []), ...(panel.operator ? [{ value: "alta" as const, label: "Alta de tiendas", icon: Plus }] : [])];
  const upcoming = shop?.bookings.filter((booking) => booking.editable).length ?? 0;
  const current = items.find((item) => item.value === section);

  const sidebar = (
    <div className="flex h-full min-w-0 flex-col gap-6 overflow-y-auto px-3 py-5">
      <Link to="/" className="px-3 font-display text-2xl font-bold tracking-tighter">vitrina</Link>

      {shop && (
        panel.shops.length > 1 ? (
          <Select value={shop.slug} onValueChange={switchShop}>
            <SelectTrigger aria-label="Tienda" className="h-auto w-full rounded-xl border-white/10 bg-white/5 px-3 py-2.5 text-left text-white hover:bg-white/10 [&_svg]:text-white/60!">
              <ShopBadge name={shop.name} slug={shop.slug} />
            </SelectTrigger>
            <SelectContent>
              {panel.shops.map((s) => <SelectItem key={s.slug} value={s.slug}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"><ShopBadge name={shop.name} slug={shop.slug} /></div>
        )
      )}

      <nav className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1" aria-label="Secciones">
        {items.map(({ value, label, icon: Icon }) => (
          <button
            key={value} type="button" onClick={() => go(value)} aria-current={section === value ? "page" : undefined}
            className={cn(
              "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition",
              section === value ? "bg-white/10 text-white" : "text-neutral-400 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className={cn("size-4.5", section === value && "text-brand")} />
            <span className="min-w-0 flex-1 truncate text-left">{label}</span>
            {value === "agenda" && upcoming > 0 && <span className="rounded-full bg-brand px-1.5 text-xs leading-5 font-semibold text-ink-dark">{upcoming}</span>}
            {value === "catalogo" && shop && <span className="text-xs text-neutral-500">{shop.products.length}</span>}
          </button>
        ))}
      </nav>

      <div className="mt-auto grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
        {shop && (
          <a href={"/tienda/" + shop.slug} target="_blank" rel="noreferrer"
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-3 text-sm font-semibold text-ink-dark transition hover:bg-[#ffb088]">
            Ver mi tienda <ArrowUpRight className="size-4" />
          </a>
        )}
        <div className="flex min-w-0 items-center gap-2 border-t border-white/10 px-1 pt-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-semibold uppercase">{panel.email[0]}</span>
          <span className="min-w-0 flex-1 truncate text-sm text-neutral-400" title={panel.email}>{panel.email}</span>
          <form action="/auth" method="post" className="shrink-0">
            <Button type="submit" name="action" value="logout" variant="ghost" size="icon-sm" className="rounded-full text-neutral-400 hover:bg-white/10 hover:text-white" aria-label="Cerrar sesión" title="Cerrar sesión">
              <LogOut />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-svh bg-background lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 overflow-hidden bg-ink-dark text-white lg:block">{sidebar}</aside>

      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 bg-ink-dark px-4 text-white lg:hidden">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="-ml-2 rounded-full text-white hover:bg-white/10 hover:text-white" aria-label="Abrir menú"><Menu /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 border-0 bg-ink-dark p-0 text-white [&>button:last-child]:text-neutral-400">
            <SheetTitle className="sr-only">Menú</SheetTitle>
            {sidebar}
          </SheetContent>
        </Sheet>
        <span className="font-display text-xl font-bold tracking-tighter">vitrina</span>
        {current && <span className="truncate text-sm text-neutral-400">/ {current.label}</span>}
        {shop && (
          <Button asChild size="sm" className="ml-auto rounded-full bg-brand text-ink-dark hover:bg-[#ffb088]">
            <a href={"/tienda/" + shop.slug} target="_blank" rel="noreferrer">Ver tienda <ArrowUpRight /></a>
          </Button>
        )}
      </header>

      <main className="mx-auto w-[min(100%-32px,1120px)] pt-8 pb-24 sm:pt-10">
        {section === "inicio" && shop && <Overview shop={shop} go={go} />}
        {section === "catalogo" && shop && <PanelCatalog key={shop.slug} shop={shop} />}
        {section === "agenda" && shop && <PanelAgenda key={shop.slug} shop={shop} />}
        {section === "tienda" && shop && (
          <div className="grid gap-6">
            <SectionHead label="Mi tienda" title="Perfil público" text="Nombre, apariencia, contacto y horario. Mirá los cambios en vivo antes de guardar." />
            <ProfileEditor key={shop.slug} shop={shop} />
          </div>
        )}
        {section === "alta" && (
          <div className="grid gap-6">
            <SectionHead
              label={panel.operator ? "Operador" : "Empezá"}
              title={panel.operator ? "Dar de alta una tienda" : "Abrí tu tienda"}
              text={panel.operator ? "Creá la tienda y habilitá el correo de quien la va a administrar." : "Tu cuenta todavía no tiene una tienda. Son tres pasos cortos."}
            />
            <CreateShopWizard operator={panel.operator} />
          </div>
        )}
      </main>
      <Toaster position="bottom-center" richColors />
    </div>
  );
}

function ShopBadge({ name, slug }: { name: string; slug: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand font-display text-sm font-bold text-ink-dark">{name.trim()[0]?.toUpperCase() ?? "V"}</span>
      <span className="grid min-w-0 text-left">
        <span className="truncate text-sm font-semibold">{name}</span>
        <span className="truncate font-mono text-xs text-neutral-400">/{slug}</span>
      </span>
    </span>
  );
}

function Overview({ shop, go }: { shop: PanelShop; go: (section: Section) => void }) {
  const products = shop.products;
  const published = products.filter((item) => !item.hidden);
  const upcoming = shop.bookings.filter((booking) => booking.editable);
  const hasServices = products.some((item) => item.kind === "service");
  const tasks: { done: boolean; title: string; text: string; section: Section; cta: string }[] = [
    { done: published.length > 0, title: "Publicá tu primera ficha", text: "Un producto o servicio con foto y precio.", section: "catalogo", cta: "Agregar ficha" },
    { done: Boolean(shop.description), title: "Contá de qué se trata", text: "Una descripción corta debajo del nombre.", section: "tienda", cta: "Escribir" },
    { done: Boolean(shop.whatsapp), title: "Conectá tu WhatsApp", text: "Así te escriben desde cada ficha.", section: "tienda", cta: "Agregar número" },
    ...(hasServices ? [{ done: acceptsBookings(shop), title: "Activá las reservas en línea", text: "Definí tu horario y recibí citas solas.", section: "tienda" as const, cta: "Configurar" }] : []),
  ];
  const done = tasks.filter((task) => task.done).length;

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="grid gap-2">
          <p className="font-mono text-xs font-medium tracking-[0.1em] text-brand-ink uppercase">Tu tienda</p>
          <h1 className="font-display text-4xl leading-[0.95] font-bold tracking-[-0.04em] break-words sm:text-5xl">{shop.name}</h1>
        </div>
        <ShareLink slug={shop.slug} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={Package} label="Fichas publicadas" value={published.length} hint={products.length - published.length ? (products.length - published.length) + " ocultas" : undefined} onClick={() => go("catalogo")} />
        <Stat icon={CalendarDays} label="Citas próximas" value={upcoming.length} hint={upcoming[0] ? "Próxima: " + formatLocal(upcoming[0].startsAt) : undefined} onClick={() => go("agenda")} />
        <Stat icon={MessageCircle} label="WhatsApp" value={shop.whatsapp ? "Conectado" : "Sin número"} hint={shop.whatsapp ? "+" + shop.whatsapp : "Agregalo en Mi tienda"} onClick={() => go("tienda")} />
      </div>

      {done < tasks.length && (
        <section className="grid gap-5 rounded-2xl border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid gap-1">
              <h2 className="font-display text-xl font-semibold tracking-tight">Primeros pasos</h2>
              <p className="text-sm text-muted-foreground">Completá estos pasos para que tu tienda esté lista para compartir.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{done} de {tasks.length}</span>
              <span className="h-2 w-28 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-success transition-all" style={{ width: (done / tasks.length) * 100 + "%" }} />
              </span>
            </div>
          </div>
          <ol className="grid gap-2">
            {tasks.map((task) => (
              <li key={task.title} className={cn("flex items-center gap-4 rounded-xl border p-3.5", task.done && "bg-muted/40")}>
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-full border-2", task.done ? "border-success bg-success text-white" : "border-dashed border-muted-foreground/40")}>
                  {task.done && <Check className="size-4" strokeWidth={3} />}
                </span>
                <span className="grid min-w-0 flex-1">
                  <span className={cn("font-medium", task.done && "text-muted-foreground line-through")}>{task.title}</span>
                  <span className="text-sm text-muted-foreground">{task.text}</span>
                </span>
                {!task.done && (
                  <Button variant="outline" size="sm" className="shrink-0 rounded-full" onClick={() => go(task.section)}>
                    {task.cta} <ArrowRight />
                  </Button>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <QuickLink icon={Plus} title="Nueva ficha" text="Agregá un producto o servicio." onClick={() => go("catalogo")} />
        <QuickLink icon={Store} title="Personalizar tienda" text="Tema, descripción, redes y horario." onClick={() => go("tienda")} />
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint, onClick }: { icon: LucideIcon; label: string; value: string | number; hint?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="grid gap-3 rounded-2xl border bg-card p-5 text-left transition hover:border-foreground/20 hover:shadow-sm">
      <span className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="size-4" /> {label}</span>
      <span className="font-display text-3xl font-bold tracking-tight">{value}</span>
      {hint && <span className="truncate text-xs text-muted-foreground">{hint}</span>}
    </button>
  );
}

function QuickLink({ icon: Icon, title, text, onClick }: { icon: LucideIcon; title: string; text: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex items-center gap-4 rounded-2xl border bg-card p-5 text-left transition hover:border-foreground/20">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-brand-ink"><Icon className="size-5" /></span>
      <span className="grid flex-1">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-muted-foreground">{text}</span>
      </span>
      <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
    </button>
  );
}

function ShareLink({ slug }: { slug: string }) {
  const [copied, copy] = useCopied();
  const path = "/tienda/" + slug;
  return (
    <div className="flex h-11 w-full items-center gap-1 rounded-full border bg-card pr-1 pl-4 sm:w-auto">
      <span className="min-w-0 flex-1 truncate font-mono text-sm">{path}</span>
      <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => void copy(window.location.origin + path)}>
        {copied ? <Check className="text-success" /> : <Copy />} {copied ? "Copiado" : "Copiar"}
      </Button>
      <Button asChild size="sm" className="rounded-full">
        <a href={path} target="_blank" rel="noreferrer">Abrir <ArrowUpRight /></a>
      </Button>
    </div>
  );
}
