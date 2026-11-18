import { useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { getSeller } from "../auth";
import { AuthLayout, authFonts, EmailField, MailIcon } from "../AuthLayout";

type Status = "enviado" | "correo" | "enlace" | "servicio";

const errors: Record<Exclude<Status, "enviado">, string> = {
  correo: "Ingresá un correo electrónico válido.",
  enlace: "El enlace venció, ya se usó o es inválido. Pedí otro para ingresar.",
  servicio: "No se pudo procesar la solicitud. Intentá de nuevo en unos minutos.",
};

export const Route = createFileRoute("/ingresar")({
  validateSearch: (search: Record<string, unknown>): { estado?: Status } => ({
    estado: search.estado === "enviado" || (typeof search.estado === "string" && Object.hasOwn(errors, search.estado))
      ? (search.estado as Status)
      : undefined,
  }),
  beforeLoad: async () => {
    if (await getSeller()) throw redirect({ to: "/panel" });
  },
  headers: () => ({ "Cache-Control": "private, no-store" }),
  head: () => ({ meta: [{ title: "Ingresar · Vitrina" }], links: authFonts }),
  component: Login,
});

function Login() {
  const { estado } = Route.useSearch();
  const [sending, setSending] = useState(false);

  if (estado === "enviado") {
    return (
      <AuthLayout>
        <span className="auth-icon"><MailIcon /></span>
        <p className="auth-label">Enlace enviado</p>
        <h1>Revisá tu correo</h1>
        <p className="auth-lede" role="status">
          Si tu correo está habilitado, te llegó un enlace para entrar. Revisá también la carpeta de spam.
        </p>
        <p className="auth-note">El enlace vence en 15 minutos y sirve una sola vez.</p>
        <Link to="/ingresar" className="auth-btn auth-btn-ghost">Usar otro correo</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <p className="auth-label">Acceso para vendedores</p>
      <h1>Entrá a tu vitrina</h1>
      <p className="auth-lede">Te enviamos un enlace a tu correo para entrar. Sin contraseñas.</p>
      {estado && <p className="auth-alert" role="alert">{errors[estado]}</p>}
      <form action="/auth" method="post" className="auth-form" onSubmit={() => setSending(true)}>
        <input type="hidden" name="action" value="link" />
        <EmailField label="Correo electrónico" autoFocus />
        <button type="submit" className="auth-btn" disabled={sending}>
          {sending ? "Enviando…" : "Enviarme un enlace"}
        </button>
      </form>
      <p className="auth-switch">¿Todavía no tenés tienda? <Link to="/registrarse">Abrí tu vitrina</Link></p>
    </AuthLayout>
  );
}
