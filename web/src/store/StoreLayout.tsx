import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { trackEvent } from "../analytics";
import type { Shop } from "../catalog";
import { LanguageSwitcher, useI18n } from "../i18n";
import { buttonRadiusClass, primaryButtonClass } from "../themes";
import { cn } from "@/lib/utils";
import { AnnouncementBar, StoreBrand, StoreFrame, StoreHeader, WhatsAppIcon } from "./StoreParts";
import { CartProvider, CartTriggerButton } from "./CartContext";

export function StoreLayout({ shop, slug, children }: { shop: Shop; slug: string; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <CartProvider shop={shop} slug={slug}>
      <StoreFrame theme={shop.theme} accentColor={shop.accentColor} backgroundUrl={shop.backgroundUrl} style={shop.style} className="flex min-h-svh flex-col">
        <AnnouncementBar text={shop.style?.announcement} />
        <StoreHeader brand={
          <Link to="/tienda/$shop" params={{ shop: slug }} className="flex min-w-0 items-center gap-3">
            <StoreBrand logoUrl={shop.logoUrl} name={shop.name} />
          </Link>
        }>
          <div className="flex items-center gap-2">
            <LanguageSwitcher variant="store" />
            <CartTriggerButton style={shop.style} />
            {shop.whatsapp && (
              <a
                onClick={() => trackEvent(slug, "whatsapp_click")}
                href={"https://wa.me/" + shop.whatsapp} target="_blank" rel="noreferrer"
                className={cn(
                  "inline-flex h-9 items-center gap-2 px-3.5 text-sm font-medium transition",
                  buttonRadiusClass(shop.style?.radius),
                  primaryButtonClass(shop.style?.buttonStyle),
                )}
              >
                <WhatsAppIcon className="size-4" /> <span className="hidden @sm:inline">{t("store.writeUs")}</span>
              </a>
            )}
          </div>
        </StoreHeader>
        <main className="mx-auto w-[min(100%-32px,1120px)] flex-1 pb-16">{children}</main>
        <footer className="border-t border-store-rule">
          <div className="mx-auto flex w-[min(100%-32px,1120px)] flex-wrap items-center justify-between gap-3 py-6 text-sm text-store-muted">
            <span>{t("store.madeWith")} <Link to="/" className="font-display font-bold tracking-tight text-store-ink">vitrina</Link></span>
            <Link to="/ingresar" className="underline-offset-4 hover:underline">{t("store.sellerAccess")}</Link>
          </div>
        </footer>
      </StoreFrame>
    </CartProvider>
  );
}
