import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { getSeller } from "../auth";

export const Route = createFileRoute("/panel")({
  beforeLoad: async () => {
    const seller = await getSeller();
    if (!seller) throw redirect({ to: "/ingresar" });
    return { seller };
  },
  headers: () => ({ "Cache-Control": "private, no-store" }),
  component: Panel,
});

function Panel() {
  const { seller } = Route.useRouteContext();
  return (
    <main className="seller-access">
      <Link to="/">vitrina.</Link>
      <h1>Panel de vendedor</h1>
      <p>Sesión iniciada como {seller.email}</p>
      <form action="/auth" method="post">
        <button type="submit" name="action" value="logout">Cerrar sesión</button>
      </form>
    </main>
  );
}
