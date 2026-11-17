import { createFileRoute, Link } from "@tanstack/react-router";
import type { SubmitEvent } from "react";

export const Route = createFileRoute("/confirmar-acceso")({
  headers: () => ({
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
  }),
  component: ConfirmAccess,
});

function submitAccess(event: SubmitEvent<HTMLFormElement>) {
  // The fragment stays out of HTTP requests until the user confirms.
  const token = event.currentTarget.elements.namedItem("token");
  if (token instanceof HTMLInputElement) token.value = window.location.hash.slice(1);
}

function ConfirmAccess() {
  return (
    <main className="seller-access">
      <h1>Confirmá tu acceso a Vitrina</h1>
      <form action="/auth" method="post" onSubmit={submitAccess}>
        <input type="hidden" name="action" value="verify" />
        <input type="hidden" name="token" />
        <button type="submit">Entrar al panel</button>
      </form>
      <p><Link to="/ingresar">Pedir otro enlace</Link></p>
    </main>
  );
}
