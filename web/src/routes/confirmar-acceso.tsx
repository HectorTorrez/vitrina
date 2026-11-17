import { useState, type SubmitEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthLayout, authFonts } from "../AuthLayout";

export const Route = createFileRoute("/confirmar-acceso")({
  headers: () => ({
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
  }),
  head: () => ({ meta: [{ title: "Confirmar acceso · Vitrina" }], links: authFonts }),
  component: ConfirmAccess,
});

function ConfirmAccess() {
  const [sending, setSending] = useState(false);

  function submitAccess(event: SubmitEvent<HTMLFormElement>) {
    // The fragment stays out of HTTP requests until the user confirms.
    const token = event.currentTarget.elements.namedItem("token");
    if (token instanceof HTMLInputElement) token.value = window.location.hash.slice(1);
    setSending(true);
  }

  return (
    <AuthLayout>
      <p className="auth-label">Último paso</p>
      <h1>Ya casi estás adentro</h1>
      <p className="auth-lede">Confirmá para entrar al panel de tu tienda desde este dispositivo.</p>
      <form action="/auth" method="post" className="auth-form" onSubmit={submitAccess}>
        <input type="hidden" name="action" value="verify" />
        <input type="hidden" name="token" />
        <button type="submit" className="auth-btn" disabled={sending}>
          {sending ? "Entrando…" : "Entrar al panel"}
        </button>
      </form>
      <p className="auth-note">¿El enlace no funciona? <Link to="/ingresar">Pedí otro</Link>.</p>
    </AuthLayout>
  );
}
