import { useRef, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles, Store, X } from "lucide-react";
import { getSeller } from "../auth";
import {
  AuthAlert, AuthEyebrow, AuthField, AuthLayout, AuthLede, AuthNote, AuthSwitch, AuthTitle,
  authButton, authGhostButton, authInput, EmailField, emailError, MailIcon,
} from "../AuthLayout";
import { useShopSlugField, type ShopSlugStatus } from "../shopSlug";
import { cn } from "@/lib/utils";

type Status = "enviado" | "ocupado" | "datos" | "servicio";

const errors: Record<Exclude<Status, "enviado">, string> = {
  ocupado: "Ese enlace ya lo usa otra tienda. Probá con otro.",
  datos: "Revisá los datos: el nombre, el enlace (solo minúsculas, números y guiones) y el correo.",
  servicio: "No se pudo procesar la solicitud. Intentá de nuevo en unos minutos.",
};

export const Route = createFileRoute("/registrarse")({
  validateSearch: (search: Record<string, unknown>): { estado?: Status; nombre?: string; enlace?: string } => ({
    estado: search.estado === "enviado" || (typeof search.estado === "string" && Object.hasOwn(errors, search.estado))
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

const steps = ["Tu negocio", "Tu correo"];

function Signup() {
  const { estado, nombre, enlace } = Route.useSearch();
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
        <AuthEyebrow>Último paso</AuthEyebrow>
        <AuthTitle>Confirmá tu correo</AuthTitle>
        <AuthLede role="status">
          Te enviamos un enlace. Al abrirlo se crea tu tienda y entrás directo a tu panel. Revisá también la carpeta de spam.
        </AuthLede>
        <AuthNote>El enlace vence en 15 minutos y sirve una sola vez.</AuthNote>
        <Link to="/registrarse" className={authGhostButton}>Empezar de nuevo</Link>
      </AuthLayout>
    );
  }

  const nameError = !name.trim() ? "Contanos cómo se llama tu negocio." : null;
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
      <Stepper current={step} />
      <AuthEyebrow>Paso {step + 1} de 2 · {steps[step]}</AuthEyebrow>
      <AuthTitle>{step === 0 ? "Tu vitrina, lista hoy" : "¿A dónde te escribimos?"}</AuthTitle>
      <AuthLede>
        {step === 0
          ? "Contanos cómo se llama tu negocio. Después cargás tu catálogo y tu horario desde el panel."
          : "Te mandamos un enlace para confirmar. Sin contraseñas."}
      </AuthLede>
      {estado && <AuthAlert>{errors[estado]}</AuthAlert>}
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
          <AuthField label="Nombre del negocio" htmlFor="shopName" error={showErrors ? nameError : null}>
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
            label="Enlace de tu tienda" htmlFor="shopSlug"
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
                  type="button" title="Usar el nombre del negocio"
                  className="mr-2 flex h-8 items-center gap-1 rounded-full bg-neutral-100 px-3 text-xs font-medium hover:bg-neutral-200"
                  onClick={() => link.suggest(name)}
                >
                  <Sparkles className="size-3.5" /> Sugerir
                </button>
              )}
            </div>
          </AuthField>
          {link.status === "taken" && (
            <div className="-mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
              Probá con:
              {[link.slug + "-sv", link.slug + "-" + new Date().getFullYear(), link.slug + "-oficial"].filter((option) => option.length <= 64).map((option) => (
                <button key={option} type="button" onClick={() => link.choose(option)}
                  className="rounded-full bg-neutral-100 px-2.5 py-1 font-mono text-xs text-[#111] hover:bg-neutral-200">
                  {option}
                </button>
              ))}
            </div>
          )}
          <button type="submit" className={authButton} disabled={link.status === "checking" && !link.error}>
            Continuar <ArrowRight className="size-4" />
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
              <button type="button" onClick={() => setStep(0)} className="text-sm font-medium underline underline-offset-4">Editar</button>
            </div>
            <EmailField label="Tu correo" autoFocus value={email} onChange={setEmail} />
            <div className="grid gap-2">
              <button type="submit" className={authButton} disabled={sending}>
                {sending && <Loader2 className="size-4 animate-spin" />}
                {sending ? "Creando…" : "Crear mi tienda"}
              </button>
              <button type="button" className={authGhostButton} onClick={() => setStep(0)} disabled={sending}>
                <ArrowLeft className="size-4" /> Atrás
              </button>
            </div>
          </div>
        )}
      </form>
      <AuthSwitch>¿Ya tenés tienda? <Link to="/ingresar">Ingresá</Link></AuthSwitch>
    </AuthLayout>
  );
}

function SlugHint({ status }: { status: ShopSlugStatus }) {
  if (status === "checking") return <span className="flex items-center gap-1.5"><Loader2 className="size-3.5 animate-spin" /> Comprobando disponibilidad…</span>;
  if (status === "free") return <span className="flex items-center gap-1.5 text-green-700"><Check className="size-3.5" /> ¡Disponible!</span>;
  if (status === "taken") return <span className="flex items-center gap-1.5 text-red-700"><X className="size-3.5" /> Ocupado</span>;
  return <span>Solo minúsculas, números y guiones. Es la dirección que compartís con tus clientes.</span>;
}

function Stepper({ current }: { current: number }) {
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
