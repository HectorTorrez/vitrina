import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, Loader2, Plus, Sparkles, X } from "lucide-react";
import PhoneInput, { isPossiblePhoneNumber } from "react-phone-number-input";
import { PhoneCountrySelect } from "./PhoneCountrySelect";
import phoneLabelsEs from "react-phone-number-input/locale/es";
import phoneLabelsEn from "react-phone-number-input/locale/en";
import "react-phone-number-input/style.css";
import { acceptsBookings, type Product } from "./catalog";
import { useI18n } from "./i18n";
import type { PanelShop, Profile } from "./panel";
import { AffixInput, Field, FormSection, FormSelect, SaveBar, Stepper, usePanelAction } from "./PanelForm";
import { useShopSlugField, type ShopSlugStatus } from "./shopSlug";
import { StorefrontPreview } from "./store/StorefrontPreview";
import { emailError } from "./AuthLayout";
import { PanelImageUpload } from "./PanelImageUpload";
import { getTheme, themes } from "./themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const weekdaysByLocale = {
  es: ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};

interface Day { open: boolean; from: string; to: string }
interface ProfileDraft {
  name: string;
  description: string;
  theme: string;
  accentColor: string;
  locale: "" | "es" | "en";
  logoUrl: string;
  backgroundUrl: string;
  instagram: string;
  tiktok: string;
  whatsapp: string;
  booking: boolean;
  days: Day[];
}
type ProfileErrors = Partial<Record<"name" | "description" | "instagram" | "tiktok" | "whatsapp" | "hours", string>> & { days?: Record<number, string> };

function toDraft(profile?: Profile): ProfileDraft {
  const hours = profile?.hours ?? [];
  return {
    name: profile?.name ?? "",
    description: profile?.description ?? "",
    logoUrl: profile?.logoUrl ?? "",
    backgroundUrl: profile?.backgroundUrl ?? "",
    accentColor: profile?.accentColor ?? "",
    locale: profile?.locale ?? "",
    theme: profile?.theme || "costa",
    instagram: profile?.instagram ?? "",
    tiktok: profile?.tiktok ?? "",
    whatsapp: profile?.whatsapp ? "+" + profile.whatsapp : "",
    booking: acceptsBookings({ hours }),
    days: weekdaysByLocale.es.map((_, index) => {
      const day = hours[index];
      return {
        open: hours.length ? Boolean(day?.open) : index > 0,
        from: day?.open || "09:00",
        to: day?.close || "18:00",
      };
    }),
  };
}

/** Pulls the handle out of "@user", "instagram.com/user" or a full profile URL. */
function cleanHandle(value: string) {
  const trimmed = value.trim();
  const fromUrl = trimmed.match(/(?:instagram\.com|tiktok\.com)\/@?([^/?#\s]+)/i);
  return (fromUrl ? fromUrl[1] : trimmed).replace(/^@+/, "");
}

function fromDraft(draft: ProfileDraft): Profile {
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    theme: draft.theme,
    accentColor: draft.accentColor,
    locale: draft.locale,
    logoUrl: draft.logoUrl,
    backgroundUrl: draft.backgroundUrl,
    instagram: cleanHandle(draft.instagram),
    tiktok: cleanHandle(draft.tiktok),
    whatsapp: draft.whatsapp.replace(/^\+/, ""),
    hours: draft.booking ? draft.days.map((day) => day.open ? { open: day.from, close: day.to } : { open: "", close: "" }) : [],
  };
}

function validateProfile(draft: ProfileDraft): ProfileErrors {
  const errors: ProfileErrors = {};
  if (!draft.name.trim()) errors.name = "Escribí el nombre de tu tienda.";
  else if (draft.name.trim().length > 100) errors.name = "Usá hasta 100 caracteres.";
  if (draft.description.trim().length > 500) errors.description = "Usá hasta 500 caracteres.";
  for (const key of ["instagram", "tiktok"] as const) {
    const handle = cleanHandle(draft[key]);
    if (handle && !/^[A-Za-z0-9_.]{1,32}$/.test(handle)) errors[key] = "Solo letras, números, puntos y guiones bajos (hasta 32).";
  }
  if (draft.whatsapp && !isPossiblePhoneNumber(draft.whatsapp)) {
    errors.whatsapp = "Revisá el país y completá el número de WhatsApp.";
  }
  if (draft.booking) {
    const days: Record<number, string> = {};
    draft.days.forEach((day, index) => {
      if (day.open && (!day.from || !day.to || day.from >= day.to)) days[index] = "La apertura debe ser antes del cierre.";
    });
    if (Object.keys(days).length) errors.days = days;
    if (!draft.days.some((day) => day.open)) errors.hours = "Abrí al menos un día o desactivá las reservas en línea.";
  }
  return errors;
}

const hasErrors = (errors: ProfileErrors) => Object.keys(errors).length > 0;

type SetDraft = (patch: Partial<ProfileDraft>) => void;

function IdentityFields({ draft, set, errors }: { draft: ProfileDraft; set: SetDraft; errors: ProfileErrors }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-5">
      <Field label={t("profile.shopName")} error={errors.name} counter={{ value: draft.name.length, max: 100 }}>
        <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} maxLength={100} placeholder="Luna Uñas" className="h-10" />
      </Field>
      <Field
        label={t("profile.description")} optional error={errors.description} counter={{ value: draft.description.length, max: 500 }}
        hint={t("profile.descriptionHint")}
      >
        <Textarea value={draft.description} onChange={(e) => set({ description: e.target.value })} maxLength={500} rows={3} placeholder="Manicura y cuidado de uñas con cita previa en San Salvador." />
      </Field>
      <Field label={t("profile.storeLocale")} hint={t("profile.storeLocaleHint")}>
        <FormSelect
          value={draft.locale || "auto"}
          onValueChange={(value) => set({ locale: value === "auto" ? "" : (value as "es" | "en") })}
          options={[
            { value: "auto", label: t("profile.localeAuto") },
            { value: "es", label: t("profile.localeEs") },
            { value: "en", label: t("profile.localeEn") },
          ]}
        />
      </Field>
    </div>
  );
}

function ThemePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Tema">
      {themes.map((theme) => {
        const active = theme.value === value;
        return (
          <button
            key={theme.value} type="button" role="radio" aria-checked={active} onClick={() => onChange(theme.value)}
            className={cn(
              "group relative grid gap-2 rounded-xl border-2 p-2 text-left transition",
              active ? "border-primary" : "border-transparent bg-muted/60 hover:border-border",
            )}
          >
            <span className="relative grid h-20 gap-1.5 overflow-hidden rounded-lg p-2.5" style={{ background: theme.colors.bg, color: theme.colors.ink }}>
              <span className="flex items-center gap-1.5">
                <span className="size-4 rounded-full" style={{ background: theme.colors.accent }} />
                <span className={cn("text-sm leading-none font-medium", theme.display === "serif" ? "font-serif" : "font-display")}>Aa</span>
              </span>
              <span className="grid grid-cols-3 gap-1">
                {[0, 1, 2].map((i) => <span key={i} className="h-7 rounded" style={{ background: theme.colors.soft }} />)}
              </span>
              {active && (
                <span className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3" strokeWidth={3} />
                </span>
              )}
            </span>
            <span className="px-0.5">
              <span className="block text-sm font-semibold">{theme.label}</span>
              <span className="block truncate text-xs text-muted-foreground">{theme.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

const shopImages = [
  { key: "logoUrl", variant: "logo", label: "Logo", hint: "Cuadrado, se muestra en círculo." },
  { key: "backgroundUrl", variant: "background", label: "Imagen de fondo", hint: "Horizontal, va detrás de tu tienda." },
] as const;

const accentPresets = ["#194e47", "#b4532a", "#db2763", "#714497", "#245fa3", "#0f766e", "#f2a90c", "#111111"];

function AppearanceGroup({ title, text, children }: { title: string; text?: string; children: ReactNode }) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-0.5">
        <h4 className="text-sm font-semibold">{title}</h4>
        {text && <p className="text-xs text-muted-foreground">{text}</p>}
      </div>
      {children}
    </div>
  );
}

function AccentPicker({ theme, value, onChange }: { theme: string; value: string; onChange: (value: string) => void }) {
  const themeAccent = getTheme(theme).colors.accent;
  const current = (value || themeAccent).toLowerCase();
  const custom = Boolean(value) && !accentPresets.includes(current) && current !== themeAccent.toLowerCase();
  const swatch = (active: boolean) => cn(
    "relative grid size-9 shrink-0 place-items-center rounded-full ring-1 ring-black/10 ring-inset transition outline-none",
    "focus-visible:ring-[3px] focus-visible:ring-ring/50",
    active ? "outline-2 outline-offset-2 outline-foreground" : "hover:scale-105",
  );
  return (
    <div className="flex flex-wrap items-center gap-2.5" role="radiogroup" aria-label="Color principal">
      <button type="button" role="radio" aria-checked={!value} onClick={() => onChange("")} title="Color del tema"
        className={cn(swatch(!value), "inline-flex h-9 w-auto items-center gap-1 px-3.5 text-xs font-semibold whitespace-nowrap hover:scale-100")}
        style={{ background: themeAccent, color: getTheme(theme).colors.accentInk }}
      >
        {!value && <Check className="size-3.5" strokeWidth={3} />} Del tema
      </button>
      <span className="h-6 w-px bg-border" aria-hidden="true" />
      {accentPresets.filter((color) => color !== themeAccent.toLowerCase()).map((color) => {
        const active = Boolean(value) && current === color;
        return (
          <button key={color} type="button" role="radio" aria-checked={active} aria-label={color} title={color}
            onClick={() => onChange(color)} className={swatch(active)} style={{ background: color }}
          >
            {active && <Check className="size-4 text-white mix-blend-difference" strokeWidth={3} />}
          </button>
        );
      })}
      <label title="Elegir otro color"
        className={cn(swatch(custom), "cursor-pointer overflow-hidden",
          !custom && "bg-[conic-gradient(from_90deg,#f43f5e,#f59e0b,#84cc16,#06b6d4,#6366f1,#d946ef,#f43f5e)]")}
        style={custom ? { background: current } : undefined}
      >
        {custom ? <Check className="size-4 text-white mix-blend-difference" strokeWidth={3} /> : <Plus className="size-4 text-white drop-shadow" strokeWidth={3} />}
        <input type="color" value={current} onChange={(event) => onChange(event.target.value)} className="sr-only" aria-label="Elegir otro color" />
      </label>
      {value && <span className="font-mono text-xs text-muted-foreground uppercase">{value}</span>}
    </div>
  );
}

function AppearanceFields({ draft, set, setUploading }: {
  draft: ProfileDraft; set: SetDraft; setUploading: (busy: boolean) => void;
}) {
  return (
    <div className="grid gap-7">
      <AppearanceGroup title="Tema" text="Fondo, tipografía y colores base de tu tienda.">
        <ThemePicker value={draft.theme} onChange={(theme) => set({ theme })} />
      </AppearanceGroup>
      <AppearanceGroup title="Color principal" text="Botones, precios destacados y filtros seleccionados.">
        <AccentPicker theme={draft.theme} value={draft.accentColor} onChange={(accentColor) => set({ accentColor })} />
      </AppearanceGroup>
      <AppearanceGroup title="Logo e imagen de fondo" text="Opcionales · JPG, PNG, WebP o GIF hasta 5 MB.">
        <div className="grid gap-4 sm:grid-cols-2">
          {shopImages.map(({ key, variant, label, hint }) => (
            <div key={key} className="grid content-start gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{label}</span>
                <span className="truncate text-xs text-muted-foreground">{hint}</span>
              </div>
              <PanelImageUpload
                label={label} value={draft[key]} variant={variant}
                onChange={(value) => set({ [key]: value })} onBusyChange={setUploading}
              />
            </div>
          ))}
        </div>
      </AppearanceGroup>
    </div>
  );
}

function ContactFields({ draft, set, errors }: { draft: ProfileDraft; set: SetDraft; errors: ProfileErrors }) {
  const { locale, t } = useI18n();
  return (
    <div className="grid gap-5">
      <Field
        label="WhatsApp" optional error={errors.whatsapp}
        hint={t("profile.whatsappHint")}
      >
        <PhoneInput
          defaultCountry="SV"
          international
          labels={locale === "en" ? phoneLabelsEn : phoneLabelsEs}
          locales={locale}
          countrySelectComponent={PhoneCountrySelect}
          value={draft.whatsapp || undefined}
          onChange={(value) => set({ whatsapp: value ?? "" })}
          className="h-10 gap-2 rounded-lg border border-input bg-background px-3 shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 has-[[aria-invalid=true]]:border-destructive"
          numberInputProps={{ className: "h-full bg-transparent text-base outline-none md:text-sm" }}
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Instagram" optional error={errors.instagram}>
          <AffixInput prefix="@" value={draft.instagram} onChange={(e) => set({ instagram: e.target.value })} onBlur={() => set({ instagram: cleanHandle(draft.instagram) })} placeholder="tunegocio" maxLength={80} autoCapitalize="none" spellCheck={false} />
        </Field>
        <Field label="TikTok" optional error={errors.tiktok}>
          <AffixInput prefix="@" value={draft.tiktok} onChange={(e) => set({ tiktok: e.target.value })} onBlur={() => set({ tiktok: cleanHandle(draft.tiktok) })} placeholder="tunegocio" maxLength={80} autoCapitalize="none" spellCheck={false} />
        </Field>
      </div>
    </div>
  );
}

function HoursEditor({ draft, set, errors }: { draft: ProfileDraft; set: SetDraft; errors: ProfileErrors }) {
  const { locale, t } = useI18n();
  const weekdays = weekdaysByLocale[locale];
  const setDay = (index: number, patch: Partial<Day>) => set({ days: draft.days.map((day, i) => i === index ? { ...day, ...patch } : day) });
  const firstOpen = draft.days.findIndex((day) => day.open);
  return (
    <div className="grid gap-4">
      <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl bg-muted/60 p-4">
        <span className="grid gap-0.5">
          <span className="font-medium">{t("profile.acceptBooking")}</span>
          <span className="text-sm text-muted-foreground">{t("profile.acceptBookingDesc")}</span>
        </span>
        <Switch checked={draft.booking} onCheckedChange={(booking) => set({ booking })} />
      </label>
      {draft.booking && (
        <div className="grid gap-1">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">{t("profile.hoursHint")}</p>
            {firstOpen >= 0 && (
              <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => {
                const source = draft.days[firstOpen];
                set({ days: draft.days.map((day) => day.open ? { ...day, from: source.from, to: source.to } : day) });
              }}>
                <Copy /> {t("profile.copyDay")} {weekdays[firstOpen].toLowerCase()} {t("profile.toAll")}
              </Button>
            )}
          </div>
          {draft.days.map((day, index) => (
            <div key={index} className={cn("grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 rounded-xl px-3 py-2.5 sm:grid-cols-[140px_1fr]", day.open ? "bg-card" : "bg-transparent")}>
              <label className="flex cursor-pointer items-center gap-3">
                <Switch checked={day.open} onCheckedChange={(open) => setDay(index, { open })} aria-label={weekdays[index]} />
                <span className={cn("text-sm font-medium", !day.open && "text-muted-foreground")}>{weekdays[index]}</span>
              </label>
              {day.open ? (
                <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-1">
                  <Input type="time" step={900} value={day.from} onChange={(e) => setDay(index, { from: e.target.value })} aria-label={weekdays[index]} className="h-9 w-32" aria-invalid={errors.days?.[index] ? true : undefined} />
                  <span className="text-sm text-muted-foreground">{t("profile.to")}</span>
                  <Input type="time" step={900} value={day.to} onChange={(e) => setDay(index, { to: e.target.value })} aria-label={weekdays[index]} className="h-9 w-32" aria-invalid={errors.days?.[index] ? true : undefined} />
                  {errors.days?.[index] && <span className="text-xs font-medium text-destructive">{errors.days[index]}</span>}
                </div>
              ) : (
                <span className="text-right text-sm text-muted-foreground sm:text-left">{t("profile.closed")}</span>
              )}
            </div>
          ))}
          {errors.hours && <p className="text-sm font-medium text-destructive">{errors.hours}</p>}
        </div>
      )}
    </div>
  );
}

function previewShop(draft: ProfileDraft, products: Product[]) {
  return { ...fromDraft(draft), products };
}

export function ProfileEditor({ shop }: { shop: PanelShop }) {
  const initial = useMemo(() => toDraft(shop), [shop]);
  const [draft, setDraft] = useState(initial);
  const [showErrors, setShowErrors] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { run, pending } = usePanelAction();
  const errors = validateProfile(draft);
  const visibleErrors = showErrors ? errors : {};
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const set: SetDraft = (patch) => setDraft((current) => ({ ...current, ...patch }));

  async function save(event: FormEvent) {
    event.preventDefault();
    if (uploading || pending) return;
    if (hasErrors(errors)) {
      setShowErrors(true);
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }
    const profile = fromDraft(draft);
    if (await run({ action: "editar-tienda", shopSlug: shop.slug, profile }, "Tienda actualizada")) {
      setShowErrors(false);
      setDraft(toDraft(profile));
    }
  }

  return (
    <form onSubmit={save} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <fieldset disabled={pending || uploading} className="grid min-w-0 gap-5">
        <FormSection title="Identidad" text="Lo primero que ven tus clientes al abrir tu enlace.">
          <IdentityFields draft={draft} set={set} errors={visibleErrors} />
        </FormSection>
        <FormSection title="Apariencia">
          <AppearanceFields draft={draft} set={set} setUploading={setUploading} />
        </FormSection>
        <FormSection title="Contacto y redes" text="Aparecen como botones en tu tienda.">
          <ContactFields draft={draft} set={set} errors={visibleErrors} />
        </FormSection>
        <FormSection title="Reservas en línea">
          <HoursEditor draft={draft} set={set} errors={visibleErrors} />
        </FormSection>
        <SaveBar dirty={dirty || pending} pending={pending} onDiscard={() => { setDraft(initial); setShowErrors(false); }} />
      </fieldset>
      <aside className="lg:sticky lg:top-8">
        <StorefrontPreview shop={previewShop(draft, shop.products)} slug={shop.slug} />
      </aside>
    </form>
  );
}

const wizardSteps = ["Tu tienda", "Apariencia", "Contacto"];

export function CreateShopWizard({ operator }: { operator: boolean }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(() => ({ ...toDraft(), booking: false }));
  const link = useShopSlugField();
  const [email, setEmail] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { run, pending } = usePanelAction();
  const set: SetDraft = (patch) => setDraft((current) => ({ ...current, ...patch }));
  const errors = validateProfile(draft);
  const mailError = operator ? emailError(email) : null;
  const stepValid = [
    !errors.name && !errors.description && !link.error && !mailError,
    true,
    !errors.whatsapp && !errors.instagram && !errors.tiktok && !errors.hours && !errors.days,
  ];
  const visible = showErrors ? errors : {};

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (uploading || pending) return;
    if (!stepValid[step]) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    if (step < wizardSteps.length - 1) {
      setStep(step + 1);
      return;
    }
    const ok = await run({
      action: "crear-tienda", shopSlug: link.slug, profile: fromDraft(draft), ...(operator ? { email: email.trim() } : {}),
    }, operator ? "Tienda creada y vendedor habilitado" : "¡Tu tienda está lista!");
    if (ok && operator) {
      setDraft({ ...toDraft(), booking: false });
      link.reset();
      setEmail("");
      setStep(0);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <fieldset disabled={pending || uploading} className="grid min-w-0 gap-5">
        <Stepper
          steps={wizardSteps.map((label) => ({ label }))} current={step}
          onSelect={setStep} canSelect={(index) => index < step || stepValid.slice(0, index).every(Boolean)}
        />
        {step === 0 && (
          <FormSection title="Datos de la tienda" text="Podés cambiar el nombre y la descripción cuando quieras. El enlace es definitivo.">
            <Field label="Nombre de la tienda" error={visible.name} counter={{ value: draft.name.length, max: 100 }}>
              <Input
                value={draft.name} maxLength={100} placeholder="Luna Uñas" className="h-10" autoFocus
                onChange={(e) => {
                  set({ name: e.target.value });
                  link.followName(e.target.value);
                }}
              />
            </Field>
            <Field
              label="Enlace público" error={(showErrors || link.status === "taken") && link.error}
              hint={<SlugStatus status={link.status} />}
            >
              <AffixInput
                prefix="/tienda/" value={link.slug} maxLength={64} placeholder="luna-unas" autoCapitalize="none" spellCheck={false}
                inputClassName="font-mono"
                onChange={(e) => link.type(e.target.value)}
                onBlur={link.trim}
                suffix={link.canSuggest(draft.name) ? (
                  <Button type="button" variant="secondary" size="xs" className="rounded-full" onClick={() => link.suggest(draft.name)}>
                    <Sparkles /> Sugerir
                  </Button>
                ) : undefined}
              />
            </Field>
            <Field label="Descripción" optional error={visible.description} counter={{ value: draft.description.length, max: 500 }}>
              <Textarea value={draft.description} onChange={(e) => set({ description: e.target.value })} maxLength={500} rows={3} placeholder="Qué ofrecés y dónde." />
            </Field>
            {operator && (
              <Field label="Correo del vendedor" error={showErrors && mailError} hint="Le habilitamos el acceso al panel con este correo.">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} placeholder="vendedor@correo.com" className="h-10" autoCapitalize="none" spellCheck={false} />
              </Field>
            )}
          </FormSection>
        )}
        {step === 1 && (
          <FormSection title="Apariencia">
            <AppearanceFields draft={draft} set={set} setUploading={setUploading} />
          </FormSection>
        )}
        {step === 2 && (
          <>
            <FormSection title="Contacto y redes" text="Todo es opcional; lo podés completar después.">
              <ContactFields draft={draft} set={set} errors={visible} />
            </FormSection>
            <FormSection title="Reservas en línea">
              <HoursEditor draft={draft} set={set} errors={visible} />
            </FormSection>
          </>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {step > 0
            ? <Button type="button" variant="ghost" className="rounded-full" onClick={() => setStep(step - 1)}><ArrowLeft /> Atrás</Button>
            : <span />}
          <Button type="submit" size="lg" className="rounded-full px-6">
            {pending && <Loader2 className="animate-spin" />}
            {step < wizardSteps.length - 1
              ? <>Continuar <ArrowRight /></>
              : pending ? "Creando…" : operator ? "Crear tienda y habilitar vendedor" : "Crear mi tienda"}
          </Button>
        </div>
      </fieldset>
      <aside className="lg:sticky lg:top-8">
        <StorefrontPreview shop={previewShop(draft, [])} slug={link.slug} />
      </aside>
    </form>
  );
}

function SlugStatus({ status }: { status: ShopSlugStatus }) {
  if (status === "checking") return <span className="inline-flex items-center gap-1.5"><Loader2 className="size-3 animate-spin" /> Comprobando…</span>;
  if (status === "free") return <span className="inline-flex items-center gap-1.5 font-medium text-success"><Check className="size-3" /> Disponible</span>;
  if (status === "taken") return <span className="inline-flex items-center gap-1.5 text-destructive"><X className="size-3" /> Ocupado</span>;
  return <>Solo minúsculas, números y guiones. Se arma solo a partir del nombre.</>;
}
