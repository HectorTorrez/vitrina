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
  head: ({ loaderData }) => loaderData ? shareMeta({
    title: "Vitrina · Tiendas",
    description: "Catálogos de productos y servicios de negocios locales.",
    url: loaderData.origin + "/",
  }) : {},
  component: Directory,
});

function Directory() {
  const { shops } = Route.useLoaderData();
  return (
    <div className="store" data-theme="costa">
      <header><b>vitrina.</b><span>Tiendas</span></header>
      <main>
        <section className="intro">
          <h1>Tiendas en Vitrina</h1>
          <p>Elegí una tienda para ver su catálogo.</p>
        </section>
        {shops.length === 0 && <p>Todavía no hay tiendas publicadas.</p>}
        <div className="grid">
          {shops.map((shop) => (
            <Link className="card" key={shop.slug} to="/tienda/$shop" params={{ shop: shop.slug }}>
              <h3>{shop.name}</h3>
              <p>{shop.description}</p>
              <span>{shop.products.length} {shop.products.length === 1 ? "opción" : "opciones"}</span>
            </Link>
          ))}
        </div>
      </main>
      <footer className="store-footer"><Link to="/ingresar">Acceso para vendedores</Link></footer>
    </div>
  );
}
