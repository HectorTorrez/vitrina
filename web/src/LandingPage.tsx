import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";
import { configuredHomeShop, siteOrigin } from "./api";
import { fetchDirectory, type DirectoryEntry } from "./catalog";
import { LanguageSwitcher, useI18n, type Locale } from "./i18n";
import { htmlLang, pageHead, siteDescriptionFor, siteName } from "./seo";

export const getHome = createServerFn({ method: "GET" }).handler(async () => {
  const home = configuredHomeShop();
  if (home) return { home, shops: [] as DirectoryEntry[], origin: siteOrigin() };
  return { home: "", shops: await fetchDirectory(), origin: siteOrigin() };
});

export function landingHead(origin: string, locale: Locale) {
  const preload = [{ rel: "preload", as: "image", href: "/landing/escenario.jpg" }];
  const esUrl = origin + "/";
  const enUrl = origin + "/en";
  const url = locale === "en" ? enUrl : esUrl;
  const description = siteDescriptionFor(locale);
  const title = locale === "en"
    ? "Vitrina · Online catalogs and bookings for local businesses"
    : "Vitrina · Catálogos y citas en línea en El Salvador";
  const meta = pageHead({
    title,
    description,
    url,
    image: origin + "/landing/local.jpg",
    locale,
    alternateLocales: [locale === "en" ? "es" : "en"],
    alternates: [
      { hrefLang: "es", href: esUrl },
      { hrefLang: "en", href: enUrl },
      { hrefLang: "x-default", href: esUrl },
    ],
    structuredData: {
      "@graph": [
        { "@type": "WebSite", url, name: siteName, description, inLanguage: htmlLang(locale) },
        {
          "@type": "Service",
          url,
          name: siteName,
          description,
          serviceType: locale === "en" ? "Online catalogs and appointment bookings" : "Catálogos y citas en línea",
          areaServed: { "@type": "Country", name: "El Salvador" },
        },
      ],
    },
  });
  return { ...meta, links: [...meta.links, ...preload] };
}

const Arrow = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
);

const wrap = "mx-auto w-[min(100%-32px,1312px)] md:w-[min(100%-48px,1312px)] xl:w-[min(100%-128px,1312px)]";
const btn = "inline-flex items-center gap-2 rounded-full font-semibold whitespace-nowrap transition active:scale-[0.98]";
const btnAccent = cn(btn, "bg-brand px-6 py-[15px] text-ink-dark hover:bg-[#ffb088]");
const btnGhost = cn(btn, "border border-[#3a3a3a] px-6 py-[15px] font-medium text-white hover:border-[#6b6b6b]");
const label = "font-mono text-xs leading-none font-medium tracking-[0.1em] text-brand-ink uppercase";
const h2 = "font-display text-[clamp(36px,4.5vw,56px)] leading-none font-bold tracking-[-0.04em]";
const tile = "flex flex-col gap-4 overflow-hidden rounded-lg border bg-white p-6 md:min-h-[380px] md:p-8";
const tileTitle = "font-display text-[28px] leading-[1.05] font-semibold tracking-[-0.03em] md:text-[34px]";

export function LandingPage({ shops, routeLocale }: { shops: DirectoryEntry[]; routeLocale: Locale }) {
  const { locale, setLocale, t } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    if (locale !== routeLocale) setLocale(routeLocale);
  }, [locale, routeLocale, setLocale]);

  const firstShop = shops[0]?.slug;
  const localizedSteps = [
    [t("landing.how.step1.title"), t("landing.how.step1.desc")],
    [t("landing.how.step2.title"), t("landing.how.step2.desc")],
    [t("landing.how.step3.title"), t("landing.how.step3.desc")],
  ];

  return (
    <div className="overflow-x-clip bg-white text-[#111] antialiased">
      <div className="bg-ink-dark text-white">
        <nav className={cn(wrap, "grid grid-cols-[1fr_auto] items-center py-6 md:grid-cols-[1fr_auto_1fr]")} aria-label={routeLocale === "en" ? "Main" : "Principal"}>
          <Link to={routeLocale === "en" ? "/en" : "/"} className="font-display text-[26px] leading-none font-bold tracking-[-0.035em]">vitrina</Link>
          <div className="hidden gap-8 text-[15px] text-neutral-400 md:flex [&_a:hover]:text-white">
            <a href="#funciones">{t("landing.nav.features")}</a>
            <a href="#como">{t("landing.nav.how")}</a>
          </div>
          <div className="flex items-center justify-end gap-3 text-[15px] sm:gap-4">
            <LanguageSwitcher
              variant="dark"
              onSelect={(next) => {
                void navigate({ to: next === "en" ? "/en" : "/" });
              }}
            />
            <Link to="/ingresar" className="hover:text-neutral-300">{t("landing.nav.login")}</Link>
            <Link to="/registrarse" className={cn(btnAccent, "px-[18px] py-2.5 text-sm")}>{t("landing.nav.openShop")}</Link>
          </div>
        </nav>

        <section className={cn(wrap, "pt-10 pb-16 md:pt-18 md:pb-24")}>
          <div className="mb-7 flex flex-col items-start gap-12 lg:flex-row lg:items-end lg:justify-between">
            <h1 className="font-display text-[clamp(64px,9.2vw,132px)] leading-[0.9] font-bold tracking-[-0.045em]">{t("landing.hero.title1")}<br />{t("landing.hero.title2")}</h1>
            <div className="grid max-w-[560px] gap-6 lg:max-w-none lg:shrink-0 lg:basis-[440px]">
              <p className="text-lg text-neutral-400">{t("landing.hero.desc")}</p>
              <div className="flex flex-wrap gap-3">
                <Link className={btnAccent} to="/registrarse">{t("landing.hero.cta")} <Arrow /></Link>
                {firstShop
                  ? <Link className={btnGhost} to="/tienda/$shop" params={{ shop: firstShop }}>{t("landing.hero.viewShop")}</Link>
                  : <Link className={btnGhost} to="/ingresar">{t("landing.hero.haveShop")}</Link>}
              </div>
            </div>
          </div>
          <Stage />
        </section>
      </div>

      <section className="bg-background pt-18 pb-14 md:pt-30" id="funciones">
        <div className={wrap}>
          <h2 className={cn(h2, "mb-14 md:text-[clamp(36px,4.5vw,64px)]")}>{t("landing.features.title1")}<br className="hidden md:block" /> {t("landing.features.title2")}</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <article className={cn(tile, "md:col-span-2 md:min-h-[320px] lg:flex-row lg:gap-10 xl:col-span-4")}>
              <div className="grid content-start gap-4 lg:basis-[340px] lg:shrink-0">
                <p className={label}>{t("landing.features.booking.label")}</p>
                <h3 className={tileTitle}>{t("landing.features.booking.title")}</h3>
                <p className="text-muted-foreground">{t("landing.features.booking.desc")}</p>
              </div>
              <Calendar />
            </article>
            <article className={cn(tile, "border-[#12301f] bg-[#12301f] text-white md:min-h-[320px] xl:col-span-2")}>
              <p className={cn(label, "text-brand")}>WhatsApp</p>
              <h3 className={tileTitle}>{t("landing.features.wa.title")}</h3>
              <div className="grid gap-3 text-sm leading-snug">
                <p className="max-w-[300px] rounded-[10px] bg-[#1f4a31] px-3.5 py-3">{t("landing.features.wa.msg1")}</p>
                <p className="max-w-[260px] justify-self-end rounded-[10px] bg-[#25d366] px-3.5 py-3 text-[#06210f]">{t("landing.features.wa.msg2")}</p>
              </div>
            </article>
            <article className={cn(tile, "xl:col-span-2")}>
              <p className={label}>{t("landing.features.catalog.label")}</p>
              <h3 className={tileTitle}>{t("landing.features.catalog.title")}</h3>
              <dl className="[&>div]:flex [&>div]:items-baseline [&>div]:justify-between [&>div]:border-t [&>div]:py-3.5 [&>div]:text-[15px]">
                <div><dt>Tamaño · A3</dt><dd className="font-mono text-sm text-brand-ink">+$6.00</dd></div>
                <div><dt>Papel · Satinado</dt><dd className="font-mono text-sm text-brand-ink">+$2.00</dd></div>
                <div><dt className="font-semibold">Total</dt><dd className="font-display text-2xl font-bold">$26.00</dd></div>
              </dl>
            </article>
            <article className={cn(tile, "xl:col-span-2")}>
              <p className={label}>{t("landing.features.preview.label")}</p>
              <h3 className={tileTitle}>{t("landing.features.preview.title")}</h3>
              <div className="overflow-hidden rounded-lg bg-background">
                <img src="/landing/lamina.jpg" alt="" loading="lazy" className="h-[110px] w-full object-cover" />
                <div className="grid gap-0.5 px-3.5 py-3 text-[13px]">
                  <b className="text-sm">Sol de tarde · Marea Estudio</b>
                  <span className="text-muted-foreground">Láminas de autor impresas en San Salvador.</span>
                </div>
              </div>
            </article>
            <article className={cn(tile, "relative min-h-[340px] justify-end border-0 p-7 text-white md:p-7 xl:col-span-2")}>
              <img src="/landing/local.jpg" alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
              <div className="absolute inset-x-0 top-[45%] bottom-0 bg-linear-to-b from-transparent to-black/80" />
              <h3 className="relative font-display text-[26px] leading-[1.05] font-bold tracking-[-0.03em]">{t("landing.features.local.title1")}<br />{t("landing.features.local.title2")}</h3>
            </article>
          </div>
        </div>
      </section>

      <section className={cn(wrap, "flex flex-col gap-12 py-22 lg:flex-row lg:gap-20 lg:py-30")} id="como">
        <div className="grid max-w-[560px] content-start gap-4 lg:shrink-0 lg:basis-[440px]">
          <p className={label}>{t("landing.how.label")}</p>
          <h2 className={h2}>{t("landing.how.title")}</h2>
          <p className="text-muted-foreground">{t("landing.how.desc")}</p>
        </div>
        <ol className="w-full flex-1">
          {localizedSteps.map(([title, text], i) => (
            <li key={title} className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 border-t py-7 last:border-b md:grid-cols-[auto_280px_1fr] md:gap-8">
              <span className="pt-1.5 font-mono text-[13px] text-brand-ink">0{i + 1}</span>
              <h3 className="font-display text-[26px] leading-[1.15] font-semibold tracking-[-0.025em]">{title}</h3>
              <p className="col-start-2 text-muted-foreground md:col-start-auto">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={wrap}>
        <div className="mb-16 flex flex-wrap items-end justify-between gap-8 rounded-lg bg-ink-dark px-6 py-12 text-white md:px-16 md:py-18">
          <h2 className="font-display text-[clamp(48px,6.7vw,96px)] leading-[0.92] font-bold tracking-[-0.045em]">{t("landing.cta.title1")}<br />{t("landing.cta.title2")}</h2>
          <Link className={cn(btnAccent, "px-7 py-[18px] text-[17px]")} to="/registrarse">{t("landing.cta.btn")} <Arrow /></Link>
        </div>
      </section>

      <footer className={cn(wrap, "flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t pt-7 pb-10 text-sm text-muted-foreground")}>
        <span className="font-display text-[22px] font-bold tracking-[-0.035em] text-[#111]">vitrina</span>
        <span>{t("landing.footer.tagline")}</span>
        <Link to="/ingresar" className="text-[#111] underline underline-offset-4">{t("landing.footer.sellerAccess")}</Link>
      </footer>
    </div>
  );
}

const services = [
  ["Manicura en gel", "$18.00 · 60 min", "manicura"],
  ["Pedicura spa", "$22.00 · 75 min", "pedicura"],
  ["Retiro de gel", "$8.00 · 30 min", "retiro"],
];
const slots = ["9:00", "9:15", "10:30", "11:45", "14:00", "15:15"];
const slotButton = "rounded-lg border bg-white py-2.5 text-[13px] font-medium text-[#111] hover:border-neutral-400";

/** Illustrative product scene: a shop page in a browser plus the booking screen on a phone. */
function Stage() {
  const [slot, setSlot] = useState("10:30");
  return (
    <div className="relative h-[560px] overflow-hidden rounded-lg bg-[#2a2a2a] bg-[linear-gradient(rgb(17_17_17/0.55),rgb(17_17_17/0.55)),url(/landing/escenario.jpg)] bg-cover bg-center text-[#111] md:h-[660px] md:bg-[linear-gradient(rgb(17_17_17/0.2),rgb(17_17_17/0.2)),url(/landing/escenario.jpg)]">
      <div className="absolute top-20 left-[4%] hidden h-[620px] w-[72%] overflow-hidden rounded-xl bg-white shadow-[0_24px_64px_rgb(0_0_0/0.18)] md:block xl:left-[9.1%] xl:w-[62.5%]" aria-hidden="true">
        <div className="flex items-center gap-2 bg-neutral-100 px-4 py-3">
          <i className="size-2.5 rounded-full bg-[#ff5f57]" /><i className="size-2.5 rounded-full bg-[#febc2e]" /><i className="size-2.5 rounded-full bg-[#28c840]" />
          <span className="mr-11 flex-1 text-center font-mono text-xs text-muted-foreground">/tienda/luna-unas</span>
        </div>
        <div className="grid gap-5 px-8 py-7">
          <div className="flex items-center gap-3">
            <span className="size-11 rounded-full bg-[#f6dfcc]" />
            <div><b className="block text-xl font-semibold">Luna Uñas</b><small className="block text-[13px] text-muted-foreground">Manicura y cuidado de uñas con cita previa</small></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {services.map(([n, p, img]) => (
              <div key={n}>
                <img src={`/landing/${img}.jpg`} alt="" className="mb-2.5 h-[180px] w-full rounded-lg object-cover" />
                <b className="text-[15px] font-medium">{n}</b>
                <small className="mt-0.5 block font-mono text-xs text-muted-foreground">{p}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="absolute top-10 left-1/2 -ml-[150px] flex w-[300px] flex-col gap-3.5 rounded-[36px] border-8 border-[#111] bg-white px-5 pt-7 pb-6 shadow-[0_24px_64px_rgb(0_0_0/0.18)] md:top-[110px] md:right-[4%] md:left-auto md:ml-0 md:h-[600px] xl:right-auto xl:left-[67%]" aria-label="Ejemplo de reserva">
        <small className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">Luna Uñas</small>
        <b className="text-2xl leading-[1.1] font-semibold tracking-[-0.025em]">Manicura en gel</b>
        <span className="font-mono text-xs text-muted-foreground">$18.00 · 60 min</span>
        <strong className="text-[13px]">Jueves 19 nov</strong>
        <div className="grid grid-cols-2 gap-2">
          {slots.map((s) => (
            <button key={s} type="button" aria-pressed={s === slot} onClick={() => setSlot(s)}
              className={cn(slotButton, s === slot && "border-brand bg-brand hover:border-brand")}>{s}</button>
          ))}
        </div>
        <span className="rounded-full bg-[#111] p-3 text-center text-sm font-medium text-white">Reservar {slot}</span>
      </div>
      <div className="absolute bottom-6 left-3 flex animate-pop items-center gap-3 rounded-xl bg-white px-[18px] py-3.5 shadow-[0_1px_3px_rgb(0_0_0/0.04),0_24px_64px_rgb(0_0_0/0.12)] motion-reduce:animate-none md:top-[470px] md:bottom-auto md:left-[4.5%]" aria-hidden="true">
        <span className="grid size-9 place-items-center rounded-full bg-green-100 text-green-600">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4m-7 9 2 2 4-4" /></svg>
        </span>
        <div className="text-sm"><b className="block font-semibold">Nueva cita · jue {slot}</b><small className="block text-[13px] text-muted-foreground">Manicura en gel · Ana M.</small></div>
      </div>
    </div>
  );
}

/** Two sample weeks of November 2026 (the 1st is a Sunday; the sample shop opens Tue–Sat). */
function Calendar() {
  const [day, setDay] = useState(19);
  const [hour, setHour] = useState("10:30");
  const open = (d: number) => d >= 18 && d % 7 !== 1 && d % 7 !== 2;
  return (
    <div className="grid flex-1 content-start gap-2">
      <div className="flex justify-between gap-3 pb-2 text-[15px]">
        <b>Noviembre 2026</b><span className="hidden text-[13px] text-muted-foreground md:inline">Luna Uñas · Manicura en gel</span>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 14 }, (_, i) => i + 15).map((d) =>
          open(d)
            ? <button key={d} type="button" aria-pressed={d === day} onClick={() => setDay(d)}
                className={cn("grid h-10 place-items-center rounded-md bg-[#f1f1ef] text-[15px] font-medium hover:bg-[#e6e6e3] md:h-13", d === day && "bg-brand hover:bg-brand")}>{d}</button>
            : <span key={d} className="grid h-10 place-items-center text-[15px] font-medium text-neutral-300 md:h-13">{d}</span>,
        )}
      </div>
      <div className="grid grid-cols-4 gap-2 pt-3">
        {["9:00", "10:30", "11:45", "14:00"].map((h) => (
          <button key={h} type="button" aria-pressed={h === hour} onClick={() => setHour(h)}
            className={cn(slotButton, h === hour && "border-brand bg-accent text-brand-ink")}>{h}</button>
        ))}
      </div>
    </div>
  );
}
