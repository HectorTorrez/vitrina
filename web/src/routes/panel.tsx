import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { createContext, useContext, useState, type ReactElement } from "react";
import { Tooltip } from "radix-ui";
import {
  ArrowRight, ArrowUpRight, CalendarDays, Check, Copy, LayoutGrid, LogOut, Menu, MessageCircle, Package, Palette, PanelLeftClose, PanelLeftOpen, Plus, Store,
  type LucideIcon,
} from "lucide-react";
import { getPanel, type PanelShop } from "../panel";
import { PanelAgenda } from "../PanelAgenda";
import { PanelCatalog } from "../PanelCatalog";
import { SectionHead } from "../PanelForm";
import { CreateShopWizard, ProfileEditor } from "../PanelProfile";
import { formatLocal } from "../booking";
import { acceptsBookings } from "../catalog";
import { LanguageSwitcher, useI18n } from "../i18n";
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

const CompactSidebar = createContext(false);

function SidebarTip({ label, children }: { label: string; children: ReactElement }) {
  const compact = useContext(CompactSidebar);
  if (!compact) return children;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
          <Tooltip.Content side="right" sideOffset={10} collisionPadding={8}
            className="z-50 max-w-xs rounded-md bg-ink-dark px-3 py-1.5 text-sm text-white shadow-md">
            {label}
            <Tooltip.Arrow className="fill-ink-dark" />
          </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function Panel() {
  const { panel } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
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
  const localizedNav: { value: Section; label: string; icon: LucideIcon }[] = [
    { value: "inicio", label: t("panel.nav.home"), icon: LayoutGrid },
    { value: "catalogo", label: t("panel.nav.catalog"), icon: Package },
    { value: "agenda", label: t("panel.nav.agenda"), icon: CalendarDays },
    { value: "tienda", label: t("panel.nav.shop"), icon: Palette },
  ];
  const items = [...(shop ? localizedNav : []), ...(panel.operator ? [{ value: "alta" as const, label: t("panel.nav.create"), icon: Plus }] : [])];
  const upcoming = shop?.bookings.filter((booking) => booking.editable).length ?? 0;
  const current = items.find((item) => item.value === section);

  const sidebar = (
    <div className="flex h-full min-w-0 flex-col gap-6 overflow-y-auto px-3 py-5">
      <div className="flex items-center justify-between group-data-[compact]/sidebar:justify-center">
        <Link to="/" className="px-3 font-display text-2xl font-bold tracking-tighter group-data-[compact]/sidebar:hidden">vitrina</Link>
        <Button type="button" variant="ghost" size="icon" aria-controls="panel-navigation" aria-expanded={!collapsed}
          aria-label={collapsed ? t("panel.expandSidebar") : t("panel.collapseSidebar")}
          title={collapsed ? t("panel.expandSidebar") : t("panel.collapseSidebar")}
          onClick={() => setCollapsed((value) => !value)}
          className="hidden text-neutral-400 hover:bg-white/10 hover:text-white group-data-[desktop]/sidebar:inline-flex">
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
      </div>

      {shop && (
        panel.shops.length > 1 ? (
          <Select value={shop.slug} onValueChange={switchShop}>
            <SidebarTip label={shop.name}>
              <SelectTrigger aria-label={shop.name} className="group-data-[compact]/sidebar:justify-center group-data-[compact]/sidebar:px-0 group-data-[compact]/sidebar:[&>svg]:hidden h-auto w-full rounded-xl border-white/10 bg-white/5 px-3 py-2.5 text-left text-white hover:bg-white/10 [&_svg]:text-white/60!">
                <ShopBadge name={shop.name} slug={shop.slug} logoUrl={shop.logoUrl} />
              </SelectTrigger>
            </SidebarTip>
            <SelectContent>
              {panel.shops.map((s) => <SelectItem key={s.slug} value={s.slug}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <div title={shop.name} className="group-data-[compact]/sidebar:flex group-data-[compact]/sidebar:justify-center group-data-[compact]/sidebar:px-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"><ShopBadge name={shop.name} slug={shop.slug} logoUrl={shop.logoUrl} /></div>
        )
      )}

      <nav className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1" aria-label="Sections">
        {items.map(({ value, label, icon: Icon }) => (
          <SidebarTip key={value} label={label}>
            <button
              type="button" onClick={() => go(value)} aria-current={section === value ? "page" : undefined}
              className={cn(
                "group-data-[compact]/sidebar:justify-center group-data-[compact]/sidebar:px-0 flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition",
                section === value ? "bg-white/10 text-white" : "text-neutral-400 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className={cn("size-4.5", section === value && "text-brand")} />
              <span className="min-w-0 flex-1 truncate text-left group-data-[compact]/sidebar:sr-only">{label}</span>
              {value === "agenda" && upcoming > 0 && <span className="group-data-[compact]/sidebar:sr-only rounded-full bg-brand px-1.5 text-xs leading-5 font-semibold text-ink-dark">{upcoming}</span>}
              {value === "catalogo" && shop && <span className="group-data-[compact]/sidebar:sr-only text-xs text-neutral-500">{shop.products.length}</span>}
            </button>
          </SidebarTip>
        ))}
      </nav>

      <div className="mt-auto grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
        <div className="flex justify-center group-data-[compact]/sidebar:justify-center">
          <LanguageSwitcher variant="dark" className="w-full justify-center group-data-[compact]/sidebar:w-auto" />
        </div>
        {shop && (
          <SidebarTip label={t("panel.viewShop")}>
            <a href={"/tienda/" + shop.slug} target="_blank" rel="noreferrer"
              className="flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-3 text-sm font-semibold text-ink-dark transition hover:bg-[#ffb088]">
              <span className="group-data-[compact]/sidebar:sr-only">{t("panel.viewShop")}</span> <ArrowUpRight className="size-4" />
            </a>
          </SidebarTip>
        )}
        <PanelAccount email={panel.email} className="border-t border-white/10 px-1 pt-3" />
      </div>
    </div>
  );

  return (
    <div className={cn("min-h-svh bg-background", section !== "alta" && (collapsed ? "lg:pl-18" : "lg:pl-64"))}>
      {section === "alta" ? (
        <header className="bg-ink-dark text-white">
          <div className="mx-auto flex h-14 w-[min(100%-32px,1120px)] items-center gap-4">
            <Link to="/" className="shrink-0 font-display text-xl font-bold tracking-tighter">vitrina</Link>
            {shop && (
              <Button variant="ghost" size="sm" onClick={() => go("inicio")} className="shrink-0 text-white hover:bg-white/10 hover:text-white">
                Volver al panel
              </Button>
            )}
            <PanelAccount email={panel.email} className="ml-auto max-w-72" />
          </div>
        </header>
      ) : (
        <>
          <aside data-desktop="" id="panel-navigation" data-compact={collapsed ? "" : undefined} className={cn("group/sidebar fixed inset-y-0 left-0 z-40 hidden overflow-hidden bg-ink-dark text-white lg:block", collapsed ? "w-18" : "w-64")}>
            <Tooltip.Provider delayDuration={150}>
              <CompactSidebar.Provider value={collapsed}>{sidebar}</CompactSidebar.Provider>
            </Tooltip.Provider>
          </aside>

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
        </>
      )}

      <main className="mx-auto w-[min(100%-32px,1120px)] pt-8 pb-24 sm:pt-10">
        {section === "inicio" && shop && <Overview shop={shop} go={go} />}
        {section === "catalogo" && shop && <PanelCatalog key={shop.slug} shop={shop} />}
        {section === "agenda" && shop && <PanelAgenda key={shop.slug} shop={shop} />}
        {section === "tienda" && shop && (
          <div className="grid gap-6">
            <SectionHead label={t("profile.sectionLabel")} title={t("profile.sectionTitle")} text={t("profile.sectionText")} />
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

function PanelAccount({ email, className }: { email: string; className: string }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2 group-data-[compact]/sidebar:flex-col", className)}>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-semibold uppercase">{email[0]}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-neutral-400 group-data-[compact]/sidebar:sr-only" title={email}>{email}</span>
      <form action="/auth" method="post" className="shrink-0">
        <SidebarTip label="Cerrar sesión">
          <Button type="submit" name="action" value="logout" variant="ghost" size="icon-sm" className="rounded-full text-neutral-400 hover:bg-white/10 hover:text-white" aria-label="Cerrar sesión">
            <LogOut />
          </Button>
        </SidebarTip>
      </form>
    </div>
  );
}

function ShopBadge({ name, slug, logoUrl }: { name: string; slug: string; logoUrl?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {logoUrl
        ? <img src={logoUrl} alt="" className="size-8 shrink-0 rounded-lg object-cover" />
        : <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand font-display text-sm font-bold text-ink-dark">{name.trim()[0]?.toUpperCase() ?? "V"}</span>}
      <span className="grid min-w-0 text-left group-data-[compact]/sidebar:sr-only">
        <span className="truncate text-sm font-semibold">{name}</span>
        <span className="truncate font-mono text-xs text-neutral-400">/{slug}</span>
      </span>
    </span>
  );
}

function Overview({ shop, go }: { shop: PanelShop; go: (section: Section) => void }) {
  const { locale, t } = useI18n();
  const products = shop.products;
  const published = products.filter((item) => !item.hidden);
  const upcoming = shop.bookings.filter((booking) => booking.editable);
  const hasServices = products.some((item) => item.kind === "service");
  const tasks: { done: boolean; title: string; text: string; section: Section; cta: string }[] = [
    { done: published.length > 0, title: t("panel.overview.task1.title"), text: t("panel.overview.task1.text"), section: "catalogo", cta: t("panel.overview.task1.cta") },
    { done: Boolean(shop.description), title: t("panel.overview.task2.title"), text: t("panel.overview.task2.text"), section: "tienda", cta: t("panel.overview.task2.cta") },
    { done: Boolean(shop.whatsapp), title: t("panel.overview.task3.title"), text: t("panel.overview.task3.text"), section: "tienda", cta: t("panel.overview.task3.cta") },
    ...(hasServices ? [{ done: acceptsBookings(shop), title: t("panel.overview.task4.title"), text: t("panel.overview.task4.text"), section: "tienda" as const, cta: t("panel.overview.task4.cta") }] : []),
  ];
  const done = tasks.filter((task) => task.done).length;

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="grid gap-2">
          <p className="font-mono text-xs font-medium tracking-[0.1em] text-brand-ink uppercase">{t("panel.overview.eyebrow")}</p>
          <h1 className="font-display text-4xl leading-[0.95] font-bold tracking-[-0.04em] break-words sm:text-5xl">{shop.name}</h1>
        </div>
        <ShareLink slug={shop.slug} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={Package} label={t("panel.overview.published")} value={published.length} hint={products.length - published.length ? (products.length - published.length) + " " + t("panel.overview.hiddenCount") : undefined} onClick={() => go("catalogo")} />
        <Stat icon={CalendarDays} label={t("panel.overview.upcoming")} value={upcoming.length} hint={upcoming[0] ? t("panel.overview.next") + " " + formatLocal(upcoming[0].startsAt, true, locale) : undefined} onClick={() => go("agenda")} />
        <Stat icon={MessageCircle} label="WhatsApp" value={shop.whatsapp ? t("panel.overview.connected") : t("panel.overview.noNumber")} hint={shop.whatsapp ? "+" + shop.whatsapp : t("panel.overview.addInShop")} onClick={() => go("tienda")} />
      </div>

      {done < tasks.length && (
        <section className="grid gap-5 rounded-2xl border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid gap-1">
              <h2 className="font-display text-xl font-semibold tracking-tight">{t("panel.overview.firstSteps")}</h2>
              <p className="text-sm text-muted-foreground">{t("panel.overview.firstStepsDesc")}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{done} {t("panel.overview.of")} {tasks.length}</span>
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
        <QuickLink icon={Plus} title={t("panel.overview.newItem")} text={t("panel.overview.newItemDesc")} onClick={() => go("catalogo")} />
        <QuickLink icon={Store} title={t("panel.overview.customize")} text={t("panel.overview.customizeDesc")} onClick={() => go("tienda")} />
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
  const { t } = useI18n();
  const path = "/tienda/" + slug;
  return (
    <div className="flex h-11 w-full items-center gap-1 rounded-full border bg-card pr-1 pl-4 sm:w-auto">
      <span className="min-w-0 flex-1 truncate font-mono text-sm">{path}</span>
      <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => void copy(window.location.origin + path)}>
        {copied ? <Check className="text-success" /> : <Copy />} {copied ? t("common.copied") : t("common.copy")}
      </Button>
      <Button asChild size="sm" className="rounded-full">
        <a href={path} target="_blank" rel="noreferrer">{t("common.open")} <ArrowUpRight /></a>
      </Button>
    </div>
  );
}
