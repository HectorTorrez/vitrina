import { useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { getSeller } from "../auth";
import {
  AuthAlert, AuthEyebrow, AuthLayout, AuthLede, AuthNote, AuthSwitch, AuthTitle, authButton, authGhostButton, EmailField, MailIcon,
} from "../AuthLayout";

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
  head: () => ({ meta: [{ title: "Ingresar · Vitrina" }] }),
  component: Login,
});

function Login() {
  const { estado } = Route.useSearch();
  const [sending, setSending] = useState(false);

  if (estado === "enviado") {
    return (
      <AuthLayout>
        <MailIcon />
        <AuthEyebrow>Enlace enviado</AuthEyebrow>
        <AuthTitle>Revisá tu correo</AuthTitle>
        <AuthLede role="status">
          Si tu correo está habilitado, te llegó un enlace para entrar. Revisá también la carpeta de spam.
        </AuthLede>
        <AuthNote>El enlace vence en 15 minutos y sirve una sola vez.</AuthNote>
        <Link to="/ingresar" className={authGhostButton}>Usar otro correo</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthEyebrow>Acceso para vendedores</AuthEyebrow>
      <AuthTitle>Entrá a tu vitrina</AuthTitle>
      <AuthLede>Te enviamos un enlace a tu correo para entrar. Sin contraseñas.</AuthLede>
      {estado && <AuthAlert>{errors[estado]}</AuthAlert>}
      <form action="/auth" method="post" className="mt-2 grid gap-4" onSubmit={() => setSending(true)}>
        <input type="hidden" name="action" value="link" />
        <EmailField label="Correo electrónico" autoFocus />
        <button type="submit" className={authButton} disabled={sending}>
          {sending && <Loader2 className="size-4 animate-spin" />}
          {sending ? "Enviando…" : "Enviarme un enlace"}
        </button>
      </form>
      <AuthSwitch>¿Todavía no tenés tienda? <Link to="/registrarse">Abrí tu vitrina</Link></AuthSwitch>
    </AuthLayout>
  );
}
