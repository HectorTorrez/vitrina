import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { getSeller } from "../auth";

type Status = "enviado" | "correo" | "enlace" | "servicio";

const messages: Record<Status, string> = {
  enviado: "Si tu correo está habilitado, vas a recibir un enlace de acceso. Revisá también la carpeta de spam.",
  correo: "Ingresá un correo electrónico válido.",
  enlace: "El enlace venció, ya se usó o es inválido. Pedí otro para ingresar.",
  servicio: "No se pudo procesar la solicitud. Intentá de nuevo en unos minutos.",
};

export const Route = createFileRoute("/ingresar")({
  validateSearch: (search: Record<string, unknown>): { estado?: Status } => ({
    estado: typeof search.estado === "string" && Object.hasOwn(messages, search.estado)
      ? (search.estado as Status)
      : undefined,
  }),
  beforeLoad: async () => {
    if (await getSeller()) throw redirect({ to: "/panel" });
  },
  headers: () => ({ "Cache-Control": "private, no-store" }),
  component: Login,
});

function Login() {
  const { estado } = Route.useSearch();
  return (
    <main className="seller-access">
      <Link to="/">vitrina.</Link>
      <h1>Acceso para vendedores</h1>
      {estado && (
        <p role={estado === "enviado" ? "status" : "alert"}>{messages[estado]}</p>
      )}
      <form action="/auth" method="post">
        <input type="hidden" name="action" value="link" />
        <label>
          Correo electrónico
          <input type="email" name="email" autoComplete="email" maxLength={254} required />
        </label>
        <button type="submit">Enviarme un enlace</button>
      </form>
    </main>
  );
}
