import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, Loader2, Plus, Sparkles, X } from "lucide-react";
import PhoneInput, { isPossiblePhoneNumber } from "react-phone-number-input";
import { PhoneCountrySelect } from "./PhoneCountrySelect";
import phoneLabelsEs from "react-phone-number-input/locale/es";
import phoneLabelsEn from "react-phone-number-input/locale/en";
import "react-phone-number-input/style.css";
import { acceptsBookings, PAYMENT_METHOD_PRESETS, type DeliveryConfig, type Product, type ShopStyle } from "./catalog";
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

interface Day { open: boolean; from: string; to: string }
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
      return {
        open: hours.length ? Boolean(day?.open) : index > 0,
        from: day?.open || "09:00",
        to: day?.close || "18:00",
      };
    }),
    blockedDates: profile?.blockedDates ?? [],
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
    hours: draft.booking ? draft.days.map((day) => day.open ? { open: day.from, close: day.to } : { open: "", close: "" }) : [],
    blockedDates: draft.blockedDates,
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
          <BlockedDatesEditor dates={draft.blockedDates} onChange={(blockedDates) => set({ blockedDates })} />
        </div>
      )}
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
