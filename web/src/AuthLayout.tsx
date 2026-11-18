import { useId, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";

/** Fonts shared with the landing page. */
export const authFonts = [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" as const },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Geist+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap",
  },
];

const perks = [
  "Tu catálogo, tu agenda y tus citas en un solo lugar.",
  "Entrás sin contraseña, con un enlace a tu correo.",
  "Funciona igual desde el celular.",
];

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-side">
        <img src="/landing/local.jpg" alt="" />
        <Link to="/" className="auth-logo">vitrina</Link>
        <div className="auth-side-copy">
          <p className="auth-side-title">Tu negocio<br />nunca cierra.</p>
          <ul>
            {perks.map((p) => (
              <li key={p}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <main className="auth-main">
        <Link to="/" className="auth-logo auth-logo-mobile">vitrina</Link>
        <div className="auth-card">{children}</div>
        <Link to="/" className="auth-back">← Volver al inicio</Link>
      </main>
    </div>
  );
}

export function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
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

/** Email input that validates on every change and shows the error below the field. */
export function EmailField({ label, autoFocus }: { label: string; autoFocus?: boolean }) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);

  const check = (input: HTMLInputElement) => {
    const message = emailError(input.value);
    input.setCustomValidity(message ?? "");
    setError(message);
  };

  return (
    <div className="auth-field-group">
      <label className="auth-field">
        <span>{label}</span>
        <input
          type="email" name="email" autoComplete="email" maxLength={254} placeholder="vos@tunegocio.com" required
          autoFocus={autoFocus} autoCapitalize="none" spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? id : undefined}
          onChange={(e) => check(e.currentTarget)}
          onInvalid={(e) => {
            e.preventDefault();
            check(e.currentTarget);
            e.currentTarget.focus();
          }}
        />
      </label>
      {error && <p id={id} className="auth-field-error" role="alert">{error}</p>}
    </div>
  );
}
