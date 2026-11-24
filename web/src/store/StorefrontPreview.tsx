import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { acceptsBookings, type Product, type Shop } from "../catalog";
import { useI18n } from "../i18n";
import { AnnouncementBar, ProductCard, ShopHero, StoreBrand, StoreFrame, StoreHeader, WhatsAppIcon } from "./StoreParts";
import { buttonRadiusClass, primaryButtonClass, themeStyle } from "../themes";
import { cn } from "@/lib/utils";

const desktopWidth = 960;

const samples: Product[] = [
  { kind: "service", durationMinutes: 60, slug: "ejemplo-1", name: "Tu primer servicio", priceCents: 1800, available: true, artwork: "", position: 0, hidden: false, options: [] },
  { kind: "product", durationMinutes: 0, slug: "ejemplo-2", name: "Tu primer producto", priceCents: 2500, available: true, artwork: "", position: 1, hidden: false, options: [] },
];

export function StorefrontPreview({ shop, slug, className }: {
  shop: Pick<Shop, "logoUrl" | "backgroundUrl" | "name" | "description" | "theme" | "accentColor" | "style" | "instagram" | "tiktok" | "facebook" | "website" | "address" | "mapUrl" | "whatsapp" | "hours" | "products">;
  slug: string;
  className?: string;
}) {
  const { t } = useI18n();
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  const visible = shop.products.filter((product) => !product.hidden);
  const products = (visible.length ? visible : samples).slice(0, device === "phone" ? 4 : 6);
  const bookable = acceptsBookings(shop) && products.some((product) => product.kind === "service");

  return (
    <div className={cn("grid gap-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{t("profile.preview")}</p>
        <div className="flex rounded-full border bg-card p-0.5" role="radiogroup" aria-label="Device">
          {([["phone", Smartphone, t("profile.phone")], ["desktop", Monitor, t("profile.desktop")]] as const).map(([value, Icon, label]) => (
            <button
              key={value} type="button" role="radio" aria-checked={device === value} aria-label={label} title={label}
              onClick={() => setDevice(value)}
              className={cn("grid h-7 w-9 place-items-center rounded-full transition", device === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      </div>
      <div className={cn(
        "relative mx-auto w-full overflow-hidden border bg-card shadow-sm",
        device === "phone" ? "max-w-[300px] rounded-[2rem] border-[6px] border-ink-dark" : "rounded-xl",
      )}>
        {device === "desktop" && (
          <div className="flex items-center gap-1.5 border-b bg-muted px-3 py-2">
            <i className="size-2 rounded-full bg-[#ff5f57]" /><i className="size-2 rounded-full bg-[#febc2e]" /><i className="size-2 rounded-full bg-[#28c840]" />
            <span className="ml-2 truncate font-mono text-[10px] text-muted-foreground">/tienda/{slug || "tu-tienda"}</span>
          </div>
        )}
        {device === "phone" ? (
          <div className="h-[520px] overflow-y-auto [scrollbar-width:thin]" inert>
            <StorePage shop={shop} products={products} bookable={bookable} />
          </div>
        ) : (
          <DesktopPage theme={shop.theme}>
            <StorePage shop={shop} products={products} bookable={bookable} />
          </DesktopPage>
        )}
      </div>
    </div>
  );
}

function StorePage({ shop, products, bookable }: {
  shop: Pick<Shop, "logoUrl" | "backgroundUrl" | "name" | "description" | "theme" | "accentColor" | "style" | "instagram" | "tiktok" | "facebook" | "website" | "address" | "mapUrl" | "whatsapp">;
  products: Product[];
  bookable: boolean;
}) {
  const isList = shop.style?.catalogLayout === "list";
  return (
    <StoreFrame theme={shop.theme} accentColor={shop.accentColor} backgroundUrl={shop.backgroundUrl} style={shop.style} className="min-h-full pb-8">
      <AnnouncementBar text={shop.style?.announcement} />
      <StoreHeader brand={<div className="flex min-w-0 items-center gap-3"><StoreBrand logoUrl={shop.logoUrl} name={shop.name || "Tu tienda"} /></div>}>
        {shop.whatsapp && (
          <span className={cn("inline-flex h-9 items-center gap-2 px-3.5 text-sm font-medium", buttonRadiusClass(shop.style?.radius), primaryButtonClass(shop.style?.buttonStyle))}>
            <WhatsAppIcon className="size-4" />
          </span>
        )}
      </StoreHeader>
      <div className="mx-auto w-[min(100%-32px,1120px)]">
        <ShopHero shop={shop} bookable={bookable} />
        <div className={isList ? "grid gap-3" : "grid grid-cols-2 gap-x-4 gap-y-6 @3xl:grid-cols-3"}>
          {products.map((product) => <ProductCard key={product.slug} product={product} style={shop.style} />)}
        </div>
      </div>
    </StoreFrame>
  );
}

function DesktopPage({ theme, children }: { theme: string; children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ scale: 1, height: 0 });

  useLayoutEffect(() => {
    const frameEl = frame.current;
    const contentEl = content.current;
    if (!frameEl || !contentEl) return;
    const measure = () => {
      const width = frameEl.clientWidth;
      if (!width) return;
      const scale = Math.round((width / desktopWidth) * 1000) / 1000;
      const height = Math.ceil(contentEl.offsetHeight * scale);
      setLayout((current) => current.scale === scale && current.height === height ? current : { scale, height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frameEl);
    observer.observe(contentEl);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frame} style={themeStyle(theme)} className="h-[420px] overflow-x-hidden overflow-y-auto bg-store-bg [scrollbar-width:thin]" inert>
      <div className="overflow-hidden" style={{ height: layout.height }}>
        <div className="origin-top-left" style={{ width: desktopWidth, transform: `scale(${layout.scale})` }}>
          <div ref={content}>{children}</div>
        </div>
      </div>
    </div>
  );
}
