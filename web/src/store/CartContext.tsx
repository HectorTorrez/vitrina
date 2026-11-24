import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { price, productImage, totalPrice, type Product, type Shop } from "../catalog";
import { useI18n } from "../i18n";
import { buttonRadiusClass, primaryButtonClass } from "../themes";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { WhatsAppIcon } from "./StoreParts";

export interface CartItem {
  key: string;
  slug: string;
  name: string;
  imageUrl?: string;
  unitPriceCents: number;
  quantity: number;
  choices: Record<string, string>;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  totalCents: number;
  open: boolean;
  setOpen: (open: boolean) => void;
  addProduct: (product: Product, choices: Record<string, string>) => void;
  updateQty: (key: string, delta: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function itemKey(slug: string, choices: Record<string, string>) {
  const entries = Object.entries(choices).sort(([a], [b]) => a.localeCompare(b));
  return slug + "::" + entries.map(([k, v]) => `${k}=${v}`).join("|");
}

function storageKey(shopSlug: string) {
  return "vitrina_cart_" + shopSlug;
}

export function CartProvider({ shop, slug, children }: { shop: Shop; slug: string; children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(slug));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(parsed);
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    }
    setHydrated(true);
  }, [slug]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (items.length === 0) window.localStorage.removeItem(storageKey(slug));
      else window.localStorage.setItem(storageKey(slug), JSON.stringify(items));
    } catch {
      // Ignore storage quota errors
    }
  }, [items, slug, hydrated]);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
    return {
      items,
      count,
      totalCents,
      open,
      setOpen,
      addProduct: (product, rawChoices) => {
        const choices: Record<string, string> = {};
        for (const opt of product.options) {
          choices[opt.name] = rawChoices[opt.name] ?? opt.values[0];
        }
        const key = itemKey(product.slug, choices);
        const unitPriceCents = totalPrice(product, choices);
        const imageUrl = productImage(product);
        setItems((current) => {
          const existing = current.find((item) => item.key === key);
          if (existing) {
            return current.map((item) => item.key === key ? { ...item, quantity: Math.min(99, item.quantity + 1) } : item);
          }
          return [...current, { key, slug: product.slug, name: product.name, imageUrl, unitPriceCents, quantity: 1, choices }];
        });
        setOpen(true);
      },
      updateQty: (key, delta) => {
        setItems((current) =>
          current
            .map((item) => item.key === key ? { ...item, quantity: item.quantity + delta } : item)
            .filter((item) => item.quantity > 0),
        );
      },
      removeItem: (key) => setItems((current) => current.filter((item) => item.key !== key)),
      clear: () => setItems([]),
    };
  }, [items, open]);

  return (
    <CartContext.Provider value={value}>
      {children}
      <CartDrawer shop={shop} />
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}

export function CartTriggerButton({ style }: { style?: Shop["style"] }) {
  const cart = useCart();
  const { locale } = useI18n();
  if (!cart || cart.count === 0) return null;
  return (
    <button
      type="button"
      onClick={() => cart.setOpen(true)}
      aria-label={locale === "en" ? "Open bag" : "Abrir carrito"}
      className={cn(
        "relative inline-flex h-9 items-center gap-1.5 border border-store-rule bg-store-surface/80 px-3 text-sm font-medium text-store-ink transition hover:border-store-ink",
        buttonRadiusClass(style?.radius),
      )}
    >
      <ShoppingBag className="size-4" />
      <span className="font-mono text-xs font-semibold">{cart.count}</span>
    </button>
  );
}

function CartDrawer({ shop }: { shop: Shop }) {
  const cart = useCart();
  const { locale } = useI18n();
  const en = locale === "en";
  const [showPreview, setShowPreview] = useState(false);

  if (!cart) return null;

  const messageLines = [
    en ? `Hi ${shop.name}, I'd like to order:` : `Hola ${shop.name}, quisiera pedir:`,
    ...cart.items.map((item) => {
      const opts = Object.entries(item.choices).map(([k, v]) => `${k}: ${v}`).join(", ");
      const lineTotal = price(item.unitPriceCents * item.quantity, locale);
      return `• ${item.quantity}x ${item.name}${opts ? ` (${opts})` : ""} — ${lineTotal}`;
    }),
    "",
    `Total · ${price(cart.totalCents, locale)}`,
  ];
  const message = messageLines.join("\n");

  return (
    <Sheet open={cart.open} onOpenChange={(next) => { cart.setOpen(next); if (!next) setShowPreview(false); }}>
      <SheetContent className="flex flex-col p-0">
        <div className="border-b px-6 py-5">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="size-5" /> {en ? "Your bag" : "Tu pedido"} ({cart.count})
          </SheetTitle>
          <SheetDescription>
            {en ? "Review your items and send your order via WhatsApp." : "Revisá tus productos y enviá tu pedido por WhatsApp."}
          </SheetDescription>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {cart.items.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {en ? "Your bag is empty." : "Tu carrito está vacío."}
            </p>
          ) : (
            <ul className="grid gap-3">
              {cart.items.map((item) => (
                <li key={item.key} className="flex items-start gap-3 rounded-xl border bg-card p-3">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="size-16 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="grid size-16 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <ShoppingBag className="size-5" />
                    </span>
                  )}
                  <div className="grid min-w-0 flex-1 gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{item.name}</p>
                      <button
                        type="button" onClick={() => cart.removeItem(item.key)}
                        aria-label={en ? "Remove" : "Quitar"}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    {Object.keys(item.choices).length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {Object.entries(item.choices).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                      </p>
                    )}
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-1 rounded-full border p-0.5">
                        <button
                          type="button" onClick={() => cart.updateQty(item.key, -1)}
                          aria-label={en ? "Decrease quantity" : "Disminuir cantidad"}
                          className="grid size-6 place-items-center rounded-full hover:bg-muted"
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="min-w-6 text-center font-mono text-xs font-medium">{item.quantity}</span>
                        <button
                          type="button" onClick={() => cart.updateQty(item.key, 1)}
                          aria-label={en ? "Increase quantity" : "Aumentar cantidad"}
                          className="grid size-6 place-items-center rounded-full hover:bg-muted"
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>
                      <span className="font-mono text-sm font-medium">{price(item.unitPriceCents * item.quantity, locale)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {cart.items.length > 0 && (
          <div className="grid gap-3 border-t bg-card px-6 py-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-muted-foreground">Total</span>
              <span className="font-mono text-xl font-bold">{price(cart.totalCents, locale)}</span>
            </div>
            {shop.whatsapp ? (
              <a
                href={"https://wa.me/" + shop.whatsapp + "?text=" + encodeURIComponent(message)}
                target="_blank" rel="noreferrer"
                className={cn(
                  "flex h-12 items-center justify-center gap-2 px-5 text-sm font-semibold transition",
                  buttonRadiusClass(shop.style?.radius),
                  primaryButtonClass(shop.style?.buttonStyle),
                )}
              >
                <WhatsAppIcon className="size-5" />
                {en ? "Send order via WhatsApp" : "Enviar pedido por WhatsApp"}
              </a>
            ) : (
              <div className="grid gap-2">
                <button
                  type="button" onClick={() => setShowPreview((v) => !v)}
                  className={cn("h-12 px-5 text-sm font-semibold transition", buttonRadiusClass(shop.style?.radius), primaryButtonClass(shop.style?.buttonStyle))}
                >
                  {en ? "Preview order message" : "Ver mensaje del pedido"}
                </button>
                {showPreview && (
                  <pre className="rounded-xl border bg-muted/50 p-3 font-sans text-xs whitespace-pre-wrap text-muted-foreground">{message}</pre>
                )}
              </div>
            )}
            <button
              type="button" onClick={() => cart.clear()}
              className="text-center text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              {en ? "Clear bag" : "Vaciar carrito"}
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
