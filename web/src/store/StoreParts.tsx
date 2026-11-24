import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarCheck, CalendarX2, Check, ChevronDown, Clock, CreditCard, Globe, HelpCircle, ImageIcon, MapPin, Plus, RotateCcw, Store, Truck } from "lucide-react";
import { hasSurcharges, isProductAvailable, paymentMethodLabel, price, productImage, type Product, type Shop, type ShopStyle } from "../catalog";
import { useI18n, type Locale } from "../i18n";
import { buttonRadiusClass, cardAspectClass, cardRadiusClass, getTheme, isDarkColor, themeStyle } from "../themes";
import { cn } from "@/lib/utils";

/** Themed, container-query driven wrapper; the panel preview renders the same tree in a small box. */
export function StoreFrame({ theme, accentColor, backgroundUrl, style, className, children }: {
  theme: string; accentColor?: string; backgroundUrl?: string; style?: ShopStyle; className?: string; children: ReactNode;
}) {
  const dark = style?.bgColor ? isDarkColor(style.bgColor) : getTheme(theme).dark;
  return (
    <div
      data-store-theme={theme}
      style={{
        ...themeStyle(theme, accentColor, style),
        ...(backgroundUrl && {
          backgroundImage: `linear-gradient(var(--store-veil), var(--store-veil)), url("${backgroundUrl}")`,
          backgroundPosition: "center top",
          backgroundSize: "cover",
        }),
      }}
      className={cn("@container bg-store-bg text-store-ink antialiased", dark && "[color-scheme:dark]", className)}
    >
      {children}
    </div>
  );
}

export function AnnouncementBar({ text }: { text?: string }) {
  if (!text?.trim()) return null;
  return (
    <div className="bg-store-accent px-4 py-2 text-center text-xs font-medium text-store-accent-ink sm:text-sm">
      {text.trim()}
    </div>
  );
}

export function ShopAvatar({ name, logoUrl, className }: { name: string; logoUrl?: string; className?: string }) {
  if (logoUrl) return <img src={logoUrl} alt="" className={cn("shrink-0 rounded-full bg-store-surface object-cover", className)} />;
  const initials = name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "V";
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full bg-store-accent font-store font-semibold text-store-accent-ink", className)} aria-hidden="true">
      {initials}
    </span>
  );
}

export function InstagramIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function TikTokIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48Z" />
    </svg>
  );
}

export function WhatsAppIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.56.94.95-3.47-.22-.36a9.4 9.4 0 0 1-1.44-5.01c0-5.2 4.23-9.43 9.44-9.43a9.38 9.38 0 0 1 9.43 9.44c0 5.2-4.24 9.43-9.44 9.43m8.03-17.46A11.3 11.3 0 0 0 12.05.72C5.8.72.7 5.8.7 12.07c0 2 .52 3.95 1.52 5.67L.6 23.62l6.02-1.58a11.33 11.33 0 0 0 5.42 1.38h.01c6.26 0 11.35-5.09 11.36-11.35 0-3.03-1.18-5.89-3.32-8.03" />
    </svg>
  );
}

export function SocialLinks({ shop, className, onWhatsAppClick }: { shop: Pick<Shop, "instagram" | "tiktok" | "facebook" | "website" | "address" | "mapUrl" | "whatsapp">; className?: string; onWhatsAppClick?: () => void }) {
  const chip = "inline-flex h-9 items-center gap-2 rounded-full border border-store-rule bg-store-surface/60 px-3.5 text-sm font-medium transition hover:border-store-ink";
  if (!shop.instagram && !shop.tiktok && !shop.facebook && !shop.website && !shop.address && !shop.mapUrl && !shop.whatsapp) return null;
  return (
    <nav aria-label="Links" className={cn("flex flex-wrap gap-2", className)}>
      {shop.whatsapp && (
        <a className={chip} onClick={onWhatsAppClick} href={"https://wa.me/" + shop.whatsapp} target="_blank" rel="noreferrer">
          <WhatsAppIcon className="size-4" /> WhatsApp
        </a>
      )}
      {shop.instagram && (
        <a className={chip} href={"https://instagram.com/" + encodeURIComponent(shop.instagram)} target="_blank" rel="noreferrer">
          <InstagramIcon className="size-4" /> @{shop.instagram}
        </a>
      )}
      {shop.tiktok && (
        <a className={chip} href={"https://tiktok.com/@" + encodeURIComponent(shop.tiktok)} target="_blank" rel="noreferrer">
          <TikTokIcon className="size-4" /> @{shop.tiktok}
        </a>
      )}
      {shop.facebook && (
        <a className={chip} href={"https://facebook.com/" + encodeURIComponent(shop.facebook)} target="_blank" rel="noreferrer">
          Facebook
        </a>
      )}
      {shop.website && (
        <a className={chip} href={shop.website} target="_blank" rel="noreferrer">
          <Globe className="size-4" /> {shop.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "")}
        </a>
      )}
      {(shop.address || shop.mapUrl) && (
        shop.mapUrl ? (
          <a className={chip} href={shop.mapUrl} target="_blank" rel="noreferrer">
            <MapPin className="size-4 shrink-0" /> <span className="max-w-[240px] truncate">{shop.address || "Maps"}</span>
          </a>
        ) : (
          <span className="inline-flex h-9 items-center gap-2 rounded-full border border-store-rule bg-store-surface/60 px-3.5 text-sm text-store-muted">
            <MapPin className="size-4 shrink-0" /> <span className="max-w-[260px] truncate">{shop.address}</span>
          </span>
        )
      )}
    </nav>
  );
}

export function ShopHero({ shop, bookable, onWhatsAppClick }: { shop: Pick<Shop, "name" | "description" | "logoUrl" | "instagram" | "tiktok" | "facebook" | "website" | "address" | "mapUrl" | "whatsapp" | "style" | "delivery" | "paymentMethods" | "currency">; bookable: boolean; onWhatsAppClick?: () => void }) {
  const { locale, t } = useI18n();
  const en = locale === "en";
  const layout = shop.style?.heroLayout || "left";
  const centered = layout === "center";
  const compact = layout === "compact";
  const delivery = shop.delivery;
  const paymentMethods = shop.paymentMethods ?? [];
  const hasCommerceInfo = Boolean(delivery?.pickupEnabled || delivery?.deliveryEnabled || paymentMethods.length > 0);
  const deliveryLabel = delivery?.deliveryEnabled
    ? delivery.deliveryFeeMode === "free"
      ? (en ? "Free delivery" : "Envío gratis")
      : delivery.deliveryFeeMode === "fixed" && delivery.deliveryFeeCents
        ? `${en ? "Delivery" : "Envío"} · ${price(delivery.deliveryFeeCents, locale, shop.currency)}`
        : (en ? "Home delivery" : "Envío a domicilio")
    : "";

  return (
    <section className={cn(
      "grid gap-5",
      compact ? "py-6 @3xl:py-8" : "pt-8 pb-8 @3xl:pt-14 @3xl:pb-12",
      centered && "justify-items-center text-center",
    )}>
      <div className={cn("flex items-center gap-4", centered && "flex-col", !compact && "flex-col items-start", centered && "items-center")}>
        <ShopAvatar logoUrl={shop.logoUrl} name={shop.name || t("store.yourShop")} className={compact ? "size-14 text-xl" : "size-16 text-2xl @3xl:size-20 @3xl:text-3xl"} />
        <div className={cn("grid gap-2", !compact && "gap-3")}>
          <h1 className={cn(
            "font-store leading-[1.02] font-medium tracking-[-0.035em] break-words",
            compact ? "text-[clamp(1.75rem,5cqw,3rem)]" : "text-[clamp(2.4rem,9cqw,5.25rem)]",
          )}>
            {shop.name || t("store.yourShop")}
          </h1>
          {shop.description && <p className={cn("max-w-2xl text-store-muted", compact ? "text-base" : "text-lg @3xl:text-xl")}>{shop.description}</p>}
        </div>
      </div>
      <div className={cn("flex flex-wrap items-center gap-2", centered && "justify-center")}>
        {bookable && (
          <span className="inline-flex h-9 items-center gap-2 rounded-full bg-store-soft px-3.5 text-sm font-medium">
            <CalendarCheck className="size-4" /> {t("store.onlineBookings")}
          </span>
        )}
        <SocialLinks shop={shop} onWhatsAppClick={onWhatsAppClick} />
      </div>
      {hasCommerceInfo && (
        <div className={cn("flex flex-wrap items-center gap-2 text-xs text-store-muted", centered && "justify-center")}>
          {delivery?.pickupEnabled && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-store-soft/80 px-3 py-1.5 font-medium text-store-ink">
              <Store className="size-3.5 shrink-0" /> {en ? "Store pickup" : "Retiro en local"}
            </span>
          )}
          {delivery?.deliveryEnabled && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-store-soft/80 px-3 py-1.5 font-medium text-store-ink">
              <Truck className="size-3.5 shrink-0" /> {deliveryLabel}
            </span>
          )}
          {paymentMethods.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-store-rule bg-store-surface/60 px-3 py-1.5 text-store-muted">
              <CreditCard className="size-3.5 shrink-0" />
              {paymentMethods.map((m) => paymentMethodLabel(m, locale)).join(" · ")}
            </span>
          )}
        </div>
      )}
    </section>
  );
}

export function ProductImage({ product, className }: { product: Product; className?: string }) {
  const src = productImage(product);
  return src
    ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className={cn("size-full object-cover", className)} />
    : (
      <span className={cn("grid size-full place-items-center bg-store-soft text-store-muted", className)}>
        <span className="grid justify-items-center gap-1">
          <ImageIcon className="size-7 opacity-60" />
          <span className="max-w-[80%] truncate font-store text-lg">{product.name}</span>
        </span>
      </span>
    );
}

export function productPrice(product: Product, locale: Locale = "es", currency?: string) {
  if (!product.available) return locale === "en" ? "Unavailable" : "No disponible";
  if (product.stock != null && product.stock <= 0) return locale === "en" ? "Sold out" : "Agotado";
  return (hasSurcharges(product) ? (locale === "en" ? "From " : "Desde ") : "") + price(product.priceCents, locale, currency);
}

export function lowStockLabel(product: Pick<Product, "available" | "stock">, locale: Locale = "es") {
  if (!product.available || product.stock == null || product.stock <= 0 || product.stock > 5) return "";
  if (product.stock === 1) return locale === "en" ? "Last one" : "Última unidad";
  return locale === "en" ? `Only ${product.stock} left` : `Quedan ${product.stock}`;
}

export function badgeLabel(badge: Product["badge"], locale: Locale = "es") {
  if (badge === "new") return locale === "en" ? "New" : "Nuevo";
  if (badge === "popular") return "Popular";
  if (badge === "sale") return locale === "en" ? "Sale" : "Oferta";
  return "";
}

export function ProductCard({
  product,
  style,
  currency,
  link,
  onQuickAdd,
  inCartQty = 0,
  atStockLimit = false,
}: {
  product: Product;
  style?: ShopStyle;
  currency?: string;
  link?: { shop: string; product: string };
  onQuickAdd?: () => void;
  inCartQty?: number;
  atStockLimit?: boolean;
}) {
  const { locale, t } = useI18n();
  const en = locale === "en";
  const [justAdded, setJustAdded] = useState(false);
  useEffect(() => {
    if (!justAdded) return;
    const timer = window.setTimeout(() => setJustAdded(false), 1100);
    return () => window.clearTimeout(timer);
  }, [justAdded]);

  const service = product.kind === "service";
  const radius = cardRadiusClass(style?.radius);
  const btnRadius = buttonRadiusClass(style?.radius);
  const aspect = cardAspectClass(style?.cardAspect);
  const tag = badgeLabel(product.badge, locale);
  const avail = isProductAvailable(product);
  const soldOut = product.available && product.stock != null && product.stock <= 0;
  const lowStock = lowStockLabel(product, locale);
  const hasCompare = avail && Boolean(product.compareAtCents && product.compareAtCents > product.priceCents);
  const canQuickAdd = Boolean(onQuickAdd) && !service && avail && product.options.length === 0;

  const handleQuickAdd = () => {
    if (!onQuickAdd || atStockLimit) return;
    onQuickAdd();
    setJustAdded(true);
  };

  const titleNode = link ? (
    <Link
      to="/tienda/$shop/$product"
      params={link}
      className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline"
    >
      {product.name}
    </Link>
  ) : (
    product.name
  );

  if (style?.catalogLayout === "list") {
    return (
      <article className={cn("group relative flex items-center gap-4 border border-store-rule bg-store-surface/70 p-3 transition hover:border-store-ink", radius)}>
        <div className={cn("relative size-20 shrink-0 overflow-hidden bg-store-soft sm:size-24", radius)}>
          <ProductImage product={product} className="transition duration-500 group-hover:scale-[1.04]" />
        </div>
        <div className="grid min-w-0 flex-1 gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate leading-snug font-semibold group-hover:underline group-hover:underline-offset-4">{titleNode}</h3>
            {tag && <span className="rounded-full bg-store-accent px-2 py-0.5 text-[11px] font-semibold text-store-accent-ink">{tag}</span>}
            {lowStock && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">{lowStock}</span>}
            {service && (
              <span className="inline-flex items-center gap-1 rounded-full bg-store-soft px-2 py-0.5 text-xs font-medium text-store-ink">
                <Clock className="size-3" /> {product.durationMinutes} min
              </span>
            )}
          </div>
          {product.description && <p className="line-clamp-2 text-sm text-store-muted">{product.description}</p>}
          <div className="flex items-baseline gap-2">
            <p className={cn("text-sm", avail ? "font-mono font-medium" : "text-store-muted")}>{productPrice(product, locale, currency)}</p>
            {hasCompare && <span className="font-mono text-xs text-store-muted line-through">{price(product.compareAtCents!, locale, currency)}</span>}
          </div>
        </div>
        {canQuickAdd && (
          <button
            type="button"
            disabled={atStockLimit}
            onClick={handleQuickAdd}
            aria-label={en ? `Add ${product.name} to bag` : `Agregar ${product.name} al carrito`}
            className={cn(
              "relative z-10 inline-flex h-9 shrink-0 items-center gap-1 border border-store-rule bg-store-surface px-3 text-xs font-semibold text-store-ink shadow-xs transition hover:border-store-accent hover:bg-store-accent hover:text-store-accent-ink disabled:opacity-40",
              btnRadius,
              justAdded && "border-store-accent bg-store-accent text-store-accent-ink",
            )}
          >
            {justAdded ? <Check className="size-3.5" strokeWidth={2.75} /> : <Plus className="size-3.5" strokeWidth={2.5} />}
            <span className="hidden @sm:inline">{justAdded ? (en ? "Added" : "Agregado") : (en ? "Add" : "Agregar")}</span>
            {inCartQty > 0 && !justAdded && <span className="font-mono text-[11px] opacity-80">({inCartQty})</span>}
          </button>
        )}
      </article>
    );
  }
  return (
    <article className="group relative grid gap-3">
      <div className={cn("relative overflow-hidden bg-store-soft", aspect, radius)}>
        <ProductImage product={product} className="transition duration-500 group-hover:scale-[1.03]" />
        {service && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-store-surface/90 px-2.5 py-1 text-xs font-medium text-store-ink backdrop-blur">
            <Clock className="size-3.5" /> {product.durationMinutes} min
          </span>
        )}
        {tag && (
          <span className="absolute top-3 right-3 rounded-full bg-store-accent px-2.5 py-1 text-xs font-semibold text-store-accent-ink shadow-xs">
            {tag}
          </span>
        )}
        {!avail ? (
          <span className="absolute inset-x-3 bottom-3 rounded-full bg-store-ink/85 px-3 py-1.5 text-center text-xs font-medium text-store-bg">
            {soldOut ? (locale === "en" ? "Sold out" : "Agotado") : t("store.unavailableNow")}
          </span>
        ) : lowStock ? (
          <span className="absolute bottom-3 left-3 rounded-full bg-store-surface/90 px-2.5 py-1 text-xs font-semibold text-store-ink backdrop-blur">
            {lowStock}
          </span>
        ) : null}
        {canQuickAdd && (
          <button
            type="button"
            disabled={atStockLimit}
            onClick={handleQuickAdd}
            aria-label={en ? `Add ${product.name} to bag` : `Agregar ${product.name} al carrito`}
            title={atStockLimit ? (en ? "Max stock in bag" : "Máximo disponible en tu carrito") : (en ? "Quick add" : "Agregar al carrito")}
            className={cn(
              "absolute right-3 bottom-3 z-10 inline-flex h-9 items-center gap-1 border border-store-rule/70 bg-store-surface/95 px-2.5 text-xs font-semibold text-store-ink shadow-sm backdrop-blur transition hover:border-store-accent hover:bg-store-accent hover:text-store-accent-ink disabled:opacity-45",
              btnRadius,
              justAdded && "border-store-accent bg-store-accent text-store-accent-ink",
            )}
          >
            {justAdded ? <Check className="size-4" strokeWidth={2.75} /> : <Plus className="size-4" strokeWidth={2.5} />}
            {inCartQty > 0 && <span className="font-mono text-[11px]">{inCartQty}</span>}
          </button>
        )}
      </div>
      <div className="grid gap-0.5 px-0.5">
        <h3 className="leading-snug font-semibold group-hover:underline group-hover:underline-offset-4">{titleNode}</h3>
        <div className="flex flex-wrap items-baseline gap-2">
          <p className={cn("text-sm", avail ? "font-mono" : "text-store-muted")}>{productPrice(product, locale, currency)}</p>
          {hasCompare && <span className="font-mono text-xs text-store-muted line-through">{price(product.compareAtCents!, locale, currency)}</span>}
        </div>
      </div>
    </article>
  );
}

export function StorePoliciesAndFaqs({ shop }: { shop: Pick<Shop, "policies" | "faqs" | "style"> }) {
  const { locale } = useI18n();
  const en = locale === "en";
  const radius = cardRadiusClass(shop.style?.radius);
  const policies = [
    shop.policies?.shipping?.trim()
      ? { key: "shipping", icon: Truck, title: en ? "Shipping & delivery" : "Envíos y entregas", text: shop.policies.shipping.trim() }
      : null,
    shop.policies?.returns?.trim()
      ? { key: "returns", icon: RotateCcw, title: en ? "Returns & exchanges" : "Cambios y devoluciones", text: shop.policies.returns.trim() }
      : null,
    shop.policies?.cancellation?.trim()
      ? { key: "cancellation", icon: CalendarX2, title: en ? "Booking cancellation" : "Cancelación de citas", text: shop.policies.cancellation.trim() }
      : null,
  ].filter((item): item is { key: string; icon: typeof Truck; title: string; text: string } => Boolean(item));
  const faqs = (shop.faqs ?? []).filter((f) => f.question.trim() && f.answer.trim());

  if (policies.length === 0 && faqs.length === 0) return null;

  return (
    <section className="mt-14 grid gap-8 border-t border-store-rule pt-10">
      {policies.length > 0 && (
        <div className="grid gap-4">
          <h2 className="font-store text-2xl font-medium tracking-tight">
            {en ? "Store policies" : "Políticas de la tienda"}
          </h2>
          <div className={cn("grid gap-3", policies.length === 2 ? "@2xl:grid-cols-2" : policies.length >= 3 ? "@2xl:grid-cols-3" : "")}>
            {policies.map(({ key, icon: Icon, title, text }) => (
              <div key={key} className={cn("grid content-start gap-2 border border-store-rule bg-store-surface/70 p-4", radius)}>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-store-soft text-store-ink">
                    <Icon className="size-3.5" />
                  </span>
                  {title}
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-line text-store-muted">{text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {faqs.length > 0 && (
        <div className="grid gap-4">
          <h2 className="flex items-center gap-2 font-store text-2xl font-medium tracking-tight">
            <HelpCircle className="size-5 text-store-muted" />
            {en ? "Frequently asked questions" : "Preguntas frecuentes"}
          </h2>
          <div className="grid gap-2">
            {faqs.map((faq, idx) => (
              <details
                key={idx}
                className={cn("group border border-store-rule bg-store-surface/70 px-4 py-3.5 transition open:border-store-ink/40", radius)}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                  <span>{faq.question}</span>
                  <ChevronDown className="size-4 shrink-0 text-store-muted transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-2.5 text-sm leading-relaxed whitespace-pre-line text-store-muted">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function StoreBrand({ name, logoUrl }: { logoUrl?: string; name: string }) {
  return (
    <>
      <ShopAvatar logoUrl={logoUrl} name={name} className="size-8 text-sm" />
      <span className="min-w-0 truncate font-semibold">{name}</span>
    </>
  );
}

export function StoreHeader({ brand, children }: { brand: ReactNode; children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-store-rule bg-store-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-[min(100%-32px,1120px)] items-center justify-between gap-3">
        {brand}
        {children}
      </div>
    </header>
  );
}
