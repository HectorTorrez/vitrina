import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import css from "../style.css?url";
import { getInitialLocale, LocaleProvider, useI18n } from "../i18n";
import { htmlLang, noIndex, siteName } from "../seo";

/** Inter (text), Bricolage Grotesque (Vitrina), Fraunces (serif store themes), Geist Mono. */
const fonts = [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" as const },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=DM+Sans:wght@500;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Geist+Mono:wght@400;500&family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap",
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
    beforeLoad: async () => ({ locale: await getInitialLocale() }),
    head: () => ({
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: siteName },
        noIndex,
      ],
      links: [
        { rel: "icon", type: "image/png", sizes: "192x192", href: "/favicon.png" },
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
        ...fonts,
        { rel: "stylesheet", href: css },
      ],
    }),
    component: RootDocument,
    notFoundComponent: NotFound,
    errorComponent: ErrorView,
  },
);

function RootDocument() {
  const { locale } = Route.useRouteContext();
  return (
    <html lang={htmlLang(locale)}>
      <head>
        <HeadContent />
      </head>
      <body>
        <LocaleProvider initialLocale={locale}>
          <Outlet />
        </LocaleProvider>
        <Scripts />
      </body>
    </html>
  );
}

function NotFound() {
  const { t } = useI18n();
  return (
    <Message title={t("common.notFoundTitle")}>
      <p className="text-muted-foreground">{t("common.notFoundDesc")}</p>
      <Link to="/" className={buttonClass}>{t("common.backHome")}</Link>
    </Message>
  );
}

function ErrorView({ reset }: { reset: () => void }) {
  const { t } = useI18n();
  return (
    <Message title={t("common.errorTitle")}>
      <p className="text-muted-foreground">{t("common.errorDesc")}</p>
      <button onClick={reset} className={buttonClass}>{t("common.retry")}</button>
    </Message>
  );
}
