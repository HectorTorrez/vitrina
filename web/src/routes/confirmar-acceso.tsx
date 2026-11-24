import { useState, type SubmitEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { AuthEyebrow, AuthLayout, AuthLede, AuthNote, AuthTitle, authButton } from "../AuthLayout";
import { useI18n } from "../i18n";

export const Route = createFileRoute("/confirmar-acceso")({
  headers: () => ({
    "Cache-Control": "private, no-store",
    // "no-referrer" would make the browser send Origin: null and /auth would reject the form.
    "Referrer-Policy": "same-origin",
  }),
  head: () => ({ meta: [{ title: "Confirmar acceso · Vitrina" }] }),
  component: ConfirmAccess,
});

function ConfirmAccess() {
  const [sending, setSending] = useState(false);
  const { t } = useI18n();

  function submitAccess(event: SubmitEvent<HTMLFormElement>) {
    // The fragment stays out of HTTP requests until the user confirms.
    const token = event.currentTarget.elements.namedItem("token");
    if (token instanceof HTMLInputElement) token.value = window.location.hash.slice(1);
    setSending(true);
  }

  return (
    <AuthLayout>
      <AuthEyebrow>{t("auth.confirm.eyebrow")}</AuthEyebrow>
      <AuthTitle>{t("auth.confirm.title")}</AuthTitle>
      <AuthLede>{t("auth.confirm.lede")}</AuthLede>
      <form action="/auth" method="post" className="mt-2 grid gap-4" onSubmit={submitAccess}>
        <input type="hidden" name="action" value="verify" />
        <input type="hidden" name="token" />
        <button type="submit" className={authButton} disabled={sending}>
          {sending && <Loader2 className="size-4 animate-spin" />}
          {sending ? t("auth.confirm.entering") : t("auth.confirm.submit")}
        </button>
      </form>
      <AuthNote>{t("auth.confirm.note")} <Link to="/ingresar">{t("auth.confirm.requestNew")}</Link>.</AuthNote>
    </AuthLayout>
  );
}
