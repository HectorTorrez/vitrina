import { StoreLayout } from "../StoreLayout";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { shopQuery, price, productImage, shareMeta } from "../catalog";
export const Route = createFileRoute("/tienda/$shop/")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(shopQuery(params.shop)),
  head: ({ loaderData, params }) => {
    if (!loaderData) return {};
    const first = loaderData.products.map(productImage).find(Boolean);
    return shareMeta({
      title: loaderData.name + " · Vitrina",
      description: loaderData.description || "Catálogo de " + loaderData.name,
      url: loaderData.origin + "/tienda/" + params.shop,
      image: first && new URL(first, loaderData.origin).href,
    });
  },
  component: Catalog,
});
function Catalog() {
  const { shop } = Route.useParams();
  const { data } = useQuery({
    ...shopQuery(shop),
    initialData: Route.useLoaderData(),
  });
  return (
    <StoreLayout shop={data}>
      <section className="intro">
        <h1>{data.name}</h1>
        <p>{data.description}</p>
        <nav aria-label="Redes sociales">
          {data.instagram && (
            <a
              href={
                "https://instagram.com/" + encodeURIComponent(data.instagram)
              }
            >
              Instagram ↗
            </a>
          )}
          {data.tiktok && (
            <a href={"https://tiktok.com/@" + encodeURIComponent(data.tiktok)}>
              TikTok ↗
            </a>
          )}
        </nav>
      </section>
      <div className="heading">
        <h2>Catálogo</h2>
        <span>
          {data.products.length}{" "}
          {data.products.length === 1 ? "opción" : "opciones"}
        </span>
      </div>
      <div className="grid">
        {data.products.map((p) => (
          <Link
            className="card"
            key={p.slug}
            to="/tienda/$shop/$product"
            params={{ shop, product: p.slug }}
          >
            {productImage(p) && <img src={productImage(p)} alt="" loading="lazy" referrerPolicy="no-referrer" />}
            {p.kind === "service" && (
              <small>Servicio · {p.durationMinutes} min</small>
            )}
            <h3>{p.name}</h3>
            <span>{p.available ? price(p.priceCents) : "No disponible"}</span>
          </Link>
        ))}
      </div>
    </StoreLayout>
  );
}
