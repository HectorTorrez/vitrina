import { useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, Loader2, Sparkles, X } from "lucide-react";
import type { Product } from "./catalog";
import type { PanelShop, Profile } from "./panel";
import { AffixInput, Field, FormSection, SaveBar, Stepper, usePanelAction } from "./PanelForm";
import { cleanSlugInput, slugError, slugify } from "./slug";
import { useShopSlugStatus } from "./shopSlug";
import { StorefrontPreview } from "./store/StorefrontPreview";
import { emailError } from "./AuthLayout";
import { themes } from "./themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const weekdays = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

interface Day { open: boolean; from: string; to: string }
export interface ProfileDraft {
  name: string;
  description: string;
  theme: string;
  instagram: string;
  tiktok: string;
  whatsapp: string;
  booking: boolean;
  days: Day[];
}
type ProfileErrors = Partial<Record<"name" | "description" | "instagram" | "tiktok" | "whatsapp" | "hours", string>> & { days?: Record<number, string> };

export function toDraft(profile?: Partial<Profile>): ProfileDraft {
  const hours = profile?.hours ?? [];
  return {
    name: profile?.name ?? "",
    description: profile?.description ?? "",
    theme: profile?.theme || "costa",
    instagram: profile?.instagram ?? "",
    tiktok: profile?.tiktok ?? "",
    whatsapp: profile?.whatsapp ? "+" + profile.whatsapp.replace(/^\+/, "") : "",
    booking: hours.some((day) => day.open),
    days: weekdays.map((_, index) => {
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
export function cleanHandle(value: string) {
  const trimmed = value.trim();
  const fromUrl = trimmed.match(/(?:instagram\.com|tiktok\.com)\/@?([^/?#\s]+)/i);
  return (fromUrl ? fromUrl[1] : trimmed).replace(/^@+/, "");
}

/** Digits of the WhatsApp number; 8-digit numbers are assumed to be from El Salvador. */
export function cleanPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 8 ? "503" + digits : digits;
}

export function fromDraft(draft: ProfileDraft): Profile {
  const phone = cleanPhone(draft.whatsapp);
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    theme: draft.theme,
    instagram: cleanHandle(draft.instagram),
    tiktok: cleanHandle(draft.tiktok),
    whatsapp: phone ? "+" + phone : "",
    hours: draft.booking ? draft.days.map((day) => day.open ? { open: day.from, close: day.to } : { open: "", close: "" }) : [],
  };
}

export function validateProfile(draft: ProfileDraft): ProfileErrors {
  const errors: ProfileErrors = {};
  if (!draft.name.trim()) errors.name = "Escribí el nombre de tu tienda.";
  else if (draft.name.trim().length > 100) errors.name = "Usá hasta 100 caracteres.";
  if (draft.description.trim().length > 500) errors.description = "Usá hasta 500 caracteres.";
  for (const key of ["instagram", "tiktok"] as const) {
    const handle = cleanHandle(draft[key]);
    if (handle && !/^[A-Za-z0-9_.]{1,32}$/.test(handle)) errors[key] = "Solo letras, números, puntos y guiones bajos (hasta 32).";
  }
  const phone = cleanPhone(draft.whatsapp);
  if (draft.whatsapp.trim() && !/^[1-9][0-9]{6,14}$/.test(phone)) errors.whatsapp = "Escribí el número con código de país, por ejemplo +503 7000 0000.";
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

export function IdentityFields({ draft, set, errors }: { draft: ProfileDraft; set: SetDraft; errors: ProfileErrors }) {
  return (
    <div className="grid gap-5">
      <Field label="Nombre de la tienda" error={errors.name} counter={{ value: draft.name.length, max: 100 }}>
        <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} maxLength={100} placeholder="Luna Uñas" className="h-10" />
      </Field>
      <Field
        label="Descripción" optional error={errors.description} counter={{ value: draft.description.length, max: 500 }}
        hint="Una o dos frases: qué ofrecés y dónde. Aparece debajo del nombre y al compartir el enlace."
      >
        <Textarea value={draft.description} onChange={(e) => set({ description: e.target.value })} maxLength={500} rows={3} placeholder="Manicura y cuidado de uñas con cita previa en San Salvador." />
      </Field>
    </div>
  );
}

export function ThemePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
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

export function ContactFields({ draft, set, errors }: { draft: ProfileDraft; set: SetDraft; errors: ProfileErrors }) {
  return (
    <div className="grid gap-5">
      <Field
        label="WhatsApp" optional error={errors.whatsapp}
        hint="Tus clientes te escriben desde cada ficha. Si es de El Salvador podés escribir solo los 8 dígitos."
      >
        <AffixInput type="tel" inputMode="tel" value={draft.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} placeholder="+503 7000 0000" maxLength={20} />
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

export function HoursEditor({ draft, set, errors }: { draft: ProfileDraft; set: SetDraft; errors: ProfileErrors }) {
  const setDay = (index: number, patch: Partial<Day>) => set({ days: draft.days.map((day, i) => i === index ? { ...day, ...patch } : day) });
  const firstOpen = draft.days.findIndex((day) => day.open);
  return (
    <div className="grid gap-4">
      <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl bg-muted/60 p-4">
        <span className="grid gap-0.5">
          <span className="font-medium">Aceptar reservas en línea</span>
          <span className="text-sm text-muted-foreground">Tus clientes eligen fecha y hora desde la ficha de cada servicio.</span>
        </span>
        <Switch checked={draft.booking} onCheckedChange={(booking) => set({ booking })} />
      </label>
      {draft.booking && (
        <div className="grid gap-1">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Horario de atención (hora de El Salvador). Turnos cada 15 min.</p>
            {firstOpen >= 0 && (
              <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => {
                const source = draft.days[firstOpen];
                set({ days: draft.days.map((day) => day.open ? { ...day, from: source.from, to: source.to } : day) });
              }}>
                <Copy /> Copiar {weekdays[firstOpen].toLowerCase()} a todos
              </Button>
            )}
          </div>
          {draft.days.map((day, index) => (
            <div key={index} className={cn("grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 rounded-xl px-3 py-2.5 sm:grid-cols-[140px_1fr]", day.open ? "bg-card" : "bg-transparent")}>
              <label className="flex cursor-pointer items-center gap-3">
                <Switch checked={day.open} onCheckedChange={(open) => setDay(index, { open })} aria-label={"Abrir el " + weekdays[index]} />
                <span className={cn("text-sm font-medium", !day.open && "text-muted-foreground")}>{weekdays[index]}</span>
              </label>
              {day.open ? (
                <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-1">
                  <Input type="time" step={900} value={day.from} onChange={(e) => setDay(index, { from: e.target.value })} aria-label={"Abre el " + weekdays[index]} className="h-9 w-32" aria-invalid={errors.days?.[index] ? true : undefined} />
                  <span className="text-sm text-muted-foreground">a</span>
                  <Input type="time" step={900} value={day.to} onChange={(e) => setDay(index, { to: e.target.value })} aria-label={"Cierra el " + weekdays[index]} className="h-9 w-32" aria-invalid={errors.days?.[index] ? true : undefined} />
                  {errors.days?.[index] && <span className="text-xs font-medium text-destructive">{errors.days[index]}</span>}
                </div>
              ) : (
                <span className="text-right text-sm text-muted-foreground sm:text-left">Cerrado</span>
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
  return { ...fromDraft(draft), whatsapp: cleanPhone(draft.whatsapp), products };
}

/** Public profile form with a live preview of the store in its theme. */
export function ProfileEditor({ shop }: { shop: PanelShop }) {
  const initial = useMemo(() => toDraft(shop), [shop]);
  const [draft, setDraft] = useState(initial);
  const [showErrors, setShowErrors] = useState(false);
  const { run, pending } = usePanelAction();
  const errors = validateProfile(draft);
  const visibleErrors = showErrors ? errors : {};
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const set: SetDraft = (patch) => setDraft((current) => ({ ...current, ...patch }));

  async function save(event: FormEvent) {
    event.preventDefault();
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
      <fieldset disabled={pending} className="grid min-w-0 gap-5">
        <FormSection title="Identidad" text="Lo primero que ven tus clientes al abrir tu enlace.">
          <IdentityFields draft={draft} set={set} errors={visibleErrors} />
        </FormSection>
        <FormSection title="Apariencia" text="Elegí colores y tipografía. La vista previa se actualiza al instante.">
          <ThemePicker value={draft.theme} onChange={(theme) => set({ theme })} />
        </FormSection>
        <FormSection title="Contacto y redes" text="Aparecen como botones en tu tienda.">
          <ContactFields draft={draft} set={set} errors={visibleErrors} />
        </FormSection>
        <FormSection title="Reservas en línea">
          <HoursEditor draft={draft} set={set} errors={visibleErrors} />
        </FormSection>
        <SaveBar dirty={dirty || pending} pending={pending} onDiscard={() => { setDraft(initial); setShowErrors(false); }} />
      </fieldset>
      <aside className="hidden lg:sticky lg:top-8 lg:block">
        <StorefrontPreview shop={previewShop(draft, shop.products ?? [])} slug={shop.slug} />
      </aside>
    </form>
  );
}

const wizardSteps = ["Tu tienda", "Apariencia", "Contacto"];

/** Step-by-step store creation for sellers without a store and for operators. */
export function CreateShopWizard({ operator, onCreated }: { operator: boolean; onCreated?: () => void }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(() => ({ ...toDraft(), booking: false }));
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [email, setEmail] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const { run, pending } = usePanelAction();
  const slugStatus = useShopSlugStatus(slug, !slugError(slug));
  const set: SetDraft = (patch) => setDraft((current) => ({ ...current, ...patch }));
  const errors = validateProfile(draft);
  const linkError = slugError(slug) ?? (slugStatus === "taken" ? "Ese enlace ya lo usa otra tienda." : null);
  const mailError = operator ? emailError(email) : null;
  const stepValid = [
    !errors.name && !errors.description && !linkError && !mailError,
    true,
    !errors.whatsapp && !errors.instagram && !errors.tiktok && !errors.hours && !errors.days,
  ];
  const visible = showErrors ? errors : {};

  async function submit(event: FormEvent) {
    event.preventDefault();
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
      action: "crear-tienda", shopSlug: slug, profile: fromDraft(draft), ...(operator ? { email: email.trim() } : {}),
    }, operator ? "Tienda creada y vendedor habilitado" : "¡Tu tienda está lista!");
    if (ok && operator) {
      setDraft({ ...toDraft(), booking: false });
      setSlug("");
      setSlugEdited(false);
      setEmail("");
      setStep(0);
      onCreated?.();
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <fieldset disabled={pending} className="grid min-w-0 gap-5">
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
                  if (!slugEdited) setSlug(slugify(e.target.value));
                }}
              />
            </Field>
            <Field
              label="Enlace público" error={(showErrors || slugStatus === "taken") && linkError}
              hint={<SlugStatus status={slugStatus} />}
            >
              <AffixInput
                prefix="/tienda/" value={slug} maxLength={64} placeholder="luna-unas" autoCapitalize="none" spellCheck={false}
                inputClassName="font-mono"
                onChange={(e) => { setSlug(cleanSlugInput(e.target.value)); setSlugEdited(true); }}
                onBlur={() => setSlug((current) => current.replace(/-+$/, ""))}
                suffix={slugEdited && draft.name && slugify(draft.name) !== slug ? (
                  <Button type="button" variant="secondary" size="xs" className="rounded-full" onClick={() => { setSlug(slugify(draft.name)); setSlugEdited(false); }}>
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
          <FormSection title="Elegí un tema" text="Mirá a la derecha cómo queda. Lo podés cambiar después.">
            <ThemePicker value={draft.theme} onChange={(theme) => set({ theme })} />
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
        <StorefrontPreview shop={previewShop(draft, [])} slug={slug} />
      </aside>
    </form>
  );
}

export function SlugStatus({ status }: { status: ReturnType<typeof useShopSlugStatus> }) {
  if (status === "checking") return <span className="inline-flex items-center gap-1.5"><Loader2 className="size-3 animate-spin" /> Comprobando…</span>;
  if (status === "free") return <span className="inline-flex items-center gap-1.5 font-medium text-success"><Check className="size-3" /> Disponible</span>;
  if (status === "taken") return <span className="inline-flex items-center gap-1.5 text-destructive"><X className="size-3" /> Ocupado</span>;
  return <>Solo minúsculas, números y guiones. Se arma solo a partir del nombre.</>;
}
