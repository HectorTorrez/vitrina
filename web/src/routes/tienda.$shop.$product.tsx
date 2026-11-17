import { StoreLayout } from "../StoreLayout";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { shopQuery, price, productImage, type Product } from "../catalog";
export const Route = createFileRoute("/tienda/$shop/$product")({
  loader: async ({ context, params }) => {
    const shop = await context.queryClient.ensureQueryData(
      shopQuery(params.shop),
    );
    if (!shop.products.some((p) => p.slug === params.product)) throw notFound();
    return shop;
  },
  component: Details,
});
function Details() {
  const params = Route.useParams();
  const { data } = useQuery({
    ...shopQuery(params.shop),
    initialData: Route.useLoaderData(),
  });
  const p = data.products.find((item) => item.slug === params.product);
  if (!p) throw notFound();
  return (
    <StoreLayout shop={data}>
      <Link to="/tienda/$shop" params={{ shop: params.shop }}>
        ‹ Catálogo
      </Link>
      <div className="detail">
        {productImage(p) && (
          <img
            className="poster"
            src={productImage(p)}
            referrerPolicy="no-referrer"
            alt={p.name}
          />
        )}
        <Order key={p.slug} product={p} phone={data.whatsapp} />
      </div>
    </StoreLayout>
  );
}
function Order({ product, phone }: { product: Product; phone: string }) {
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [showMessage, setShowMessage] = useState(false);
  const service = product.kind === "service";
  const message = [
    (service
      ? "Hola, quisiera consultar horarios para "
      : "Hola, quisiera pedir ") + product.name,
    ...(product.options ?? []).map(
      (o) => o.name + " · " + (choices[o.name] ?? o.values[0]),
    ),
    "Total · " + price(product.priceCents),
  ].join("\n");
  return (
    <section>
      <h1>{product.name}</h1>
      {service && (
        <p>{product.durationMinutes} min · El negocio confirma tu cita.</p>
      )}
      <p className="price">{price(product.priceCents)}</p>
      {(product.options ?? []).map((o) => (
        <fieldset key={o.name}>
          <legend>{o.name}</legend>
          {o.values.map((v) => (
            <label key={v}>
              <input
                type="radio"
                name={o.name}
                checked={(choices[o.name] ?? o.values[0]) === v}
                onChange={() => setChoices({ ...choices, [o.name]: v })}
              />
              {v}
            </label>
          ))}
        </fieldset>
      ))}
      {product.available ? (
        phone ? (
          <a
            className="action"
            href={
              "https://wa.me/" + phone + "?text=" + encodeURIComponent(message)
            }
          >
            {service
              ? "Consultar horarios por WhatsApp ↗"
              : "Pedir por WhatsApp ↗"}
          </a>
        ) : (
          <>
            <button onClick={() => setShowMessage(true)}>
              {service ? "Preparar consulta" : "Preparar pedido"}
            </button>
            {showMessage && (
              <div role="status">
                <p>Mensaje · tienda de muestra</p>
                <pre>{message}</pre>
              </div>
            )}
          </>
        )
      ) : (
        <p>No disponible</p>
      )}
    </section>
  );
}
