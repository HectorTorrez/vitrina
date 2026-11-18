import type { ReactNode } from "react";
import { CalendarCheck, Clock, ImageIcon } from "lucide-react";
import { hasSurcharges, price, productImage, type Product, type Shop } from "../catalog";
import { getTheme, themeStyle } from "../themes";
import { cn } from "@/lib/utils";

/** Themed, container-query driven wrapper; the panel preview renders the same tree in a small box. */
export function StoreFrame({ theme, accentColor, backgroundUrl, className, children }: { theme: string; accentColor?: string; backgroundUrl?: string; className?: string; children: ReactNode }) {
  return (
    <div
      data-store-theme={theme}
      style={{
        ...themeStyle(theme, accentColor),
        ...(backgroundUrl && {
          backgroundImage: `linear-gradient(var(--store-veil), var(--store-veil)), url("${backgroundUrl}")`,
          backgroundPosition: "center top",
          backgroundSize: "cover",
        }),
      }}
      className={cn("@container [--store-veil:color-mix(in_srgb,var(--s-bg)_82%,transparent)] bg-store-bg text-store-ink antialiased", getTheme(theme).dark && "[color-scheme:dark]", className)}
    >
      {children}
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

export function SocialLinks({ shop, className }: { shop: Pick<Shop, "instagram" | "tiktok" | "whatsapp">; className?: string }) {
  const chip = "inline-flex h-9 items-center gap-2 rounded-full border border-store-rule bg-store-surface/60 px-3.5 text-sm font-medium transition hover:border-store-ink";
  if (!shop.instagram && !shop.tiktok && !shop.whatsapp) return null;
  return (
    <nav aria-label="Redes sociales" className={cn("flex flex-wrap gap-2", className)}>
      {shop.whatsapp && (
        <a className={chip} href={"https://wa.me/" + shop.whatsapp} target="_blank" rel="noreferrer">
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
    </nav>
  );
}

export function ShopHero({ shop, bookable }: { shop: Pick<Shop, "name" | "description" | "logoUrl" | "instagram" | "tiktok" | "whatsapp">; bookable: boolean }) {
  return (
    <section className="grid gap-5 pt-8 pb-8 @3xl:pt-14 @3xl:pb-12">
      <ShopAvatar logoUrl={shop.logoUrl} name={shop.name || "Tu tienda"} className="size-16 text-2xl @3xl:size-20 @3xl:text-3xl" />
      <div className="grid gap-3">
        <h1 className="font-store text-[clamp(2.4rem,9cqw,5.25rem)] leading-[1.02] font-medium tracking-[-0.035em] break-words">
          {shop.name || "Tu tienda"}
        </h1>
        {shop.description && <p className="max-w-2xl text-lg text-store-muted @3xl:text-xl">{shop.description}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {bookable && (
          <span className="inline-flex h-9 items-center gap-2 rounded-full bg-store-soft px-3.5 text-sm font-medium">
            <CalendarCheck className="size-4" /> Reservas en línea
          </span>
        )}
        <SocialLinks shop={shop} />
      </div>
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

export function productPrice(product: Product) {
  if (!product.available) return "No disponible";
  return (hasSurcharges(product) ? "Desde " : "") + price(product.priceCents);
}

export function ProductCard({ product }: { product: Product }) {
  const service = product.kind === "service";
  return (
    <article className="group grid gap-3">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-store-soft">
        <ProductImage product={product} className="transition duration-500 group-hover:scale-[1.03]" />
        {service && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-store-surface/90 px-2.5 py-1 text-xs font-medium text-store-ink backdrop-blur">
            <Clock className="size-3.5" /> {product.durationMinutes} min
          </span>
        )}
        {!product.available && (
          <span className="absolute inset-x-3 bottom-3 rounded-full bg-store-ink/85 px-3 py-1.5 text-center text-xs font-medium text-store-bg">
            No disponible por ahora
          </span>
        )}
      </div>
      <div className="grid gap-0.5 px-0.5">
        <h3 className="leading-snug font-semibold group-hover:underline group-hover:underline-offset-4">{product.name}</h3>
        <p className={cn("text-sm", product.available ? "font-mono" : "text-store-muted")}>{productPrice(product)}</p>
      </div>
    </article>
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
