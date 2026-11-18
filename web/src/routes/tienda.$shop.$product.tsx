import { useState, type ReactNode } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Clock, Share2 } from "lucide-react";
import { acceptsBookings, shopQuery, price, productImage, totalPrice, type Product } from "../catalog";
import { pageHead, siteLanguage } from "../seo";
import { PublicBooking } from "../PublicBooking";
import { StoreLayout } from "../store/StoreLayout";
import { ProductCard, ProductImage, WhatsAppIcon } from "../store/StoreParts";
import { cn } from "@/lib/utils";
import { useCopied } from "@/lib/useCopied";

export const Route = createFileRoute("/tienda/$shop/$product")({
  loader: async ({ context, params }) => {
    const shop = await context.queryClient.ensureQueryData(shopQuery(params.shop));
    if (!shop.products.some((p) => p.slug === params.product)) throw notFound();
    return shop;
  },
  head: ({ loaderData, params }) => {
    const p = loaderData?.products.find((item) => item.slug === params.product);
    if (!loaderData || !p) return {};
    const { name, origin } = loaderData;
    const shopUrl = origin + "/tienda/" + params.shop;
    const url = shopUrl + "/" + p.slug;
    const path = productImage(p);
    const image = path && new URL(path, origin).href;
    const service = p.kind === "service";
    const displayedPrice = totalPrice(p);
    const description = [
      p.name + " · " + (service ? "Servicio" : "Producto") + " de " + name,
      ...(service ? [p.durationMinutes + " min"] : []),
      p.available ? price(displayedPrice) : "No disponible",
    ].join(" · ");
    const offer = p.available ? {
      "@type": "Offer", url, price: (displayedPrice / 100).toFixed(2), priceCurrency: "USD",
      ...(!service ? { availability: "https://schema.org/InStock" } : {}),
    } : undefined;
    return pageHead({
      title: p.name + " · " + name,
      description,
      url,
      image,
      structuredData: {
        "@graph": [
          {
            "@type": "WebPage", url, name: p.name, description, inLanguage: siteLanguage,
            mainEntity: { "@id": url + "#ficha" },
            breadcrumb: { "@id": url + "#ruta" },
          },
          {
            "@type": service ? "Service" : "Product",
            "@id": url + "#ficha",
            name: p.name,
            url,
            description,
            image,
            offers: offer,
            ...(service ? { provider: { "@type": "Organization", name, url: shopUrl } } : {}),
          },
          {
            "@type": "BreadcrumbList",
            "@id": url + "#ruta",
            itemListElement: [
              { "@type": "ListItem", position: 1, name, item: shopUrl },
              { "@type": "ListItem", position: 2, name: p.name, item: url },
            ],
          },
        ],
      },
    });
  },
  component: Details,
});

function Details() {
  const params = Route.useParams();
  const { data } = useQuery({ ...shopQuery(params.shop), initialData: Route.useLoaderData() });
  const p = data.products.find((item) => item.slug === params.product);
  if (!p) throw notFound();
  const bookable = p.kind === "service" && p.available && acceptsBookings(data);
  const others = data.products.filter((item) => item.slug !== p.slug).slice(0, 4);
  const url = data.origin + "/tienda/" + params.shop + "/" + p.slug;

  return (
    <StoreLayout shop={data} slug={params.shop}>
      <div className="flex items-center justify-between gap-3 pt-6 pb-4">
        <Link to="/tienda/$shop" params={{ shop: params.shop }} className="inline-flex h-9 items-center gap-1.5 rounded-full pr-3 pl-2 text-sm font-medium transition hover:bg-store-soft">
          <ArrowLeft className="size-4" /> Catálogo
        </Link>
        <ShareButton url={url} title={p.name} />
      </div>
      <div className={cn("grid gap-8 @3xl:gap-12", "@3xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]")}>
        <div className="@3xl:sticky @3xl:top-24 @3xl:self-start">
          <div className="aspect-[4/5] overflow-hidden rounded-3xl bg-store-soft @3xl:aspect-square">
            <ProductImage product={p} />
          </div>
        </div>
        <Order key={p.slug} product={p} phone={data.whatsapp}
          booking={bookable ? <PublicBooking shop={params.shop} service={p} /> : null} />
      </div>

      {others.length > 0 && (
        <section className="mt-20 grid gap-6 border-t border-store-rule pt-10">
          <h2 className="font-store text-3xl tracking-tight">También te puede interesar</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 @3xl:grid-cols-4 @3xl:gap-x-6">
            {others.map((item) => (
              <Link key={item.slug} to="/tienda/$shop/$product" params={{ shop: params.shop, product: item.slug }}>
                <ProductCard product={item} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </StoreLayout>
  );
}

function ShareButton({ url, title }: { url: string; title: string }) {
  const [copied, copy] = useCopied(2000);
  async function share() {
    if (navigator.share) await navigator.share({ title, url }).catch(() => undefined);
    else await copy(url).catch(() => undefined);
  }
  return (
    <button type="button" onClick={() => void share()} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-store-rule px-3.5 text-sm font-medium transition hover:border-store-ink">
      {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
      {copied ? "Enlace copiado" : "Compartir"}
    </button>
  );
}

function Order({ product, phone, booking }: { product: Product; phone: string; booking: ReactNode }) {
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [showMessage, setShowMessage] = useState(false);
  const service = product.kind === "service";
  const total = totalPrice(product, choices);
  const options = product.options;
  const message = [
    (service ? "Hola, quisiera consultar horarios para " : "Hola, quisiera pedir ") + product.name,
    ...options.map((o) => o.name + " · " + (choices[o.name] ?? o.values[0])),
    "Total · " + price(total),
  ].join("\n");

  return (
    <section className="grid content-start gap-7">
      <div className="grid gap-3">
        <p className="text-sm font-medium tracking-wide text-store-muted uppercase">{service ? "Servicio" : "Producto"}</p>
        <h1 className="font-store text-[clamp(2.2rem,6cqw,3.75rem)] leading-[1.05] font-medium tracking-[-0.03em]">{product.name}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-mono text-2xl font-medium" aria-live="polite">{product.available ? price(total) : "No disponible"}</p>
          {service && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-store-soft px-3 py-1 text-sm font-medium">
              <Clock className="size-3.5" /> {product.durationMinutes} min
            </span>
          )}
        </div>
        {service && !booking && product.available && <p className="text-store-muted">El negocio confirma tu cita por WhatsApp.</p>}
      </div>

      {options.map((o) => (
        <fieldset key={o.name} className="grid gap-3">
          <legend className="mb-3 flex w-full items-baseline justify-between text-sm font-semibold">
            {o.name}
            <span className="font-normal text-store-muted">{choices[o.name] ?? o.values[0]}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {o.values.map((v, i) => {
              const checked = (choices[o.name] ?? o.values[0]) === v;
              const extra = o.prices?.[i] ?? 0;
              return (
                <label key={v} className={cn(
                  "relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-store-ink",
                  checked ? "border-store-ink bg-store-ink text-store-bg" : "border-store-rule bg-store-surface hover:border-store-ink",
                )}>
                  <input type="radio" name={o.name} className="sr-only" checked={checked} onChange={() => setChoices({ ...choices, [o.name]: v })} />
                  {v}
                  {extra > 0 && <span className={cn("font-mono text-xs", checked ? "opacity-75" : "text-store-muted")}>+{price(extra)}</span>}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      {booking}

      {product.available ? (
        phone ? (
          <a
            className={cn(
              "flex h-13 items-center justify-center gap-2 rounded-full px-6 font-semibold transition",
              booking ? "border border-store-rule hover:border-store-ink" : "bg-store-accent text-store-accent-ink hover:opacity-90",
            )}
            href={"https://wa.me/" + phone + "?text=" + encodeURIComponent(message)} target="_blank" rel="noreferrer"
          >
            <WhatsAppIcon className="size-5" />
            {service
              ? (booking ? "¿Dudas? Consultá por WhatsApp" : "Consultar horarios por WhatsApp")
              : "Pedir por WhatsApp · " + price(total)}
          </a>
        ) : booking ? null : (
          <div className="grid gap-3">
            <button type="button" onClick={() => setShowMessage(true)} className="h-13 rounded-full bg-store-accent px-6 font-semibold text-store-accent-ink transition hover:opacity-90">
              {service ? "Preparar consulta" : "Preparar pedido"}
            </button>
            {showMessage && (
              <div role="status" className="grid gap-2 rounded-2xl border border-store-rule bg-store-surface p-4 text-sm">
                <p className="font-semibold">Mensaje · tienda de muestra</p>
                <pre className="font-sans whitespace-pre-wrap text-store-muted">{message}</pre>
              </div>
            )}
          </div>
        )
      ) : (
        <p className="rounded-2xl border border-store-rule bg-store-surface p-4 text-store-muted">
          Esta opción no está disponible por ahora.
        </p>
      )}
    </section>
  );
}
