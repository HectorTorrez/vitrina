import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Clock, Share2, ShoppingBag } from "lucide-react";
import { trackEvent } from "../analytics";
import { acceptsBookings, isProductAvailable, shopQuery, price, productImage, productImages, totalPrice, type Product } from "../catalog";
import { useI18n } from "../i18n";
import { htmlLang, pageHead, resolveShopLocale, shopLocalBusinessSchema } from "../seo";
import { PublicBooking } from "../PublicBooking";
import { useCart } from "../store/CartContext";
import { StoreLayout } from "../store/StoreLayout";
import { badgeLabel, lowStockLabel, ProductCard, ProductImage, WhatsAppIcon } from "../store/StoreParts";
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
    const shopLocale = resolveShopLocale(loaderData.locale);
    const currency = (loaderData.currency || "USD").toUpperCase();
    const shopUrl = origin + "/tienda/" + params.shop;
    const url = shopUrl + "/" + p.slug;
    const path = productImage(p);
    const image = path && new URL(path, origin).href;
    const images = productImages(p).map((src) => new URL(src, origin).href);
    const service = p.kind === "service";
    const displayedPrice = totalPrice(p);
    const kindLabel = shopLocale === "en"
      ? (service ? "Service by " : "Product by ")
      : (service ? "Servicio de " : "Producto de ");
    const unavailableLabel = shopLocale === "en" ? "Unavailable" : "No disponible";
    const summary = [
      p.name + " · " + kindLabel + name,
      ...(service ? [p.durationMinutes + " min"] : []),
      p.available ? price(displayedPrice, shopLocale, currency) : unavailableLabel,
    ].join(" · ");
    const description = p.description ? summary + ". " + p.description : summary;
    const shopDesc = loaderData.description.trim() || description;
    const avail = isProductAvailable(p);
    const offer = avail ? {
      "@type": "Offer", url, price: (displayedPrice / 100).toFixed(2), priceCurrency: currency,
      seller: { "@id": shopUrl + "#negocio" },
      ...(!service ? { availability: "https://schema.org/InStock" } : {}),
    } : undefined;
    return pageHead({
      title: p.name + " · " + name,
      description,
      url,
      image,
      locale: shopLocale,
      structuredData: {
        "@graph": [
          shopLocalBusinessSchema(loaderData, shopUrl, shopDesc),
          {
            "@type": "WebPage", url, name: p.name, description, inLanguage: htmlLang(shopLocale),
            mainEntity: { "@id": url + "#ficha" },
            breadcrumb: { "@id": url + "#ruta" },
          },
          {
            "@type": service ? "Service" : "Product",
            "@id": url + "#ficha",
            name: p.name,
            url,
            description: p.description || summary,
            image: images.length > 1 ? images : image,
            offers: offer,
            ...(service ? { provider: { "@id": shopUrl + "#negocio" } } : {}),
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
  const { t } = useI18n();
  const p = data.products.find((item) => item.slug === params.product);
  if (!p) throw notFound();
  useEffect(() => {
    trackEvent(params.shop, "product_view", p.slug);
  }, [params.shop, p.slug]);
  const bookable = p.kind === "service" && p.available && acceptsBookings(data);
  const others = data.products.filter((item) => item.slug !== p.slug).slice(0, 4);
  const url = data.origin + "/tienda/" + params.shop + "/" + p.slug;

  return (
    <StoreLayout shop={data} slug={params.shop}>
      <div className="flex items-center justify-between gap-3 pt-6 pb-4">
        <Link to="/tienda/$shop" params={{ shop: params.shop }} className="inline-flex h-9 items-center gap-1.5 rounded-full pr-3 pl-2 text-sm font-medium transition hover:bg-store-soft">
          <ArrowLeft className="size-4" /> {t("store.catalog")}
        </Link>
        <ShareButton url={url} title={p.name} />
      </div>
      <div className={cn("grid gap-8 @3xl:gap-12", "@3xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]")}>
        <div className="@3xl:sticky @3xl:top-24 @3xl:self-start">
          <ProductGallery key={p.slug} product={p} />
        </div>
        <Order key={p.slug} shopSlug={params.shop} product={p} phone={data.whatsapp} currency={data.currency}
          booking={bookable ? <PublicBooking shop={params.shop} shopName={data.name} timeZone={data.timezone} service={p} /> : null} />
      </div>

      {others.length > 0 && (
        <section className="mt-20 grid gap-6 border-t border-store-rule pt-10">
          <h2 className="font-store text-3xl tracking-tight">{t("store.alsoLike")}</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 @3xl:grid-cols-4 @3xl:gap-x-6">
            {others.map((item) => (
              <Link key={item.slug} to="/tienda/$shop/$product" params={{ shop: params.shop, product: item.slug }}>
                <ProductCard product={item} currency={data.currency} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </StoreLayout>
  );
}

function ProductGallery({ product }: { product: Product }) {
  const images = productImages(product);
  const [current, setCurrent] = useState(0);
  if (images.length < 2) {
    return (
      <div className="aspect-[4/5] overflow-hidden rounded-3xl bg-store-soft @3xl:aspect-square">
        <ProductImage product={product} />
      </div>
    );
  }
  const go = (delta: number) => setCurrent((index) => (index + delta + images.length) % images.length);
  const arrow = "absolute top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-store-surface/90 text-store-ink shadow backdrop-blur transition hover:bg-store-surface";
  return (
    <div className="grid gap-3" role="region" aria-roledescription="carrusel" aria-label={"Fotos de " + product.name}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(-1);
        if (e.key === "ArrowRight") go(1);
      }}>
      <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-store-soft @3xl:aspect-square">
        <img src={images[current]} alt={`${product.name} · foto ${current + 1} de ${images.length}`} referrerPolicy="no-referrer" className="size-full object-cover" />
        <button type="button" aria-label="Foto anterior" onClick={() => go(-1)} className={cn(arrow, "left-3")}><ChevronLeft className="size-5" /></button>
        <button type="button" aria-label="Foto siguiente" onClick={() => go(1)} className={cn(arrow, "right-3")}><ChevronRight className="size-5" /></button>
        <span className="absolute right-3 bottom-3 rounded-full bg-store-ink/75 px-2.5 py-1 font-mono text-xs text-store-bg">{current + 1}/{images.length}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {images.map((src, index) => (
          <button
            key={src + index} type="button" aria-label={`Ver foto ${index + 1}`} aria-current={index === current}
            onClick={() => setCurrent(index)}
            className={cn("size-16 shrink-0 overflow-hidden rounded-xl ring-2 transition @3xl:size-20",
              index === current ? "ring-store-ink" : "ring-transparent opacity-70 hover:opacity-100")}
          >
            <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}

function ShareButton({ url, title }: { url: string; title: string }) {
  const [copied, copy] = useCopied(2000);
  const { t } = useI18n();
  async function share() {
    if (navigator.share) await navigator.share({ title, url }).catch(() => undefined);
    else await copy(url).catch(() => undefined);
  }
  return (
    <button type="button" onClick={() => void share()} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-store-rule px-3.5 text-sm font-medium transition hover:border-store-ink">
      {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
      {copied ? t("store.linkCopied") : t("store.share")}
    </button>
  );
}

function Order({ shopSlug, product, phone, currency, booking }: { shopSlug: string; product: Product; phone: string; currency?: string; booking: ReactNode }) {
  const { locale, t } = useI18n();
  const cart = useCart();
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [showMessage, setShowMessage] = useState(false);
  const service = product.kind === "service";
  const avail = isProductAvailable(product);
  const soldOut = product.available && product.stock != null && product.stock <= 0;
  const lowStock = lowStockLabel(product, locale);
  const total = totalPrice(product, choices);
  const options = product.options;
  const message = [
    (service ? t("store.waHelloService") : t("store.waHelloProduct")) + product.name,
    ...options.map((o) => o.name + " · " + (choices[o.name] ?? o.values[0])),
    "Total · " + price(total, locale, currency),
  ].join("\n");

  return (
    <section className="grid content-start gap-7">
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium tracking-wide text-store-muted uppercase">
            {service ? t("store.service") : t("store.product")}
            {product.category ? ` · ${product.category}` : ""}
          </p>
          {badgeLabel(product.badge, locale) && (
            <span className="rounded-full bg-store-accent px-2.5 py-0.5 text-xs font-semibold text-store-accent-ink">
              {badgeLabel(product.badge, locale)}
            </span>
          )}
          {lowStock && (
            <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
              {lowStock}
            </span>
          )}
        </div>
        <h1 className="font-store text-[clamp(2.2rem,6cqw,3.75rem)] leading-[1.05] font-medium tracking-[-0.03em]">{product.name}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-mono text-2xl font-medium" aria-live="polite">
            {avail ? price(total, locale, currency) : soldOut ? (locale === "en" ? "Sold out" : "Agotado") : t("store.unavailable")}
          </p>
          {avail && product.compareAtCents && product.compareAtCents > product.priceCents && (
            <span className="font-mono text-base text-store-muted line-through">{price(product.compareAtCents, locale, currency)}</span>
          )}
          {service && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-store-soft px-3 py-1 text-sm font-medium">
              <Clock className="size-3.5" /> {product.durationMinutes} min
            </span>
          )}
        </div>
        {service && !booking && avail && <p className="text-store-muted">{t("store.confirmByWa")}</p>}
      </div>

      {product.description && (
        <p className="max-w-prose leading-relaxed whitespace-pre-line text-store-muted">{product.description}</p>
      )}

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
                  {extra > 0 && <span className={cn("font-mono text-xs", checked ? "opacity-75" : "text-store-muted")}>+{price(extra, locale)}</span>}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      {booking}

      {avail ? (
        <div className="grid gap-2.5">
          {!service && cart && (
            <button
              type="button"
              onClick={() => cart.addProduct(product, choices)}
              className="flex h-13 items-center justify-center gap-2 rounded-full bg-store-accent px-6 font-semibold text-store-accent-ink transition hover:opacity-90"
            >
              <ShoppingBag className="size-5" />
              {locale === "en" ? "Add to bag" : "Agregar al pedido"} · {price(total, locale, currency)}
            </button>
          )}
          {phone ? (
            <a
              onClick={() => trackEvent(shopSlug, "whatsapp_click", product.slug)}
              className={cn(
                "flex h-13 items-center justify-center gap-2 rounded-full px-6 font-semibold transition",
                booking || (!service && cart) ? "border border-store-rule hover:border-store-ink" : "bg-store-accent text-store-accent-ink hover:opacity-90",
              )}
              href={"https://wa.me/" + phone + "?text=" + encodeURIComponent(message)} target="_blank" rel="noreferrer"
            >
              <WhatsAppIcon className="size-5" />
              {service
                ? (booking ? t("store.askWaBooking") : t("store.askWaHours"))
                : t("store.orderWa") + " · " + price(total, locale, currency)}
            </a>
          ) : booking ? null : (
            <div className="grid gap-3">
              <button type="button" onClick={() => setShowMessage(true)} className={cn("h-13 rounded-full px-6 font-semibold transition", !service && cart ? "border border-store-rule hover:border-store-ink" : "bg-store-accent text-store-accent-ink hover:opacity-90")}>
                {service ? t("store.prepareInquiry") : t("store.prepareOrder")}
              </button>
              {showMessage && (
                <div role="status" className="grid gap-2 rounded-2xl border border-store-rule bg-store-surface p-4 text-sm">
                  <p className="font-semibold">{t("store.sampleMsg")}</p>
                  <pre className="font-sans whitespace-pre-wrap text-store-muted">{message}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="rounded-2xl border border-store-rule bg-store-surface p-4 text-store-muted">
          {soldOut
            ? (locale === "en" ? "This item is currently sold out." : "Este producto está agotado por el momento.")
            : t("store.optionUnavailable")}
        </p>
      )}
    </section>
  );
}
