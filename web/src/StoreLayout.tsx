import type { ReactNode } from "react";
import type { Shop } from "./catalog";
export function StoreLayout({
  shop,
  children,
}: {
  shop: Shop;
  children: ReactNode;
}) {
  return (
    <div className="store" data-theme={shop.theme}>
      <header>
        <b>vitrina.</b>
        <span>{shop.name}</span>
      </header>
      <main>{children}</main>
    </div>
  );
}
