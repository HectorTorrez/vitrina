import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
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
      <footer className="store-footer"><Link to="/ingresar">Acceso para vendedores</Link></footer>
    </div>
  );
}
