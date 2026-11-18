import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { Shop } from "../catalog";
import { StoreBrand, StoreFrame, StoreHeader, WhatsAppIcon } from "./StoreParts";

export function StoreLayout({ shop, slug, children }: { shop: Shop; slug: string; children: ReactNode }) {
  return (
    <StoreFrame theme={shop.theme} className="flex min-h-svh flex-col">
      <StoreHeader brand={
        <Link to="/tienda/$shop" params={{ shop: slug }} className="flex min-w-0 items-center gap-3">
          <StoreBrand name={shop.name} />
        </Link>
      }>
        {shop.whatsapp && (
          <a
            href={"https://wa.me/" + shop.whatsapp} target="_blank" rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-full bg-store-accent px-3.5 text-sm font-medium text-store-accent-ink transition hover:opacity-90"
          >
            <WhatsAppIcon className="size-4" /> <span className="hidden @sm:inline">Escribinos</span>
          </a>
        )}
      </StoreHeader>
      <main className="mx-auto w-[min(100%-32px,1120px)] flex-1 pb-16">{children}</main>
      <footer className="border-t border-store-rule">
        <div className="mx-auto flex w-[min(100%-32px,1120px)] flex-wrap items-center justify-between gap-3 py-6 text-sm text-store-muted">
          <span>Hecho con <Link to="/" className="font-display font-bold tracking-tight text-store-ink">vitrina</Link></span>
          <Link to="/ingresar" className="underline-offset-4 hover:underline">Acceso para vendedores</Link>
        </div>
      </footer>
    </StoreFrame>
  );
}
