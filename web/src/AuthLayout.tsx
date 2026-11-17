import type { ReactNode } from "react";
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
