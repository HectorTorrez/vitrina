import { useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import type { Product, Shop } from "../catalog";
import { ProductCard, ShopHero, StoreBrand, StoreFrame, StoreHeader, WhatsAppIcon } from "./StoreParts";
import { cn } from "@/lib/utils";

const samples: Product[] = [
  { kind: "service", durationMinutes: 60, slug: "ejemplo-1", name: "Tu primer servicio", priceCents: 1800, available: true, artwork: "", position: 0, hidden: false, options: [] },
  { kind: "product", durationMinutes: 0, slug: "ejemplo-2", name: "Tu primer producto", priceCents: 2500, available: true, artwork: "", position: 1, hidden: false, options: [] },
];

/** Live miniature of the public store, rendered with the same components and theme as /tienda. */
export function StorefrontPreview({ shop, slug, className }: {
  shop: Pick<Shop, "name" | "description" | "theme" | "instagram" | "tiktok" | "whatsapp" | "hours" | "products">;
  slug: string;
  className?: string;
}) {
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  const visible = (shop.products ?? []).filter((product) => !product.hidden);
  const products = (visible.length ? visible : samples).slice(0, device === "phone" ? 4 : 6);
  const bookable = (shop.hours ?? []).some((day) => day.open) && products.some((product) => product.kind === "service");

  return (
    <div className={cn("grid gap-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Vista previa</p>
        <div className="flex rounded-full border bg-card p-0.5" role="radiogroup" aria-label="Dispositivo">
          {([["phone", Smartphone, "Celular"], ["desktop", Monitor, "Computadora"]] as const).map(([value, Icon, label]) => (
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
        <div className={cn("overflow-y-auto [scrollbar-width:thin]", device === "phone" ? "h-[520px]" : "h-[420px]")} inert>
          <div className={cn(device === "desktop" && "w-[200%] [zoom:0.5]")}>
            <StoreFrame theme={shop.theme} className="min-h-full pb-8">
              <StoreHeader brand={<div className="flex min-w-0 items-center gap-3"><StoreBrand name={shop.name || "Tu tienda"} /></div>}>
                {shop.whatsapp && (
                  <span className="inline-flex h-9 items-center gap-2 rounded-full bg-store-accent px-3.5 text-sm font-medium text-store-accent-ink">
                    <WhatsAppIcon className="size-4" />
                  </span>
                )}
              </StoreHeader>
              <div className="mx-auto w-[min(100%-32px,1120px)]">
                <ShopHero shop={shop} bookable={bookable} />
                <div className="grid grid-cols-2 gap-x-4 gap-y-6 @3xl:grid-cols-3">
                  {products.map((product) => <ProductCard key={product.slug} product={product} />)}
                </div>
              </div>
            </StoreFrame>
          </div>
        </div>
      </div>
    </div>
  );
}
