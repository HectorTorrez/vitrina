import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import css from "../style.css?url";

/** Shared fonts: Inter (text), Bricolage Grotesque (Vitrina), Fraunces (serif store themes), Geist Mono. */
export const fonts = [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" as const },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Geist+Mono:wght@400;500&family=Inter:wght@400;500;600;700&display=swap",
  },
];

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-svh place-items-center bg-background px-4">
      <div className="grid max-w-md justify-items-center gap-5 text-center">
        <Link to="/" className="font-display text-2xl font-bold tracking-tighter">vitrina</Link>
        <h1 className="font-display text-4xl font-bold tracking-tight">{title}</h1>
        {children}
      </div>
    </main>
  );
}

const buttonClass = "inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: "Vitrina" },
      ],
      links: [...fonts, { rel: "stylesheet", href: css }],
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
      <Message title="Página no encontrada">
        <p className="text-muted-foreground">El enlace no existe o la ficha ya no está publicada.</p>
        <Link to="/" className={buttonClass}>Volver al inicio</Link>
      </Message>
    ),
    errorComponent: ({ reset }) => (
      <Message title="Algo salió mal">
        <p className="text-muted-foreground">No pudimos cargar esta página. Probá de nuevo en un momento.</p>
        <button onClick={reset} className={buttonClass}>Reintentar</button>
      </Message>
    ),
  },
);
