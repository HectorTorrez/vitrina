import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import css from "../style.css?url";
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: "Vitrina · Tienda" },
      ],
      links: [{ rel: "stylesheet", href: css }],
    }),
    component: () => (
      <html lang="es">
        <head>
          <HeadContent />
        </head>
        <body>
          <Outlet />
          <Scripts />
        </body>
      </html>
    ),
    notFoundComponent: () => (
      <main>
        <h1>Página no encontrada</h1>
        <Link to="/">Volver a la tienda</Link>
      </main>
    ),
    errorComponent: ({ reset }) => (
      <main>
        <h1>No se pudo cargar la tienda</h1>
        <button onClick={reset}>Reintentar</button>
      </main>
    ),
  },
);
