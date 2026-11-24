import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, Loader2, Plus, Sparkles, X } from "lucide-react";
import PhoneInput, { isPossiblePhoneNumber } from "react-phone-number-input";
import { PhoneCountrySelect } from "./PhoneCountrySelect";
import phoneLabelsEs from "react-phone-number-input/locale/es";
import phoneLabelsEn from "react-phone-number-input/locale/en";
import "react-phone-number-input/style.css";
import { acceptsBookings, PAYMENT_METHOD_PRESETS, type BookingConfig, type DeliveryConfig, type Product, type ShopStyle, type StaffMember, type TimeBlock } from "./catalog";
import { useI18n } from "./i18n";
import type { PanelShop, Profile } from "./panel";
import { AffixInput, Field, FormSection, FormSelect, SaveBar, Stepper, usePanelAction } from "./PanelForm";
import { useShopSlugField, type ShopSlugStatus } from "./shopSlug";
import { StorefrontPreview } from "./store/StorefrontPreview";
import { emailError } from "./AuthLayout";
import { PanelImageUpload } from "./PanelImageUpload";
import { contrastRatio, fontChoices, getTheme, themes } from "./themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const weekdaysByLocale = {
  es: ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};

const timezoneOptions = [
  { value: "America/El_Salvador", label: "El Salvador (CST)" },
  { value: "America/Guatemala", label: "Guatemala (CST)" },
  { value: "America/Mexico_City", label: "Ciudad de México (CST)" },
  { value: "America/Costa_Rica", label: "Costa Rica (CST)" },
  { value: "America/Bogota", label: "Bogotá / Lima (COT)" },
  { value: "America/New_York", label: "New York (EST/EDT)" },
  { value: "America/Chicago", label: "Chicago (CST/CDT)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PST/PDT)" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires (ART)" },
  { value: "America/Santiago", label: "Santiago (CLT)" },
  { value: "Europe/Madrid", label: "Madrid (CET)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
];

const currencyOptions = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "MXN", label: "MXN ($)" },
  { value: "GTQ", label: "GTQ (Q)" },
  { value: "HNL", label: "HNL (L)" },
  { value: "NIO", label: "NIO (C$)" },
  { value: "CRC", label: "CRC (₡)" },
  { value: "COP", label: "COP ($)" },
  { value: "ARS", label: "ARS ($)" },
  { value: "PEN", label: "PEN (S/)" },
  { value: "CLP", label: "CLP ($)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "CAD", label: "CAD ($)" },
];

interface Day { open: boolean; blocks: TimeBlock[] }
interface ProfileDraft {
  name: string;
  description: string;
  theme: string;
  accentColor: string;
  locale: "" | "es" | "en";
  timezone: string;
  currency: string;
  style: ShopStyle;
  delivery: {
    pickupEnabled: boolean;
    pickupNote: string;
    deliveryEnabled: boolean;
    deliveryFeeMode: "free" | "fixed" | "coordinate";
    deliveryFee: string;
    deliveryNote: string;
  };
  paymentMethods: string[];
  logoUrl: string;
  backgroundUrl: string;
  instagram: string;
  tiktok: string;
  facebook: string;
  website: string;
  address: string;
  mapUrl: string;
  whatsapp: string;
  booking: boolean;
  days: Day[];
  blockedDates: string[];
  bookingConfig: BookingConfig;
  staff: StaffMember[];
}
type ProfileErrors = Partial<Record<"name" | "description" | "instagram" | "tiktok" | "whatsapp" | "hours" | "staff", string>> & { days?: Record<number, string> };

function toDraft(profile?: Profile): ProfileDraft {
  const hours = profile?.hours ?? [];
  return {
    name: profile?.name ?? "",
    description: profile?.description ?? "",
    logoUrl: profile?.logoUrl ?? "",
    backgroundUrl: profile?.backgroundUrl ?? "",
    accentColor: profile?.accentColor ?? "",
    locale: profile?.locale ?? "",
    timezone: profile?.timezone || "America/El_Salvador",
    currency: profile?.currency || "USD",
    style: {
      font: profile?.style?.font ?? "",
      bgColor: profile?.style?.bgColor ?? "",
      surfaceColor: profile?.style?.surfaceColor ?? "",
      inkColor: profile?.style?.inkColor ?? "",
      radius: profile?.style?.radius ?? "",
      buttonStyle: profile?.style?.buttonStyle ?? "",
      heroLayout: profile?.style?.heroLayout ?? "",
      catalogLayout: profile?.style?.catalogLayout ?? "",
      cardAspect: profile?.style?.cardAspect ?? "",
      veilOpacity: profile?.style?.veilOpacity ?? 0,
      announcement: profile?.style?.announcement ?? "",
    },
    delivery: {
      pickupEnabled: Boolean(profile?.delivery?.pickupEnabled),
      pickupNote: profile?.delivery?.pickupNote ?? "",
      deliveryEnabled: Boolean(profile?.delivery?.deliveryEnabled),
      deliveryFeeMode: (profile?.delivery?.deliveryFeeMode || "coordinate") as "free" | "fixed" | "coordinate",
      deliveryFee: profile?.delivery?.deliveryFeeCents ? (profile.delivery.deliveryFeeCents / 100).toFixed(2) : "",
      deliveryNote: profile?.delivery?.deliveryNote ?? "",
    },
    paymentMethods: profile?.paymentMethods ?? [],
    theme: profile?.theme || "costa",
    instagram: profile?.instagram ?? "",
    tiktok: profile?.tiktok ?? "",
    facebook: profile?.facebook ?? "",
    website: profile?.website ?? "",
    address: profile?.address ?? "",
    mapUrl: profile?.mapUrl ?? "",
    whatsapp: profile?.whatsapp ? "+" + profile.whatsapp : "",
    booking: acceptsBookings({ hours }),
    days: weekdaysByLocale.es.map((_, index) => {
      const day = hours[index];
      const existingBlocks = day?.blocks?.length
        ? day.blocks.map((b) => ({ open: b.open, close: b.close }))
        : day?.open
          ? [{ open: day.open, close: day.close || "18:00" }]
          : [];
      return {
        open: hours.length ? existingBlocks.length > 0 : index > 0,
        blocks: existingBlocks.length > 0 ? existingBlocks : [{ open: "09:00", close: "18:00" }],
      };
    }),
    blockedDates: profile?.blockedDates ?? [],
    bookingConfig: {
      bufferMinutes: profile?.bookingConfig?.bufferMinutes ?? 0,
      leadTimeMinutes: profile?.bookingConfig?.leadTimeMinutes ?? 60,
      horizonDays: profile?.bookingConfig?.horizonDays ?? 60,
      cancelNoticeHours: profile?.bookingConfig?.cancelNoticeHours ?? 2,
      reminderHoursBefore: profile?.bookingConfig?.reminderHoursBefore ?? 24,
      reminder2HoursBefore: profile?.bookingConfig?.reminder2HoursBefore ?? 0,
    },
    staff: (profile?.staff ?? []).map((m) => ({
      ...m,
      serviceSlugs: m.serviceSlugs ? [...m.serviceSlugs] : [],
    })),
  };
}

/** Pulls the handle out of "@user", "instagram.com/user" or a full profile URL. */
function cleanHandle(value: string) {
  const trimmed = value.trim();
  const fromUrl = trimmed.match(/(?:instagram\.com|tiktok\.com)\/@?([^/?#\s]+)/i);
  return (fromUrl ? fromUrl[1] : trimmed).replace(/^@+/, "");
}

function fromDraft(draft: ProfileDraft): Profile {
  const deliveryFeeCents = draft.delivery.deliveryFeeMode === "fixed"
    ? Math.max(0, Math.round(Number(draft.delivery.deliveryFee.replace(",", ".") || 0) * 100))
    : 0;
  const delivery: DeliveryConfig = {
    pickupEnabled: draft.delivery.pickupEnabled,
    pickupNote: draft.delivery.pickupNote.trim(),
    deliveryEnabled: draft.delivery.deliveryEnabled,
    deliveryFeeMode: draft.delivery.deliveryEnabled ? draft.delivery.deliveryFeeMode : "",
    deliveryFeeCents,
    deliveryNote: draft.delivery.deliveryNote.trim(),
  };
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    theme: draft.theme,
    accentColor: draft.accentColor,
    locale: draft.locale,
    timezone: draft.timezone,
    currency: draft.currency,
    style: {
      ...draft.style,
      announcement: (draft.style.announcement ?? "").trim(),
    },
    delivery,
    paymentMethods: draft.paymentMethods,
    logoUrl: draft.logoUrl,
    backgroundUrl: draft.backgroundUrl,
    instagram: cleanHandle(draft.instagram),
    tiktok: cleanHandle(draft.tiktok),
    facebook: draft.facebook.trim().replace(/^@+/, ""),
    website: draft.website.trim(),
    address: draft.address.trim(),
    mapUrl: draft.mapUrl.trim(),
    whatsapp: draft.whatsapp.replace(/^\+/, ""),
    hours: draft.booking
      ? draft.days.map((day) => {
          if (!day.open || day.blocks.length === 0) return { open: "", close: "" };
          const sorted = [...day.blocks].sort((a, b) => a.open.localeCompare(b.open));
          return sorted.length > 1
            ? { open: sorted[0].open, close: sorted[sorted.length - 1].close, blocks: sorted }
            : { open: sorted[0].open, close: sorted[0].close };
        })
      : [],
    blockedDates: draft.blockedDates,
    bookingConfig: {
      bufferMinutes: draft.bookingConfig.bufferMinutes || 0,
      leadTimeMinutes: draft.bookingConfig.leadTimeMinutes || 60,
      horizonDays: draft.bookingConfig.horizonDays || 60,
      cancelNoticeHours: draft.bookingConfig.cancelNoticeHours || 0,
      reminderHoursBefore: draft.bookingConfig.reminderHoursBefore || 0,
      reminder2HoursBefore: draft.bookingConfig.reminder2HoursBefore || 0,
    },
    staff: draft.staff.map((m) => ({
      id: m.id.trim(),
      name: m.name.trim(),
      role: (m.role ?? "").trim(),
      active: m.active,
      serviceSlugs: m.serviceSlugs?.length ? m.serviceSlugs : undefined,
      hours: m.hours?.length ? m.hours : undefined,
    })),
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
      if (!day.open) return;
      if (day.blocks.length === 0) {
        days[index] = "Agregá al menos un bloque horario.";
        return;
      }
      const sorted = [...day.blocks].sort((a, b) => a.open.localeCompare(b.open));
      for (let i = 0; i < sorted.length; i++) {
        const b = sorted[i];
        if (!b.open || !b.close || b.open >= b.close) {
          days[index] = "La apertura debe ser antes del cierre.";
          return;
        }
        if (i > 0 && sorted[i].open < sorted[i - 1].close) {
          days[index] = "Los bloques horarios no pueden superponerse.";
          return;
        }
      }
    });
    if (Object.keys(days).length) errors.days = days;
    if (!draft.days.some((day) => day.open)) errors.hours = "Abrí al menos un día o desactivá las reservas en línea.";
  }
  if (draft.staff.some((m) => !m.name.trim() || !m.id.trim())) {
    errors.staff = "Cada especialista necesita un nombre.";
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
      <div className="grid gap-5 sm:grid-cols-3">
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
        <Field label={t("common.language") === "Language" ? "Currency" : "Moneda"}>
          <FormSelect
            value={draft.currency}
            onValueChange={(currency) => set({ currency })}
            options={currencyOptions}
          />
        </Field>
        <Field label={t("common.language") === "Language" ? "Time zone" : "Zona horaria"}>
          <FormSelect
            value={draft.timezone}
            onValueChange={(timezone) => set({ timezone })}
            options={timezoneOptions}
          />
        </Field>
      </div>
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

function PillGroup<T extends string>({ value, onChange, options, label }: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value || "_default"} type="button" role="radio" aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "h-9 rounded-full border px-3.5 text-xs font-medium transition",
              active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-foreground/40",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function AppearanceFields({ draft, set, setUploading }: {
  draft: ProfileDraft; set: SetDraft; setUploading: (busy: boolean) => void;
}) {
  const { locale, t } = useI18n();
  const en = locale === "en";
  const baseTheme = getTheme(draft.theme);
  const style = draft.style;
  const setStyle = (patch: Partial<ShopStyle>) => set({ style: { ...style, ...patch } });
  const effBg = style.bgColor || baseTheme.colors.bg;
  const effInk = style.inkColor || baseTheme.colors.ink;
  const lowContrast = Boolean(style.bgColor || style.inkColor) && contrastRatio(effBg, effInk) < 4.5;

  return (
    <div className="grid gap-7">
      <AppearanceGroup title={t("profile.theme")} text={t("profile.themeDesc")}>
        <ThemePicker value={draft.theme} onChange={(theme) => set({ theme })} />
      </AppearanceGroup>

      <AppearanceGroup title={t("profile.accent")} text={t("profile.accentDesc")}>
        <AccentPicker theme={draft.theme} value={draft.accentColor} onChange={(accentColor) => set({ accentColor })} />
      </AppearanceGroup>

      <AppearanceGroup
        title={en ? "Typography" : "Tipografía"}
        text={en ? "Heading font for your shop name and section titles." : "Fuente de títulos para tu nombre y secciones."}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={en ? "Typography" : "Tipografía"}>
          {fontChoices.map((choice) => {
            const active = (style.font || "") === choice.value;
            return (
              <button
                key={choice.value || "default"} type="button" role="radio" aria-checked={active}
                onClick={() => setStyle({ font: choice.value })}
                className={cn(
                  "flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition",
                  active ? "border-primary bg-primary/5 font-semibold" : "border-border bg-card hover:border-foreground/30",
                )}
              >
                <span style={choice.family ? { fontFamily: choice.family } : undefined}>
                  {choice.value === "" ? (en ? "Theme default" : "Del tema") : choice.label}
                </span>
                {active && <Check className="size-3.5 text-primary" strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      </AppearanceGroup>

      <AppearanceGroup
        title={en ? "Custom colors" : "Colores personalizados"}
        text={en ? "Optional overrides on top of the selected theme." : "Ajustes opcionales sobre el tema elegido."}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {([
            ["bgColor", en ? "Background" : "Fondo", baseTheme.colors.bg],
            ["surfaceColor", en ? "Cards" : "Tarjetas", baseTheme.colors.surface],
            ["inkColor", en ? "Text" : "Texto", baseTheme.colors.ink],
          ] as const).map(([key, label, fallback]) => {
            const current = style[key] || "";
            return (
              <div key={key} className="flex items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <span className="relative size-7 shrink-0 overflow-hidden rounded-full ring-1 ring-black/15" style={{ background: current || fallback }}>
                    <input
                      type="color" value={current || fallback} aria-label={label}
                      onChange={(e) => setStyle({ [key]: e.target.value })}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                  </span>
                  <span className="grid">
                    <span className="text-xs font-medium">{label}</span>
                    <span className="font-mono text-[11px] text-muted-foreground uppercase">{current || (en ? "Theme" : "Tema")}</span>
                  </span>
                </label>
                {current && (
                  <button type="button" onClick={() => setStyle({ [key]: "" })} aria-label="Reset" className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {lowContrast && (
          <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {en
              ? "Low contrast between background and text. Consider darkening or lightening one of them for readability."
              : "Poco contraste entre el fondo y el texto. Considerá oscurecer o aclarar uno para facilitar la lectura."}
          </p>
        )}
      </AppearanceGroup>

      <AppearanceGroup
        title={en ? "Layout & shape" : "Diseño y forma"}
        text={en ? "Control how your header, cards, and buttons look." : "Elegí cómo se ven tu portada, tarjetas y botones."}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{en ? "Header layout" : "Portada"}</span>
            <PillGroup
              label={en ? "Header layout" : "Portada"}
              value={style.heroLayout || ""}
              onChange={(heroLayout) => setStyle({ heroLayout })}
              options={[
                { value: "", label: en ? "Left" : "Izquierda" },
                { value: "center", label: en ? "Centered" : "Centrada" },
                { value: "compact", label: en ? "Compact" : "Compacta" },
              ]}
            />
          </div>
          <div className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{en ? "Catalog view" : "Catálogo"}</span>
            <PillGroup
              label={en ? "Catalog view" : "Catálogo"}
              value={style.catalogLayout || ""}
              onChange={(catalogLayout) => setStyle({ catalogLayout })}
              options={[
                { value: "", label: en ? "Grid" : "Cuadrícula" },
                { value: "list", label: en ? "List" : "Lista" },
              ]}
            />
          </div>
          <div className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{en ? "Corners" : "Bordes"}</span>
            <PillGroup
              label={en ? "Corners" : "Bordes"}
              value={style.radius || ""}
              onChange={(radius) => setStyle({ radius })}
              options={[
                { value: "sharp", label: en ? "Sharp" : "Rectos" },
                { value: "", label: en ? "Soft" : "Suaves" },
                { value: "pill", label: en ? "Rounded" : "Redondos" },
              ]}
            />
          </div>
          <div className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{en ? "Buttons" : "Botones"}</span>
            <PillGroup
              label={en ? "Buttons" : "Botones"}
              value={style.buttonStyle || ""}
              onChange={(buttonStyle) => setStyle({ buttonStyle })}
              options={[
                { value: "", label: en ? "Solid" : "Sólido" },
                { value: "outline", label: en ? "Outline" : "Contorno" },
                { value: "soft", label: en ? "Soft" : "Suave" },
              ]}
            />
          </div>
          {style.catalogLayout !== "list" && (
            <div className="grid gap-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">{en ? "Card image ratio" : "Proporción de fotos"}</span>
              <PillGroup
                label={en ? "Card image ratio" : "Proporción de fotos"}
                value={style.cardAspect || ""}
                onChange={(cardAspect) => setStyle({ cardAspect })}
                options={[
                  { value: "", label: en ? "Portrait (4:5)" : "Vertical (4:5)" },
                  { value: "1/1", label: en ? "Square (1:1)" : "Cuadrada (1:1)" },
                  { value: "4/3", label: en ? "Landscape (4:3)" : "Horizontal (4:3)" },
                ]}
              />
            </div>
          )}
        </div>
      </AppearanceGroup>

      <AppearanceGroup
        title={en ? "Announcement bar" : "Barra de anuncio"}
        text={en ? "Optional banner at the top of your storefront." : "Franja opcional en la parte superior de tu tienda."}
      >
        <Field label={en ? "Message" : "Mensaje"} optional counter={{ value: (style.announcement ?? "").length, max: 140 }}>
          <Input
            value={style.announcement ?? ""} maxLength={140} className="h-10"
            placeholder={en ? "Free shipping on orders over $30" : "Envío gratis en pedidos mayores a $30"}
            onChange={(e) => setStyle({ announcement: e.target.value })}
          />
        </Field>
      </AppearanceGroup>

      <AppearanceGroup title={t("profile.images")} text={t("profile.imagesDesc")}>
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
        {draft.backgroundUrl && (
          <div className="grid gap-1.5 rounded-xl border bg-card p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{en ? "Background overlay opacity" : "Opacidad del velo sobre el fondo"}</span>
              <span className="font-mono text-muted-foreground">{style.veilOpacity || 82}%</span>
            </div>
            <input
              type="range" min={40} max={95} step={1} value={style.veilOpacity || 82}
              onChange={(e) => setStyle({ veilOpacity: Number(e.target.value) })}
              className="w-full accent-primary"
            />
          </div>
        )}
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
        <Field label="Facebook" optional>
          <AffixInput prefix="fb.com/" value={draft.facebook} onChange={(e) => set({ facebook: e.target.value })} placeholder="tunegocio" maxLength={64} autoCapitalize="none" spellCheck={false} />
        </Field>
        <Field label={locale === "en" ? "Website" : "Sitio web"} optional>
          <Input type="url" value={draft.website} onChange={(e) => set({ website: e.target.value })} placeholder="https://tunegocio.com" maxLength={512} className="h-10" />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={locale === "en" ? "Address / Location" : "Dirección / Ubicación"} optional>
          <Input value={draft.address} onChange={(e) => set({ address: e.target.value })} placeholder={locale === "en" ? "123 Main St, Suite 4" : "Col. Escalón, San Salvador"} maxLength={200} className="h-10" />
        </Field>
        <Field label={locale === "en" ? "Google Maps / Waze link" : "Enlace de Google Maps / Waze"} optional>
          <Input type="url" value={draft.mapUrl} onChange={(e) => set({ mapUrl: e.target.value })} placeholder="https://maps.google.com/..." maxLength={512} className="h-10" />
        </Field>
      </div>
    </div>
  );
}

function CommerceFields({ draft, set }: { draft: ProfileDraft; set: SetDraft }) {
  const { locale } = useI18n();
  const en = locale === "en";
  const [customMethod, setCustomMethod] = useState("");
  const setDelivery = (patch: Partial<ProfileDraft["delivery"]>) => set({ delivery: { ...draft.delivery, ...patch } });
  const presetKeys = new Set<string>(PAYMENT_METHOD_PRESETS.map((p) => p.key));
  const customMethods = draft.paymentMethods.filter((m) => !presetKeys.has(m));

  const toggleMethod = (key: string) => {
    const exists = draft.paymentMethods.includes(key);
    if (exists) {
      set({ paymentMethods: draft.paymentMethods.filter((m) => m !== key) });
    } else if (draft.paymentMethods.length < 12) {
      set({ paymentMethods: [...draft.paymentMethods, key] });
    }
  };

  const addCustom = () => {
    const trimmed = customMethod.trim();
    if (!trimmed || trimmed.length > 40 || draft.paymentMethods.length >= 12) return;
    if (draft.paymentMethods.some((m) => m.toLowerCase() === trimmed.toLowerCase())) {
      setCustomMethod("");
      return;
    }
    set({ paymentMethods: [...draft.paymentMethods, trimmed] });
    setCustomMethod("");
  };

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <div className="grid gap-0.5">
          <h4 className="text-sm font-semibold">{en ? "Delivery & pickup options" : "Opciones de entrega"}</h4>
          <p className="text-xs text-muted-foreground">
            {en ? "Shown on your storefront and selectable in the cart." : "Se muestran en tu tienda y el cliente puede elegirlas en el carrito."}
          </p>
        </div>

        <div className="grid gap-3 rounded-xl border bg-muted/30 p-4">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span className="grid gap-0.5">
              <span className="text-sm font-medium">{en ? "Store pickup" : "Retiro en local"}</span>
              <span className="text-xs text-muted-foreground">{en ? "Customers pick up their order at your address." : "El cliente pasa a recoger su pedido."}</span>
            </span>
            <Switch checked={draft.delivery.pickupEnabled} onCheckedChange={(pickupEnabled) => setDelivery({ pickupEnabled })} />
          </label>
          {draft.delivery.pickupEnabled && (
            <Input
              value={draft.delivery.pickupNote}
              maxLength={160}
              className="h-9 bg-card"
              placeholder={en ? "Optional note (e.g. Mon–Sat 9am–5pm, Suite 4)" : "Nota opcional (ej. Lun–Sáb 9am–5pm, Col. Escalón)"}
              onChange={(e) => setDelivery({ pickupNote: e.target.value })}
            />
          )}
        </div>

        <div className="grid gap-3 rounded-xl border bg-muted/30 p-4">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span className="grid gap-0.5">
              <span className="text-sm font-medium">{en ? "Home delivery" : "Envío a domicilio"}</span>
              <span className="text-xs text-muted-foreground">{en ? "Deliver orders to the customer's address." : "Enviás pedidos a la dirección del cliente."}</span>
            </span>
            <Switch checked={draft.delivery.deliveryEnabled} onCheckedChange={(deliveryEnabled) => setDelivery({ deliveryEnabled })} />
          </label>
          {draft.delivery.deliveryEnabled && (
            <div className="grid gap-3 pt-1">
              <div className="grid gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">{en ? "Delivery cost" : "Costo de envío"}</span>
                <PillGroup
                  label={en ? "Delivery cost" : "Costo de envío"}
                  value={draft.delivery.deliveryFeeMode}
                  onChange={(deliveryFeeMode) => setDelivery({ deliveryFeeMode })}
                  options={[
                    { value: "coordinate", label: en ? "To be arranged" : "A coordinar" },
                    { value: "fixed", label: en ? "Fixed fee" : "Tarifa fija" },
                    { value: "free", label: en ? "Free" : "Gratis" },
                  ]}
                />
              </div>
              {draft.delivery.deliveryFeeMode === "fixed" && (
                <Field label={en ? "Fixed delivery fee" : "Tarifa fija de envío"}>
                  <AffixInput
                    prefix="$"
                    suffix={draft.currency || "USD"}
                    value={draft.delivery.deliveryFee}
                    inputMode="decimal"
                    placeholder="3.50"
                    className="bg-card"
                    inputClassName="font-mono"
                    onChange={(e) => setDelivery({ deliveryFee: e.target.value.replace(/[^\d.,]/g, "") })}
                  />
                </Field>
              )}
              <Input
                value={draft.delivery.deliveryNote}
                maxLength={160}
                className="h-9 bg-card"
                placeholder={en ? "Optional coverage note (e.g. Same-day in metro area)" : "Nota opcional (ej. Envíos el mismo día en San Salvador)"}
                onChange={(e) => setDelivery({ deliveryNote: e.target.value })}
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 border-t pt-5">
        <div className="grid gap-0.5">
          <h4 className="text-sm font-semibold">{en ? "Accepted payment methods" : "Métodos de pago aceptados"}</h4>
          <p className="text-xs text-muted-foreground">
            {en
              ? "Choose which payment methods you accept. Customers can pick one when sending their order."
              : "Elegí qué métodos de pago aceptás. Tus clientes podrán elegir uno al enviar su pedido."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_METHOD_PRESETS.map((preset) => {
            const active = draft.paymentMethods.includes(preset.key);
            return (
              <button
                key={preset.key}
                type="button"
                aria-pressed={active}
                onClick={() => toggleMethod(preset.key)}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition",
                  active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-foreground/40",
                )}
              >
                {active && <Check className="size-3.5" strokeWidth={3} />}
                {en ? preset.en : preset.es}
              </button>
            );
          })}
        </div>

        <div className="grid gap-2 pt-1">
          <span className="text-xs font-medium text-muted-foreground">
            {en ? "Add another payment method (optional)" : "Agregar otro método personalizado (opcional)"}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={customMethod}
              maxLength={40}
              className="h-9 max-w-xs"
              placeholder={en ? "e.g. Zelle, Apple Pay, Wompi" : "Ej. Chivo Wallet, Wompi, SINPE, Zelle"}
              onChange={(e) => setCustomMethod(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
            />
            <Button type="button" variant="outline" size="sm" className="rounded-full" disabled={!customMethod.trim() || draft.paymentMethods.length >= 12} onClick={addCustom}>
              <Plus className="size-3.5" /> {en ? "Add" : "Agregar"}
            </Button>
          </div>
          {customMethods.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {customMethods.map((method) => (
                <span key={method} className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium">
                  {method}
                  <button
                    type="button"
                    onClick={() => toggleMethod(method)}
                    aria-label={method}
                    className="rounded-full p-0.5 text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HoursEditor({ draft, set, errors, services = [] }: { draft: ProfileDraft; set: SetDraft; errors: ProfileErrors; services?: Product[] }) {
  const { locale, t } = useI18n();
  const en = locale === "en";
  const weekdays = weekdaysByLocale[locale];
  const setDay = (index: number, patch: Partial<Day>) => set({ days: draft.days.map((day, i) => i === index ? { ...day, ...patch } : day) });
  const setBlock = (dayIndex: number, blockIndex: number, patch: Partial<TimeBlock>) => {
    const day = draft.days[dayIndex];
    const blocks = day.blocks.map((b, i) => i === blockIndex ? { ...b, ...patch } : b);
    setDay(dayIndex, { blocks });
  };
  const addBlock = (dayIndex: number) => {
    const day = draft.days[dayIndex];
    if (day.blocks.length >= 4) return;
    const last = day.blocks[day.blocks.length - 1];
    const nextOpen = last?.close && last.close < "17:00" ? "14:00" : "15:00";
    const nextClose = nextOpen < "18:00" ? "18:00" : "20:00";
    setDay(dayIndex, { blocks: [...day.blocks, { open: nextOpen, close: nextClose }] });
  };
  const removeBlock = (dayIndex: number, blockIndex: number) => {
    const day = draft.days[dayIndex];
    if (day.blocks.length <= 1) return;
    setDay(dayIndex, { blocks: day.blocks.filter((_, i) => i !== blockIndex) });
  };
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
            <p className="text-sm text-muted-foreground">
              {en ? "Add split shifts (e.g. lunch breaks) using the + button." : "Podés agregar horarios partidos (ej. pausa de almuerzo) con el botón +."}
            </p>
            {firstOpen >= 0 && (
              <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => {
                const source = draft.days[firstOpen];
                set({
                  days: draft.days.map((day) => day.open ? { ...day, blocks: source.blocks.map((b) => ({ ...b })) } : day),
                });
              }}>
                <Copy /> {t("profile.copyDay")} {weekdays[firstOpen].toLowerCase()} {t("profile.toAll")}
              </Button>
            )}
          </div>
          {draft.days.map((day, index) => (
            <div key={index} className={cn("grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-2 rounded-xl px-3 py-2.5 sm:grid-cols-[140px_1fr]", day.open ? "bg-card" : "bg-transparent")}>
              <label className="flex cursor-pointer items-center gap-3 pt-1.5">
                <Switch checked={day.open} onCheckedChange={(open) => setDay(index, { open })} aria-label={weekdays[index]} />
                <span className={cn("text-sm font-medium", !day.open && "text-muted-foreground")}>{weekdays[index]}</span>
              </label>
              {day.open ? (
                <div className="col-span-2 grid gap-2 sm:col-span-1">
                  {day.blocks.map((block, bIdx) => (
                    <div key={bIdx} className="flex flex-wrap items-center gap-2">
                      <Input type="time" step={900} value={block.open} onChange={(e) => setBlock(index, bIdx, { open: e.target.value })} aria-label={weekdays[index]} className="h-9 w-32" aria-invalid={errors.days?.[index] ? true : undefined} />
                      <span className="text-sm text-muted-foreground">{t("profile.to")}</span>
                      <Input type="time" step={900} value={block.close} onChange={(e) => setBlock(index, bIdx, { close: e.target.value })} aria-label={weekdays[index]} className="h-9 w-32" aria-invalid={errors.days?.[index] ? true : undefined} />
                      {bIdx === day.blocks.length - 1 && day.blocks.length < 4 && (
                        <Button type="button" variant="ghost" size="icon-xs" className="rounded-full" title={en ? "Add shift" : "Agregar turno"} onClick={() => addBlock(index)}>
                          <Plus className="size-3.5" />
                        </Button>
                      )}
                      {day.blocks.length > 1 && (
                        <Button type="button" variant="ghost" size="icon-xs" className="rounded-full text-muted-foreground hover:text-destructive" title={en ? "Remove shift" : "Quitar turno"} onClick={() => removeBlock(index, bIdx)}>
                          <X className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {errors.days?.[index] && <span className="text-xs font-medium text-destructive">{errors.days[index]}</span>}
                </div>
              ) : (
                <span className="pt-1.5 text-right text-sm text-muted-foreground sm:text-left">{t("profile.closed")}</span>
              )}
            </div>
          ))}
          {errors.hours && <p className="text-sm font-medium text-destructive">{errors.hours}</p>}
          <BookingConfigEditor config={draft.bookingConfig} onChange={(bookingConfig) => set({ bookingConfig })} />
          <StaffEditor staff={draft.staff} services={services} error={errors.staff} onChange={(staff) => set({ staff })} />
          <BlockedDatesEditor dates={draft.blockedDates} onChange={(blockedDates) => set({ blockedDates })} />
        </div>
      )}
    </div>
  );
}

function BookingConfigEditor({ config, onChange }: { config: BookingConfig; onChange: (next: BookingConfig) => void }) {
  const { locale } = useI18n();
  const en = locale === "en";
  const patch = (p: Partial<BookingConfig>) => onChange({ ...config, ...p });
  return (
    <div className="mt-4 grid gap-3 border-t pt-4">
      <div className="grid gap-0.5">
        <span className="text-sm font-medium">{en ? "Agenda rules & automatic reminders" : "Reglas de agenda y recordatorios automáticos"}</span>
        <span className="text-xs text-muted-foreground">
          {en ? "Customize buffers, advance notice, self-service cancellation window, and email reminders." : "Configurá pausas entre citas, anticipación, cancelación por enlace y recordatorios por correo."}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={en ? "Buffer between appointments" : "Descanso entre citas"}>
          <FormSelect
            value={String(config.bufferMinutes ?? 0)}
            onValueChange={(v) => patch({ bufferMinutes: Number(v) })}
            options={[
              { value: "0", label: en ? "None (0 min)" : "Sin descanso (0 min)" },
              { value: "5", label: "5 min" },
              { value: "10", label: "10 min" },
              { value: "15", label: "15 min" },
              { value: "20", label: "20 min" },
              { value: "30", label: "30 min" },
              { value: "45", label: "45 min" },
              { value: "60", label: "60 min" },
            ]}
          />
        </Field>
        <Field label={en ? "Minimum advance notice" : "Anticipación mínima"}>
          <FormSelect
            value={String(config.leadTimeMinutes ?? 60)}
            onValueChange={(v) => patch({ leadTimeMinutes: Number(v) })}
            options={[
              { value: "15", label: "15 min" },
              { value: "30", label: "30 min" },
              { value: "60", label: en ? "1 hour" : "1 hora" },
              { value: "120", label: en ? "2 hours" : "2 horas" },
              { value: "240", label: en ? "4 hours" : "4 horas" },
              { value: "720", label: en ? "12 hours" : "12 horas" },
              { value: "1440", label: en ? "24 hours" : "24 horas" },
              { value: "2880", label: en ? "48 hours" : "48 horas" },
            ]}
          />
        </Field>
        <Field label={en ? "Booking window" : "Horizonte de reserva"}>
          <FormSelect
            value={String(config.horizonDays ?? 60)}
            onValueChange={(v) => patch({ horizonDays: Number(v) })}
            options={[
              { value: "7", label: en ? "7 days" : "7 días" },
              { value: "14", label: en ? "14 days" : "14 días" },
              { value: "30", label: en ? "30 days" : "30 días" },
              { value: "60", label: en ? "60 days" : "60 días" },
              { value: "90", label: en ? "90 days" : "90 días" },
              { value: "180", label: en ? "6 months" : "6 meses" },
              { value: "365", label: en ? "1 year" : "1 año" },
            ]}
          />
        </Field>
        <Field label={en ? "Customer cancel / reschedule cutoff" : "Límite para cancelar o reprogramar"}>
          <FormSelect
            value={String(config.cancelNoticeHours ?? 2)}
            onValueChange={(v) => patch({ cancelNoticeHours: Number(v) })}
            options={[
              { value: "0", label: en ? "Anytime before start" : "Hasta antes de la cita" },
              { value: "2", label: en ? "2 hours before" : "2 horas antes" },
              { value: "4", label: en ? "4 hours before" : "4 horas antes" },
              { value: "12", label: en ? "12 hours before" : "12 horas antes" },
              { value: "24", label: en ? "24 hours before" : "24 horas antes" },
              { value: "48", label: en ? "48 hours before" : "48 horas antes" },
            ]}
          />
        </Field>
        <Field label={en ? "1st email reminder" : "1.er recordatorio por correo"}>
          <FormSelect
            value={String(config.reminderHoursBefore ?? 24)}
            onValueChange={(v) => patch({ reminderHoursBefore: Number(v) })}
            options={[
              { value: "0", label: en ? "Off" : "Desactivado" },
              { value: "6", label: en ? "6 hours before" : "6 horas antes" },
              { value: "12", label: en ? "12 hours before" : "12 horas antes" },
              { value: "24", label: en ? "24 hours before" : "24 horas antes" },
              { value: "48", label: en ? "48 hours before" : "48 horas antes" },
            ]}
          />
        </Field>
        <Field label={en ? "2nd email reminder" : "2.º recordatorio por correo"}>
          <FormSelect
            value={String(config.reminder2HoursBefore ?? 0)}
            onValueChange={(v) => patch({ reminder2HoursBefore: Number(v) })}
            options={[
              { value: "0", label: en ? "Off" : "Desactivado" },
              { value: "1", label: en ? "1 hour before" : "1 hora antes" },
              { value: "2", label: en ? "2 hours before" : "2 horas antes" },
              { value: "4", label: en ? "4 hours before" : "4 horas antes" },
            ]}
          />
        </Field>
      </div>
    </div>
  );
}

function slugifyStaff(name: string, existing: StaffMember[]) {
  const base = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "especialista";
  let candidate = base;
  let n = 2;
  while (existing.some((m) => m.id === candidate)) {
    candidate = `${base}-${n++}`;
  }
  return candidate;
}

function StaffEditor({ staff, services, error, onChange }: { staff: StaffMember[]; services: Product[]; error?: string; onChange: (next: StaffMember[]) => void }) {
  const { locale } = useI18n();
  const en = locale === "en";
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");

  const add = () => {
    const trimmed = newName.trim();
    if (!trimmed || staff.length >= 20) return;
    onChange([...staff, { id: slugifyStaff(trimmed, staff), name: trimmed, role: newRole.trim(), active: true, serviceSlugs: [] }]);
    setNewName("");
    setNewRole("");
  };
  const update = (id: string, patch: Partial<StaffMember>) => onChange(staff.map((m) => m.id === id ? { ...m, ...patch } : m));
  const toggleService = (id: string, slug: string) => {
    const member = staff.find((m) => m.id === id);
    if (!member) return;
    const current = member.serviceSlugs ?? [];
    const next = current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug];
    update(id, { serviceSlugs: next });
  };

  return (
    <div className="mt-4 grid gap-3 border-t pt-4">
      <div className="grid gap-0.5">
        <span className="text-sm font-medium">{en ? "Specialists / Stations" : "Especialistas / Estaciones"}</span>
        <span className="text-xs text-muted-foreground">
          {en ? "Optional. Add stylists, barbers, or booths so each has an independent agenda." : "Opcional. Agregá personas o cabinas para llevar agendas independientes por especialista."}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={en ? "Name (e.g. Ana)" : "Nombre (ej. Ana o Silla 1)"} maxLength={80} className="h-9 flex-1 min-w-36" />
        <Input value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder={en ? "Role (optional)" : "Rol (opcional)"} maxLength={60} className="h-9 w-40" />
        <Button type="button" variant="outline" size="sm" className="rounded-full" disabled={!newName.trim() || staff.length >= 20} onClick={add}>
          <Plus className="size-3.5" /> {en ? "Add" : "Agregar"}
        </Button>
      </div>
      {staff.length > 0 && (
        <div className="grid gap-2">
          {staff.map((m) => (
            <div key={m.id} className="grid gap-2.5 rounded-xl border bg-card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
                  <Switch checked={m.active} onCheckedChange={(active) => update(m.id, { active })} aria-label={m.name} />
                  <Input value={m.name} onChange={(e) => update(m.id, { name: e.target.value })} maxLength={80} className="h-8 w-40 text-sm font-medium" />
                  <Input value={m.role ?? ""} onChange={(e) => update(m.id, { role: e.target.value })} placeholder={en ? "Role" : "Rol"} maxLength={60} className="h-8 w-36 text-sm" />
                </div>
                <Button type="button" variant="ghost" size="icon-xs" className="rounded-full text-muted-foreground hover:text-destructive" onClick={() => onChange(staff.filter((item) => item.id !== m.id))}>
                  <X className="size-3.5" />
                </Button>
              </div>
              {services.length > 0 && (
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">
                    {m.serviceSlugs?.length
                      ? (en ? "Assigned services:" : "Servicios asignados:")
                      : (en ? "Offers all services (click to limit):" : "Atiende todos los servicios (tocá para filtrar):")}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {services.map((svc) => {
                      const selected = m.serviceSlugs?.includes(svc.slug) ?? false;
                      return (
                        <button
                          key={svc.slug}
                          type="button"
                          onClick={() => toggleService(m.id, svc.slug)}
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-xs transition",
                            selected ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {svc.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}

function BlockedDatesEditor({ dates, onChange }: { dates: string[]; onChange: (dates: string[]) => void }) {
  const { locale } = useI18n();
  const en = locale === "en";
  const [nextDate, setNextDate] = useState("");
  const add = () => {
    if (!nextDate || dates.includes(nextDate) || dates.length >= 60) return;
    onChange([...dates, nextDate].sort());
    setNextDate("");
  };
  return (
    <div className="mt-4 grid gap-3 border-t pt-4">
      <div className="grid gap-0.5">
        <span className="text-sm font-medium">{en ? "Blocked dates / Days off" : "Días libres / Fechas bloqueadas"}</span>
        <span className="text-xs text-muted-foreground">{en ? "Holidays or days you won't accept online bookings." : "Feriados o días en los que no recibirás citas en línea."}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} className="h-9 w-44" />
        <Button type="button" variant="outline" size="sm" className="rounded-full" disabled={!nextDate || dates.length >= 60} onClick={add}>
          <Plus className="size-3.5" /> {en ? "Block date" : "Bloquear fecha"}
        </Button>
      </div>
      {dates.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {dates.map((d) => (
            <span key={d} className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 font-mono text-xs">
              {d}
              <button type="button" onClick={() => onChange(dates.filter((item) => item !== d))} aria-label={d} className="rounded-full p-0.5 text-muted-foreground hover:text-destructive">
                <X className="size-3" />
              </button>
            </span>
          ))}
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
        <FormSection title="Entregas y métodos de pago" text="Definí cómo entregás tus pedidos y qué formas de pago aceptás.">
          <CommerceFields draft={draft} set={set} />
        </FormSection>
        <FormSection title="Reservas en línea">
          <HoursEditor draft={draft} set={set} errors={visibleErrors} services={shop.products.filter((p) => p.kind === "service")} />
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
