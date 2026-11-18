import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useId, useState } from "react";
import { ArrowUpRight, LogOut } from "lucide-react";
import { field, getPanel, type Profile } from "../panel";
import { PanelAgenda } from "../PanelAgenda";
import { PanelCatalog } from "../PanelCatalog";
import { CheckField, Field, FormSelect, PanelForm, SectionHead, slugPattern } from "../PanelForm";
import { authFonts } from "../AuthLayout";
import panelCss from "../panel.css?url";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/panel")({
  beforeLoad: async () => {
    const panel = await getPanel();
    if (!panel) throw redirect({ to: "/ingresar" });
    return { panel };
  },
  headers: () => ({ "Cache-Control": "private, no-store" }),
  head: () => ({
    meta: [{ title: "Panel · Vitrina" }],
    links: [...authFonts, { rel: "stylesheet", href: panelCss }],
  }),
  component: Panel,
});

function readProfile(form: FormData): Profile {
  return {
    name: field(form, "name"),
    description: field(form, "description"),
    theme: field(form, "theme"),
    instagram: field(form, "instagram"),
    tiktok: field(form, "tiktok"),
    whatsapp: field(form, "whatsapp"),
    hours: form.has("booking") ? weekdays.map((_, day) => form.has("open-day-" + day)
      ? { open: field(form, "open-" + day), close: field(form, "close-" + day) }
      : { open: "", close: "" }) : [],
  };
}

const weekdays = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const themes = [
  { value: "costa", label: "Costa" },
  { value: "arena", label: "Arena" },
  { value: "noche", label: "Noche" },
];

function HoursFields({ hours }: { hours?: Profile["hours"] }) {
  const [enabled, setEnabled] = useState(Boolean(hours?.some((day) => day.open)));
  const id = useId();
  return (
    <div className="grid gap-5 rounded-xl border bg-muted/40 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <Label htmlFor={id} className="font-display text-lg font-semibold tracking-tight">Reservas en línea</Label>
          <p className="text-sm text-muted-foreground">Permitir que los clientes reserven servicios en la tienda pública.</p>
        </div>
        <Switch id={id} name="booking" checked={enabled} onCheckedChange={setEnabled} />
      </div>
      {enabled && (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Horario de atención (hora de El Salvador). Las reservas se ofrecen cada 15 minutos con al menos una hora de anticipación.
          </p>
          {weekdays.map((name, day) => {
            const current = hours?.[day];
            return (
              <div key={day} className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[150px_1fr_1fr]">
                <CheckField
                  name={"open-day-" + day} label={name} className="col-span-2 sm:col-span-1 sm:pb-2.5"
                  defaultChecked={hours?.length ? Boolean(current?.open) : day > 0}
                />
                <Field label="Abre"><Input name={"open-" + day} type="time" step={900} defaultValue={current?.open || "09:00"} /></Field>
                <Field label="Cierra"><Input name={"close-" + day} type="time" step={900} defaultValue={current?.close || "18:00"} /></Field>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProfileFields({ profile }: { profile?: Profile }) {
  return (
    <>
      <Field label="Nombre"><Input name="name" defaultValue={profile?.name} required maxLength={100} /></Field>
      <Field label="Descripción"><Textarea name="description" defaultValue={profile?.description} maxLength={500} rows={3} /></Field>
      <Field label="Tema">
        <FormSelect name="theme" defaultValue={profile?.theme || "costa"} options={themes} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Usuario de Instagram"><Input name="instagram" defaultValue={profile?.instagram} maxLength={33} /></Field>
        <Field label="Usuario de TikTok"><Input name="tiktok" defaultValue={profile?.tiktok} maxLength={33} /></Field>
        <Field label="WhatsApp internacional">
          <Input name="whatsapp" type="tel" placeholder="+50370000000" defaultValue={profile?.whatsapp} maxLength={16} />
        </Field>
      </div>
      <HoursFields hours={profile?.hours} />
    </>
  );
}

function SlugInput() {
  return <Input name="shopSlug" required maxLength={64} placeholder="mi-tienda" pattern={slugPattern} className="font-mono" />;
}

function Panel() {
  const { panel } = Route.useRouteContext();
  const [selected, setSelected] = useState("");
  const shop = panel.shops.find((s) => s.slug === selected) ?? panel.shops[0];
  const upcoming = shop?.bookings?.filter((booking) => booking.editable).length ?? 0;
  const firstTab = shop ? "tienda" : "alta";
  const tabCount = (shop ? 3 : 0) + (panel.operator ? 1 : 0);

  return (
    <div className="min-h-svh bg-background font-sans text-foreground antialiased">
      <header className="max-w-none bg-ink-dark text-white">
        <div className="mx-auto flex w-[min(100%-32px,960px)] items-center gap-4 py-4">
          <Link to="/" className="font-display text-2xl font-bold tracking-tighter text-white no-underline">vitrina</Link>
          {panel.shops.length > 1 && (
            <Select value={shop?.slug} onValueChange={setSelected}>
              <SelectTrigger aria-label="Tienda" className="h-9 w-auto max-w-48 rounded-full border-white/20 bg-white/5 text-white hover:bg-white/10 [&_svg]:text-white/60!">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {panel.shops.map((s) => <SelectItem key={s.slug} value={s.slug}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <div className="ml-auto flex min-w-0 items-center gap-4">
            <span className="hidden truncate text-sm text-neutral-400 sm:block">{panel.email}</span>
            <form action="/auth" method="post">
              <Button
                type="submit" name="action" value="logout" variant="outline" size="sm"
                className="rounded-full border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <LogOut /> Cerrar sesión
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-[min(100%-32px,960px)] pb-24">
        <div className="flex flex-wrap items-end justify-between gap-6 pt-14 pb-8">
          <div className="min-w-0">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.1em] text-brand-ink">
              {panel.operator ? "Panel de operador" : "Panel de vendedor"}
            </p>
            <h1 className="mt-3.5 font-display text-5xl font-bold leading-[0.95] tracking-[-0.045em] break-words sm:text-6xl">
              {shop?.name ?? (panel.operator ? "Tiendas" : "Abrí tu tienda")}
            </h1>
            {shop && (
              <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                <span className="font-mono text-foreground">/tienda/{shop.slug}</span>
                <span>{shop.products?.length ?? 0} {shop.products?.length === 1 ? "ficha" : "fichas"}</span>
                <span>{upcoming} {upcoming === 1 ? "cita próxima" : "citas próximas"}</span>
              </p>
            )}
          </div>
          {shop && (
            <Button asChild size="lg" className="w-full rounded-full bg-brand px-6 text-ink-dark hover:bg-[#ffb088] sm:w-auto">
              <Link to="/tienda/$shop" params={{ shop: shop.slug }}>Ver tienda pública <ArrowUpRight /></Link>
            </Button>
          )}
        </div>

        <Tabs key={shop?.slug ?? "none"} defaultValue={firstTab} className="gap-6">
          {tabCount > 1 && (
            <TabsList className="h-11 max-w-full justify-start overflow-x-auto rounded-full border bg-card p-1">
              {shop && (
                <>
                  <TabsTrigger value="tienda" className="rounded-full px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none">Tienda</TabsTrigger>
                  <TabsTrigger value="catalogo" className="rounded-full px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none">Catálogo</TabsTrigger>
                  <TabsTrigger value="agenda" className="rounded-full px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none">Agenda</TabsTrigger>
                </>
              )}
              {panel.operator && <TabsTrigger value="alta" className="rounded-full px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none">Alta de tiendas</TabsTrigger>}
            </TabsList>
          )}

          {shop && (
            <>
              <TabsContent value="tienda">
                <Card className="rounded-2xl">
                  <SectionHead label="Tienda" title="Perfil público" text="Lo que ven tus clientes al abrir tu enlace." />
                  <CardContent>
                    <PanelForm submit="Guardar tienda" payload={(form) => ({
                      action: "editar-tienda", shopSlug: shop.slug, profile: readProfile(form),
                    })}>
                      <ProfileFields profile={shop} />
                    </PanelForm>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="catalogo"><PanelCatalog shop={shop} /></TabsContent>
              <TabsContent value="agenda"><PanelAgenda shop={shop} /></TabsContent>
            </>
          )}

          {!shop && !panel.operator && (
            <Card className="rounded-2xl">
              <SectionHead label="Empezá" title="Abrí tu tienda" text="Tu cuenta todavía no tiene una tienda. Elegí su nombre y su enlace para empezar." />
              <CardContent>
                <PanelForm submit="Crear tienda" payload={(form) => ({
                  action: "crear-tienda", shopSlug: field(form, "shopSlug"), profile: readProfile(form),
                })}>
                  <Field label="Enlace público" hint="Solo minúsculas, números y guiones."><SlugInput /></Field>
                  <ProfileFields />
                </PanelForm>
              </CardContent>
            </Card>
          )}

          {panel.operator && (
            <TabsContent value="alta">
              <Card className="rounded-2xl">
                <SectionHead label="Operador" title="Dar de alta una tienda" text="Creá la tienda y habilitá el correo de quien la va a administrar." />
                <CardContent>
                  <PanelForm submit="Crear tienda y habilitar vendedor" success="Tienda creada" clear payload={(form) => ({
                    action: "crear-tienda", shopSlug: field(form, "shopSlug"),
                    email: field(form, "email"), profile: readProfile(form),
                  })}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Enlace público" hint="Solo minúsculas, números y guiones."><SlugInput /></Field>
                      <Field label="Correo del vendedor"><Input name="email" type="email" required maxLength={254} /></Field>
                    </div>
                    <ProfileFields />
                  </PanelForm>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>
      <Toaster position="bottom-center" richColors />
    </div>
  );
}
