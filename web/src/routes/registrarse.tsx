import { useRef, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles, Store, X } from "lucide-react";
import { getSeller } from "../auth";
import {
  AuthAlert, AuthEyebrow, AuthField, AuthLayout, AuthLede, AuthNote, AuthSwitch, AuthTitle,
  authButton, authGhostButton, authInput, EmailField, emailError, MailIcon,
} from "../AuthLayout";
import { useShopSlugField, type ShopSlugStatus } from "../shopSlug";
import { useI18n } from "../i18n";
import { cn } from "@/lib/utils";

type Status = "enviado" | "ocupado" | "datos" | "servicio";

const errorKeys: Record<Exclude<Status, "enviado">, "auth.signup.errTaken" | "auth.signup.errData" | "auth.login.errService"> = {
  ocupado: "auth.signup.errTaken",
  datos: "auth.signup.errData",
  servicio: "auth.login.errService",
};

export const Route = createFileRoute("/registrarse")({
  validateSearch: (search: Record<string, unknown>): { estado?: Status; nombre?: string; enlace?: string } => ({
    estado: search.estado === "enviado" || (typeof search.estado === "string" && Object.hasOwn(errorKeys, search.estado))
      ? (search.estado as Status)
      : undefined,
    nombre: typeof search.nombre === "string" ? search.nombre.slice(0, 100) : undefined,
    enlace: typeof search.enlace === "string" ? search.enlace.slice(0, 64) : undefined,
  }),
  beforeLoad: async () => {
    if (await getSeller()) throw redirect({ to: "/panel" });
  },
  headers: () => ({ "Cache-Control": "private, no-store" }),
  head: () => ({ meta: [{ title: "Abrí tu tienda · Vitrina" }] }),
  component: Signup,
});

function Signup() {
  const { estado, nombre, enlace } = Route.useSearch();
  const { t } = useI18n();
  const steps = [t("auth.signup.step1"), t("auth.signup.step2")];
  const [step, setStep] = useState(0);
  const [name, setName] = useState(nombre ?? "");
  const link = useShopSlugField(enlace);
  const [email, setEmail] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [sending, setSending] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  if (estado === "enviado") {
    return (
      <AuthLayout>
        <MailIcon />
        <AuthEyebrow>{t("auth.signup.sentEyebrow")}</AuthEyebrow>
        <AuthTitle>{t("auth.signup.sentTitle")}</AuthTitle>
        <AuthLede role="status">{t("auth.signup.sentLede")}</AuthLede>
        <AuthNote>{t("auth.login.sentNote")}</AuthNote>
        <Link to="/registrarse" className={authGhostButton}>{t("auth.signup.startOver")}</Link>
      </AuthLayout>
    );
  }

  const nameError = !name.trim() ? t("auth.signup.nameRequired") : null;
  const stepOneValid = !nameError && !link.error;
  const showLinkError = Boolean(link.error) && (showErrors || link.status === "taken");

  function next() {
    if (!stepOneValid) {
      setShowErrors(true);
      if (nameError) nameRef.current?.focus();
      return;
    }
    setShowErrors(false);
    setStep(1);
  }

  return (
    <AuthLayout>
      <Stepper current={step} steps={steps} />
      <AuthEyebrow>{step + 1} / 2 · {steps[step]}</AuthEyebrow>
      <AuthTitle>{step === 0 ? t("auth.signup.title1") : t("auth.signup.title2")}</AuthTitle>
      <AuthLede>{step === 0 ? t("auth.signup.lede1") : t("auth.signup.lede2")}</AuthLede>
      {estado && <AuthAlert>{t(errorKeys[estado])}</AuthAlert>}
      <form
        action="/auth" method="post" className="mt-2 grid gap-5" noValidate={step === 0}
        onSubmit={(event) => {
          if (step === 0) {
            event.preventDefault();
            next();
            return;
          }
          if (!stepOneValid || emailError(email)) {
            event.preventDefault();
            if (!stepOneValid) setStep(0);
            return;
          }
          setSending(true);
        }}
      >
        <input type="hidden" name="action" value="signup" />
        <div className={cn("grid gap-5", step !== 0 && "hidden")}>
          <AuthField label={t("auth.signup.shopName")} htmlFor="shopName" error={showErrors ? nameError : null}>
            <input
              ref={nameRef} id="shopName" name="shopName" required maxLength={100} placeholder="Luna Uñas"
              autoComplete="organization" autoFocus className={authInput} value={name}
              aria-invalid={showErrors && nameError ? true : undefined}
              onChange={(e) => {
                setName(e.target.value);
                link.followName(e.target.value);
              }}
            />
          </AuthField>
          <AuthField
            label={t("auth.signup.shopSlug")} htmlFor="shopSlug"
            error={showLinkError ? link.error : null}
            hint={<SlugHint status={link.status} />}
          >
            <div className={cn(
              "flex h-13 items-center rounded-[10px] border border-border bg-white transition",
              "focus-within:border-[#111] focus-within:ring-4 focus-within:ring-[#111]/8",
              showLinkError && "border-red-600 focus-within:border-red-600 focus-within:ring-red-600/12",
            )}>
              <span className="pl-4 font-mono text-[15px] text-neutral-500" aria-hidden="true">/tienda/</span>
              <input
                id="shopSlug" name="shopSlug" required maxLength={64} placeholder="luna-unas"
                autoCapitalize="none" spellCheck={false}
                className="h-full min-w-0 flex-1 bg-transparent pr-3 pl-0.5 font-mono text-[15px] outline-none"
                value={link.slug}
                aria-invalid={showLinkError || undefined}
                onChange={(e) => link.type(e.target.value)}
                onBlur={link.trim}
              />
              {link.canSuggest(name) && (
                <button
                  type="button" title={t("common.suggest")}
                  className="mr-2 flex h-8 items-center gap-1 rounded-full bg-neutral-100 px-3 text-xs font-medium hover:bg-neutral-200"
                  onClick={() => link.suggest(name)}
                >
                  <Sparkles className="size-3.5" /> {t("common.suggest")}
                </button>
              )}
            </div>
          </AuthField>
          {link.status === "taken" && (
            <div className="-mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
              {t("auth.signup.tryWith")}
              {[link.slug + "-sv", link.slug + "-" + new Date().getFullYear(), link.slug + "-oficial"].filter((option) => option.length <= 64).map((option) => (
                <button key={option} type="button" onClick={() => link.choose(option)}
                  className="rounded-full bg-neutral-100 px-2.5 py-1 font-mono text-xs text-[#111] hover:bg-neutral-200">
                  {option}
                </button>
              ))}
            </div>
          )}
          <button type="submit" className={authButton} disabled={link.status === "checking" && !link.error}>
            {t("common.continue")} <ArrowRight className="size-4" />
          </button>
        </div>

        {step === 1 && (
          <div className="grid gap-5">
            <div className="flex items-center gap-3 rounded-xl border bg-neutral-50 p-3.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#111] text-white"><Store className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{name}</p>
                <p className="truncate font-mono text-sm text-muted-foreground">/tienda/{link.slug}</p>
              </div>
              <button type="button" onClick={() => setStep(0)} className="text-sm font-medium underline underline-offset-4">{t("common.edit")}</button>
            </div>
            <EmailField label={t("auth.signup.yourEmail")} autoFocus value={email} onChange={setEmail} />
            <div className="grid gap-2">
              <button type="submit" className={authButton} disabled={sending}>
                {sending && <Loader2 className="size-4 animate-spin" />}
                {sending ? t("auth.signup.creating") : t("auth.signup.create")}
              </button>
              <button type="button" className={authGhostButton} onClick={() => setStep(0)} disabled={sending}>
                <ArrowLeft className="size-4" /> {t("common.back")}
              </button>
            </div>
          </div>
        )}
      </form>
      <AuthSwitch>{t("auth.signup.switch")} <Link to="/ingresar">{t("auth.signup.switchLink")}</Link></AuthSwitch>
    </AuthLayout>
  );
}

function SlugHint({ status }: { status: ShopSlugStatus }) {
  const { locale } = useI18n();
  if (status === "checking") return <span className="flex items-center gap-1.5"><Loader2 className="size-3.5 animate-spin" /> {locale === "en" ? "Checking availability…" : "Comprobando disponibilidad…"}</span>;
  if (status === "free") return <span className="flex items-center gap-1.5 text-green-700"><Check className="size-3.5" /> {locale === "en" ? "Available!" : "¡Disponible!"}</span>;
  if (status === "taken") return <span className="flex items-center gap-1.5 text-red-700"><X className="size-3.5" /> {locale === "en" ? "Taken" : "Ocupado"}</span>;
  return <span>{locale === "en" ? "Lowercase letters, numbers, and hyphens only. This is the link you share with customers." : "Solo minúsculas, números y guiones. Es la dirección que compartís con tus clientes."}</span>;
}

function Stepper({ current, steps }: { current: number; steps: string[] }) {
  return (
    <ol className="mb-2 flex items-center gap-2" aria-label="Progreso">
      {steps.map((label, index) => (
        <li key={label} className="flex flex-1 items-center gap-2">
          <span className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition",
            index < current ? "bg-[#111] text-white" : index === current ? "bg-brand text-ink-dark" : "bg-neutral-100 text-neutral-500",
          )} aria-current={index === current ? "step" : undefined}>
            {index < current ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
          </span>
          <span className={cn("text-sm", index === current ? "font-semibold" : "text-muted-foreground")}>{label}</span>
          {index < steps.length - 1 && <span className="h-px flex-1 bg-border" />}
        </li>
      ))}
    </ol>
  );
}
