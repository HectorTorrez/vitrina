import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

const perks = [
  "Tu catálogo, tu agenda y tus citas en un solo lugar.",
  "Entrás sin contraseña, con un enlace a tu correo.",
  "Funciona igual desde el celular.",
];

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh bg-white text-[#111] md:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-ink-dark px-12 pt-8 pb-12 text-white md:flex">
        <img src="/landing/local.jpg" alt="" className="absolute inset-0 size-full object-cover opacity-55" />
        <div className="absolute inset-0 bg-linear-to-b from-ink-dark/60 via-ink-dark/0 via-30% to-ink-dark/92 to-75%" />
        <Link to="/" className="relative font-display text-[26px] leading-none font-bold tracking-[-0.035em]">vitrina</Link>
        <div className="relative">
          <p className="mb-7 font-display text-[clamp(48px,5.6vw,84px)] leading-[0.92] font-bold tracking-[-0.045em]">
            Tu negocio<br />nunca cierra.
          </p>
          <ul className="grid gap-3 text-neutral-300">
            {perks.map((perk) => (
              <li key={perk} className="flex items-center gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand/20 text-brand">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                {perk}
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <main className="flex flex-col items-start gap-10 px-5 pt-7 pb-10 md:items-center md:justify-center md:px-8 md:py-12">
        <Link to="/" className="font-display text-[26px] leading-none font-bold tracking-[-0.035em] md:hidden">vitrina</Link>
        <div className="mt-6 grid w-full gap-4 md:mt-0 md:w-[min(100%,420px)]">{children}</div>
        <Link to="/" className="text-sm text-muted-foreground transition hover:text-[#111]">← Volver al inicio</Link>
      </main>
    </div>
  );
}

export function AuthEyebrow({ children }: { children: ReactNode }) {
  return <p className="font-mono text-xs leading-none font-medium tracking-[0.1em] text-brand-ink uppercase">{children}</p>;
}

export function AuthTitle({ children }: { children: ReactNode }) {
  return <h1 className="font-display text-[38px] leading-none font-bold tracking-[-0.04em] md:text-[44px]">{children}</h1>;
}

export function AuthLede({ children, ...props }: ComponentProps<"p">) {
  return <p className="text-[17px] text-muted-foreground" {...props}>{children}</p>;
}

export function AuthNote({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground [&_a]:text-[#111] [&_a]:underline [&_a]:underline-offset-4">{children}</p>;
}

export function AuthAlert({ children }: { children: ReactNode }) {
  return <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800">{children}</p>;
}

export function AuthSwitch({ children }: { children: ReactNode }) {
  return <p className="border-t pt-4 text-[15px] text-muted-foreground [&_a]:font-semibold [&_a]:text-[#111] [&_a]:underline [&_a]:underline-offset-4">{children}</p>;
}

export function MailIcon() {
  return (
    <span className="mb-2 grid size-13 place-items-center rounded-2xl bg-accent text-brand-ink">
      <Mail className="size-6" strokeWidth={1.8} />
    </span>
  );
}

export const authButton = cn(
  "flex h-13 w-full items-center justify-center gap-2 rounded-full border border-[#111] bg-[#111] px-6 text-base font-semibold text-white",
  "transition hover:bg-[#2a2a2a] active:scale-[0.99] disabled:cursor-wait disabled:opacity-60",
);
export const authGhostButton = cn(authButton, "mt-2 border-border bg-white text-[#111] hover:bg-neutral-50");

export const authInput = cn(
  "h-13 w-full rounded-[10px] border border-border bg-white px-4 text-base text-[#111] transition outline-none placeholder:text-neutral-400",
  "focus:border-[#111] focus:ring-4 focus:ring-[#111]/8 aria-invalid:border-red-600 aria-invalid:focus:ring-red-600/12",
);

/** Label, control slot, hint and error for the auth forms. */
export function AuthField({ label, error, hint, htmlFor, children }: {
  label: string;
  error?: string | null;
  hint?: ReactNode;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium">{label}</label>
      {children}
      {error
        ? <p id={htmlFor + "-error"} className="text-[13px] text-red-700" role="alert">{error}</p>
        : hint && <div id={htmlFor + "-hint"} className="text-[13px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

const localPart = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const domainLabel = /^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$/;

/** Returns why an email address is invalid, or null when it looks deliverable. */
export function emailError(input: string): string | null {
  const email = input.trim();
  if (!email) return "Ingresá tu correo.";
  if (/\s/.test(email)) return "El correo no puede tener espacios.";
  if (email.length > 254) return "El correo es demasiado largo.";
  const at = email.split("@");
  if (at.length === 1) return "Falta la @, por ejemplo vos@gmail.com.";
  if (at.length > 2) return "El correo tiene más de una @.";
  const [local, domain] = at;
  if (!local) return "Falta la parte antes de la @.";
  if (!localPart.test(local)) return "Revisá lo que va antes de la @: tiene caracteres o puntos no válidos.";
  if (!domain) return "Falta el dominio después de la @, por ejemplo gmail.com.";
  const labels = domain.split(".");
  if (labels.length < 2 || labels[labels.length - 1] === "") return "El dominio está incompleto, por ejemplo gmail.com.";
  if (!labels.every((l) => domainLabel.test(l))) return "Revisá el dominio después de la @: tiene caracteres o puntos no válidos.";
  if (!/^[A-Za-z]{2,}$/.test(labels[labels.length - 1])) return "El dominio debe terminar en algo como .com o .ar.";
  return null;
}

/** Email input that validates once the person leaves the field (and live after that). */
export function EmailField({ label, autoFocus, value, onChange }: {
  label: string;
  autoFocus?: boolean;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const check = (input: HTMLInputElement, show: boolean) => {
    const message = emailError(input.value);
    input.setCustomValidity(message ?? "");
    if (show) setError(message);
  };

  return (
    <AuthField label={label} error={error} htmlFor={id}>
      <input
        id={id} type="email" name="email" autoComplete="email" maxLength={254} placeholder="vos@tunegocio.com" required
        autoFocus={autoFocus} autoCapitalize="none" spellCheck={false} className={authInput}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? id + "-error" : undefined}
        onChange={(e) => {
          onChange?.(e.currentTarget.value);
          check(e.currentTarget, touched);
        }}
        onBlur={(e) => {
          if (!e.currentTarget.value) return;
          setTouched(true);
          check(e.currentTarget, true);
        }}
        onInvalid={(e) => {
          e.preventDefault();
          setTouched(true);
          check(e.currentTarget, true);
          e.currentTarget.focus();
        }}
      />
    </AuthField>
  );
}
