import { useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { fetchDirectory, shareMeta, siteOrigin } from "../catalog";

const getHome = createServerFn({ method: "GET" }).handler(async () => {
  const home = process.env.VITRINA_HOME_SHOP?.trim();
  if (home && /^[a-z0-9-]+$/.test(home)) return { home, shops: [], origin: siteOrigin() };
  return { home: "", shops: await fetchDirectory(), origin: siteOrigin() };
});

export const Route = createFileRoute("/")({
  loader: async () => {
    const data = await getHome();
    if (data.home) throw redirect({ to: "/tienda/$shop", params: { shop: data.home } });
    return data;
  },
  head: ({ loaderData }) => {
    const fonts = [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" as const },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Geist+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap",
      },
      { rel: "preload", as: "image", href: "/landing/escenario.jpg" },
    ];
    if (!loaderData) return { links: fonts };
    const meta = shareMeta({
      title: "Vitrina · Tu negocio nunca cierra",
      description: "Catálogo, citas en línea y WhatsApp en un solo enlace para negocios de El Salvador.",
      url: loaderData.origin + "/",
      image: loaderData.origin + "/landing/local.jpg",
    });
    return { ...meta, links: [...meta.links, ...fonts] };
  },
  component: Landing,
});

const Arrow = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
);

const steps = [
  ["Te abrimos la tienda", "Elegís tu enlace, como /tienda/tu-negocio, y habilitamos tu correo."],
  ["Cargás tu catálogo", "Fotos, precios, variantes y tu horario de atención, desde el celular."],
  ["Compartís el enlace", "En tu bio y tus estados. Las reservas caen solas en tu agenda."],
];

function Landing() {
  const { shops } = Route.useLoaderData();
  const firstShop = shops[0]?.slug;

  return (
    <div className="v">
      <div className="v-dark">
        <nav className="v-nav v-wrap" aria-label="Principal">
          <Link to="/" className="v-logo">vitrina</Link>
          <div className="v-nav-links">
            <a href="#funciones">Funciones</a>
            <a href="#como">Cómo funciona</a>
            <a href="#tiendas">Tiendas</a>
          </div>
          <div className="v-nav-end">
            <Link to="/ingresar" className="v-nav-login">Ingresar</Link>
            <Link to="/registrarse" className="v-btn v-btn-accent v-btn-sm">Abrir mi tienda</Link>
          </div>
        </nav>

        <section className="v-hero v-wrap">
          <p className="v-badge"><span /> Ahora con reservas en línea</p>
          <div className="v-hero-top">
            <h1>Tu negocio<br />nunca cierra.</h1>
            <div className="v-hero-side">
              <p>Catálogo, citas en línea y WhatsApp en un solo enlace. Tus clientes ven precios, reservan y te escriben mientras vos atendés.</p>
              <div className="v-actions">
                <Link className="v-btn v-btn-accent" to="/registrarse">Quiero mi vitrina <Arrow /></Link>
                {firstShop
                  ? <Link className="v-btn v-btn-ghost" to="/tienda/$shop" params={{ shop: firstShop }}>Ver una tienda</Link>
                  : <Link className="v-btn v-btn-ghost" to="/ingresar">Ya tengo tienda</Link>}
              </div>
            </div>
          </div>
          <Stage />
        </section>

        <section className="v-strip v-wrap" id="tiendas" aria-label="Tiendas en Vitrina">
          <p>Ya atienden con Vitrina</p>
          {shops.length === 0 && <span className="v-strip-empty">Pronto, las primeras tiendas.</span>}
          {shops.map((s) => (
            <Link key={s.slug} to="/tienda/$shop" params={{ shop: s.slug }}>{s.name}</Link>
          ))}
        </section>
      </div>

      <section className="v-features" id="funciones">
        <div className="v-wrap">
          <h2 className="v-h2">Todo lo que tu negocio necesita<br />para vender en línea.</h2>
          <div className="v-bento">
            <article className="v-tile v-tile-cal">
              <div className="v-tile-text">
                <p className="v-label">Citas en línea</p>
                <h3>Tus clientes reservan solos, sin cruces.</h3>
                <p className="v-muted">Horarios cada 15 minutos dentro de tu horario de atención. Cada reserva te llega al correo.</p>
              </div>
              <Calendar />
            </article>
            <article className="v-tile v-tile-wa">
              <p className="v-label">WhatsApp</p>
              <h3>Te escriben desde la ficha.</h3>
              <div className="v-chat">
                <p className="v-msg">Hola, ¿tienen espacio el jueves para manicura en gel?</p>
                <p className="v-msg v-msg-out">¡Claro! Reservá aquí a las 10:30.</p>
              </div>
            </article>
            <article className="v-tile">
              <p className="v-label">Catálogo</p>
              <h3>Variantes con su propio precio.</h3>
              <dl className="v-variants">
                <div><dt>Tamaño · A3</dt><dd>+$6.00</dd></div>
                <div><dt>Papel · Satinado</dt><dd>+$2.00</dd></div>
                <div className="v-total"><dt>Total</dt><dd>$26.00</dd></div>
              </dl>
            </article>
            <article className="v-tile">
              <p className="v-label">Vista previa</p>
              <h3>Se ve bien en cada chat.</h3>
              <div className="v-preview">
                <img src="/landing/lamina.jpg" alt="" loading="lazy" />
                <div>
                  <b>Sol de tarde · Marea Estudio</b>
                  <span>Láminas de autor impresas en San Salvador.</span>
                </div>
              </div>
            </article>
            <article className="v-tile v-tile-photo">
              <img src="/landing/local.jpg" alt="Interior de un salón de belleza" loading="lazy" />
              <h3>Tu local, también<br />abierto en línea.</h3>
            </article>
          </div>
        </div>
      </section>

      <section className="v-how v-wrap" id="como">
        <div className="v-how-intro">
          <p className="v-label">Cómo funciona</p>
          <h2 className="v-h2">De cero a tu primera cita, en una tarde.</h2>
          <p className="v-muted">Sin apps que instalar ni contraseñas. Entrás con un enlace a tu correo.</p>
        </div>
        <ol className="v-steps">
          {steps.map(([h, d], i) => (
            <li key={h}>
              <span>0{i + 1}</span>
              <h3>{h}</h3>
              <p>{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="v-wrap">
        <div className="v-cta">
          <h2>Abrí tu vitrina<br />esta semana.</h2>
          <Link className="v-btn v-btn-accent v-btn-lg" to="/registrarse">Crear mi tienda <Arrow /></Link>
        </div>
      </section>

      <footer className="v-footer v-wrap">
        <span className="v-logo">vitrina</span>
        <span>Catálogos y citas para negocios de El Salvador</span>
        <Link to="/ingresar">Acceso para vendedores</Link>
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

/** Illustrative product scene: a shop page in a browser plus the booking screen on a phone. */
function Stage() {
  const [slot, setSlot] = useState("10:30");
  return (
    <div className="v-stage">
      <div className="v-browser" aria-hidden="true">
        <div className="v-browser-bar"><i /><i /><i /><span>/tienda/luna-unas</span></div>
        <div className="v-browser-body">
          <div className="v-shop">
            <span className="v-avatar" />
            <div><b>Luna Uñas</b><small>Manicura y cuidado de uñas con cita previa</small></div>
          </div>
          <div className="v-services">
            {services.map(([n, p, img]) => (
              <div key={n}>
                <img src={`/landing/${img}.jpg`} alt="" />
                <b>{n}</b>
                <small>{p}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="v-phone" aria-label="Ejemplo de reserva">
        <small>Luna Uñas</small>
        <b>Manicura en gel</b>
        <span className="v-mono">$18.00 · 60 min</span>
        <strong>Jueves 19 nov</strong>
        <div className="v-slots">
          {slots.map((s) => (
            <button key={s} type="button" className={s === slot ? "on" : ""} aria-pressed={s === slot} onClick={() => setSlot(s)}>{s}</button>
          ))}
        </div>
        <span className="v-phone-btn">Reservar {slot}</span>
      </div>
      <div className="v-toast" aria-hidden="true">
        <span className="v-toast-icon">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4m-7 9 2 2 4-4" /></svg>
        </span>
        <div><b>Nueva cita · jue {slot}</b><small>Manicura en gel · Ana M.</small></div>
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
    <div className="v-cal">
      <div className="v-cal-head"><b>Noviembre 2026</b><span>Luna Uñas · Manicura en gel</span></div>
      <div className="v-cal-grid">
        {Array.from({ length: 14 }, (_, i) => i + 15).map((d) =>
          open(d)
            ? <button key={d} type="button" className={d === day ? "on" : ""} aria-pressed={d === day} onClick={() => setDay(d)}>{d}</button>
            : <span key={d}>{d}</span>,
        )}
      </div>
      <div className="v-cal-hours">
        {["9:00", "10:30", "11:45", "14:00"].map((h) => (
          <button key={h} type="button" className={h === hour ? "on" : ""} aria-pressed={h === hour} onClick={() => setHour(h)}>{h}</button>
        ))}
      </div>
    </div>
  );
}
