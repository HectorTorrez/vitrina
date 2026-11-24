import { useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { getSeller } from "../auth";
import {
  AuthAlert, AuthEyebrow, AuthLayout, AuthLede, AuthNote, AuthSwitch, AuthTitle, authButton, authGhostButton, EmailField, MailIcon,
} from "../AuthLayout";
import { useI18n } from "../i18n";

type Status = "enviado" | "correo" | "enlace" | "servicio";

const errorKeys: Record<Exclude<Status, "enviado">, "auth.login.errEmail" | "auth.login.errLink" | "auth.login.errService"> = {
  correo: "auth.login.errEmail",
  enlace: "auth.login.errLink",
  servicio: "auth.login.errService",
};

export const Route = createFileRoute("/ingresar")({
  validateSearch: (search: Record<string, unknown>): { estado?: Status } => ({
    estado: search.estado === "enviado" || (typeof search.estado === "string" && Object.hasOwn(errorKeys, search.estado))
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
  const { t } = useI18n();

  if (estado === "enviado") {
    return (
      <AuthLayout>
        <MailIcon />
        <AuthEyebrow>{t("auth.login.sentEyebrow")}</AuthEyebrow>
        <AuthTitle>{t("auth.login.sentTitle")}</AuthTitle>
        <AuthLede role="status">{t("auth.login.sentLede")}</AuthLede>
        <AuthNote>{t("auth.login.sentNote")}</AuthNote>
        <Link to="/ingresar" className={authGhostButton}>{t("auth.login.otherEmail")}</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthEyebrow>{t("auth.login.eyebrow")}</AuthEyebrow>
      <AuthTitle>{t("auth.login.title")}</AuthTitle>
      <AuthLede>{t("auth.login.lede")}</AuthLede>
      {estado && <AuthAlert>{t(errorKeys[estado])}</AuthAlert>}
      <form action="/auth" method="post" className="mt-2 grid gap-4" onSubmit={() => setSending(true)}>
        <input type="hidden" name="action" value="link" />
        <EmailField label={t("auth.login.emailLabel")} autoFocus />
        <button type="submit" className={authButton} disabled={sending}>
          {sending && <Loader2 className="size-4 animate-spin" />}
          {sending ? t("auth.login.sending") : t("auth.login.submit")}
        </button>
      </form>
      <AuthSwitch>{t("auth.login.switch")} <Link to="/registrarse">{t("auth.login.switchLink")}</Link></AuthSwitch>
    </AuthLayout>
  );
}
