import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, Copy, CreditCard, Loader2, Minus, Plus, ShoppingBag, Store, Tag, Trash2, Truck, X } from "lucide-react";
import { trackEvent } from "../analytics";
import { isProductAvailable, paymentMethodLabel, price, productImage, totalPrice, type Product, type Shop } from "../catalog";
import { useI18n } from "../i18n";
import { createOrder, validateCoupon, type CouponValidationResult } from "../orders";
import { buttonRadiusClass, primaryButtonClass } from "../themes";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useCopied } from "@/lib/useCopied";
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
    const maxForSlug = (productSlug: string) => {
      const found = shop.products.find((p) => p.slug === productSlug);
      if (found?.stock != null) return Math.max(0, found.stock);
      return 99;
    };
    return {
      items,
      count,
      totalCents,
      open,
      setOpen,
      addProduct: (product, rawChoices) => {
        if (!isProductAvailable(product)) return;
        const choices: Record<string, string> = {};
        for (const opt of product.options) {
          choices[opt.name] = rawChoices[opt.name] ?? opt.values[0];
        }
        const key = itemKey(product.slug, choices);
        const unitPriceCents = totalPrice(product, choices);
        const imageUrl = productImage(product);
        const limit = product.stock != null ? product.stock : 99;
        setItems((current) => {
          const totalForSlug = current.filter((i) => i.slug === product.slug).reduce((s, i) => s + i.quantity, 0);
          if (totalForSlug >= limit) return current;
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
            .map((item) => {
              if (item.key !== key) return item;
              if (delta > 0) {
                const limit = maxForSlug(item.slug);
                const otherQty = current.filter((i) => i.slug === item.slug && i.key !== key).reduce((s, i) => s + i.quantity, 0);
                const nextQty = Math.min(item.quantity + delta, Math.max(0, limit - otherQty));
                return { ...item, quantity: nextQty };
              }
              return { ...item, quantity: item.quantity + delta };
            })
            .filter((item) => item.quantity > 0),
        );
      },
      removeItem: (key) => setItems((current) => current.filter((item) => item.key !== key)),
      clear: () => setItems([]),
    };
  }, [items, open, shop.products]);

  return (
    <CartContext.Provider value={value}>
      {children}
      <CartDrawer shop={shop} slug={slug} />
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

interface SubmittedOrder {
  code: string;
  message: string;
  whatsappUrl?: string;
}

function CartDrawer({ shop, slug }: { shop: Shop; slug: string }) {
  const cart = useCart();
  const { locale } = useI18n();
  const en = locale === "en";
  const currency = shop.currency || "USD";
  const [copied, copy] = useCopied();

  const deliveryCfg = shop.delivery;
  const pickupEnabled = Boolean(deliveryCfg?.pickupEnabled);
  const deliveryEnabled = Boolean(deliveryCfg?.deliveryEnabled);
  const paymentMethods = shop.paymentMethods ?? [];

  const defaultDelivery: "" | "pickup" | "delivery" =
    deliveryEnabled && !pickupEnabled ? "delivery" : pickupEnabled && !deliveryEnabled ? "pickup" : deliveryEnabled ? "delivery" : "";

  const [deliveryMethod, setDeliveryMethod] = useState<"" | "pickup" | "delivery">(defaultDelivery);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>(paymentMethods.length === 1 ? paymentMethods[0] : "");
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");

  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationResult | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<SubmittedOrder | null>(null);

  useEffect(() => {
    setDeliveryMethod(defaultDelivery);
  }, [defaultDelivery]);

  useEffect(() => {
    if (paymentMethods.length === 1) setPaymentMethod(paymentMethods[0]);
    else if (paymentMethod && !paymentMethods.includes(paymentMethod)) setPaymentMethod("");
  }, [paymentMethods.join("|")]);

  if (!cart) return null;

  const subtotalCents = cart.totalCents;
  const discountCents = appliedCoupon
    ? appliedCoupon.minOrderCents > 0 && subtotalCents < appliedCoupon.minOrderCents
      ? 0
      : Math.min(
          subtotalCents,
          appliedCoupon.kind === "percent" ? Math.floor((subtotalCents * appliedCoupon.value) / 100) : appliedCoupon.value,
        )
    : 0;
  const couponBelowMin = Boolean(appliedCoupon && appliedCoupon.minOrderCents > 0 && subtotalCents < appliedCoupon.minOrderCents);
  const deliveryFeeCents =
    deliveryMethod === "delivery" && deliveryCfg?.deliveryFeeMode === "fixed" ? (deliveryCfg.deliveryFeeCents ?? 0) : 0;
  const finalTotalCents = Math.max(0, subtotalCents - discountCents + deliveryFeeCents);

  function buildOrderMessage(orderCode?: string) {
    const lines: string[] = [];
    if (orderCode) {
      lines.push(en ? `Hi ${shop.name}, here is my order ${orderCode}:` : `Hola ${shop.name}, te envío mi pedido ${orderCode}:`);
    } else {
      lines.push(en ? `Hi ${shop.name}, I'd like to order:` : `Hola ${shop.name}, quisiera pedir:`);
    }
    for (const item of cart!.items) {
      const opts = Object.entries(item.choices).map(([k, v]) => `${k}: ${v}`).join(", ");
      const lineTotal = price(item.unitPriceCents * item.quantity, locale, currency);
      lines.push(`• ${item.quantity}x ${item.name}${opts ? ` (${opts})` : ""} — ${lineTotal}`);
    }
    lines.push("");
    if (discountCents > 0 && appliedCoupon) {
      lines.push(`${en ? "Subtotal" : "Subtotal"} · ${price(subtotalCents, locale, currency)}`);
      lines.push(`${en ? "Discount" : "Descuento"} (${appliedCoupon.code}) · -${price(discountCents, locale, currency)}`);
    }
    if (deliveryMethod === "pickup") {
      lines.push(`${en ? "Delivery" : "Entrega"} · ${en ? "Store pickup" : "Retiro en local"}`);
    } else if (deliveryMethod === "delivery") {
      const feeText = deliveryCfg?.deliveryFeeMode === "free"
        ? (en ? "Free" : "Gratis")
        : deliveryCfg?.deliveryFeeMode === "fixed" && deliveryFeeCents > 0
          ? price(deliveryFeeCents, locale, currency)
          : (en ? "To be arranged" : "A coordinar");
      lines.push(`${en ? "Delivery" : "Entrega"} · ${en ? "Home delivery" : "Envío a domicilio"} (${feeText})`);
      if (deliveryAddress.trim()) {
        lines.push(`${en ? "Address" : "Dirección"} · ${deliveryAddress.trim()}`);
      }
    }
    if (paymentMethod) {
      lines.push(`${en ? "Payment" : "Pago"} · ${paymentMethodLabel(paymentMethod, locale)}`);
    }
    if (customerName.trim()) {
      lines.push(`${en ? "Name" : "Nombre"} · ${customerName.trim()}`);
    }
    if (notes.trim()) {
      lines.push(`${en ? "Notes" : "Notas"} · ${notes.trim()}`);
    }
    lines.push(`Total · ${price(finalTotalCents, locale, currency)}`);
    return lines.join("\n");
  }

  async function applyCoupon() {
    const code = couponInput.trim().toUpperCase();
    if (!code || checkingCoupon) return;
    setCheckingCoupon(true);
    setCouponError(null);
    const res = await validateCoupon({ data: { shop: slug, code, subtotalCents } });
    setCheckingCoupon(false);
    if (!res.ok) {
      setCouponError(res.error);
      setAppliedCoupon(null);
      return;
    }
    setAppliedCoupon(res.coupon);
    setCouponInput("");
  }

  async function handleCheckout() {
    if (submitting || cart!.items.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    const res = await createOrder({
      data: {
        shop: slug,
        customerName: customerName.trim(),
        deliveryMethod,
        deliveryAddress: deliveryMethod === "delivery" ? deliveryAddress.trim() : "",
        paymentMethod,
        couponCode: appliedCoupon && !couponBelowMin ? appliedCoupon.code : "",
        notes: notes.trim(),
        items: cart!.items.map((item) => ({
          slug: item.slug,
          quantity: item.quantity,
          choices: item.choices,
        })),
      },
    });
    setSubmitting(false);
    if (!res.ok) {
      setSubmitError(res.error);
      return;
    }
    const finalMessage = buildOrderMessage(res.order.code);
    const whatsappUrl = shop.whatsapp
      ? "https://wa.me/" + shop.whatsapp + "?text=" + encodeURIComponent(finalMessage)
      : undefined;
    if (whatsappUrl) {
      trackEvent(slug, "whatsapp_click");
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    }
    setSubmitted({ code: res.order.code, message: finalMessage, whatsappUrl });
    cart!.clear();
    setAppliedCoupon(null);
    setNotes("");
  }

  return (
    <Sheet open={cart.open} onOpenChange={(next) => { cart.setOpen(next); if (!next) { setSubmitError(null); if (cart.items.length === 0) setSubmitted(null); } }}>
      <SheetContent className="flex flex-col p-0">
        <div className="border-b px-6 py-5">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="size-5" /> {en ? "Your bag" : "Tu pedido"} {cart.count > 0 && `(${cart.count})`}
          </SheetTitle>
          <SheetDescription>
            {en ? "Review your items and send your order via WhatsApp." : "Revisá tus productos y enviá tu pedido por WhatsApp."}
          </SheetDescription>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {submitted && cart.items.length === 0 ? (
            <div className="grid gap-4 py-4">
              <div className="grid justify-items-center gap-2 rounded-2xl border bg-muted/40 p-6 text-center">
                <span className="grid size-12 place-items-center rounded-full bg-success/15 text-success">
                  <Check className="size-6" strokeWidth={3} />
                </span>
                <p className="font-display text-xl font-bold">
                  {en ? `Order ${submitted.code} saved` : `Pedido ${submitted.code} registrado`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {submitted.whatsappUrl
                    ? (en ? "If WhatsApp didn't open automatically, tap the button below." : "Si WhatsApp no se abrió automáticamente, tocá el botón de abajo.")
                    : (en ? "Copy your order summary below to share it with the shop." : "Copiá el resumen de tu pedido para enviárselo a la tienda.")}
                </p>
              </div>
              {submitted.whatsappUrl && (
                <a
                  href={submitted.whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "flex h-12 items-center justify-center gap-2 px-5 text-sm font-semibold transition",
                    buttonRadiusClass(shop.style?.radius),
                    primaryButtonClass(shop.style?.buttonStyle),
                  )}
                >
                  <WhatsAppIcon className="size-5" />
                  {en ? "Open in WhatsApp" : "Abrir en WhatsApp"}
                </a>
              )}
              <div className="grid gap-2">
                <pre className="rounded-xl border bg-muted/40 p-3 font-sans text-xs whitespace-pre-wrap text-muted-foreground">{submitted.message}</pre>
                <button
                  type="button"
                  onClick={() => void copy(submitted.message)}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border text-xs font-medium hover:bg-muted"
                >
                  {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                  {copied ? (en ? "Copied" : "Copiado") : (en ? "Copy order message" : "Copiar mensaje")}
                </button>
              </div>
            </div>
          ) : cart.items.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {en ? "Your bag is empty." : "Tu carrito está vacío."}
            </p>
          ) : (
            <div className="grid gap-5">
              <ul className="grid gap-3">
                {cart.items.map((item) => {
                  const prod = shop.products.find((p) => p.slug === item.slug);
                  const totalForSlug = cart.items.filter((i) => i.slug === item.slug).reduce((s, i) => s + i.quantity, 0);
                  const atLimit = prod?.stock != null && totalForSlug >= prod.stock;
                  return (
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
                              type="button" disabled={atLimit} onClick={() => cart.updateQty(item.key, 1)}
                              aria-label={en ? "Increase quantity" : "Aumentar cantidad"}
                              className="grid size-6 place-items-center rounded-full hover:bg-muted disabled:opacity-30"
                            >
                              <Plus className="size-3" />
                            </button>
                          </div>
                          <span className="font-mono text-sm font-medium">{price(item.unitPriceCents * item.quantity, locale, currency)}</span>
                        </div>
                        {atLimit && prod?.stock != null && (
                          <p className="text-[11px] text-amber-700 dark:text-amber-300">
                            {en ? `Max ${prod.stock} available` : `Máximo ${prod.stock} disponibles`}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {(pickupEnabled || deliveryEnabled) && (
                <div className="grid gap-2 border-t pt-4">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {en ? "Delivery method" : "Entrega"}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {deliveryEnabled && (
                      <button
                        type="button"
                        onClick={() => setDeliveryMethod("delivery")}
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition",
                          deliveryMethod === "delivery" ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-foreground/40",
                        )}
                      >
                        <Truck className="size-3.5" /> {en ? "Delivery" : "Envío"}
                      </button>
                    )}
                    {pickupEnabled && (
                      <button
                        type="button"
                        onClick={() => setDeliveryMethod("pickup")}
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition",
                          deliveryMethod === "pickup" ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-foreground/40",
                        )}
                      >
                        <Store className="size-3.5" /> {en ? "Pickup" : "Retiro"}
                      </button>
                    )}
                  </div>
                  {deliveryMethod === "pickup" && deliveryCfg?.pickupNote && (
                    <p className="text-xs text-muted-foreground">{deliveryCfg.pickupNote}</p>
                  )}
                  {deliveryMethod === "delivery" && (
                    <div className="grid gap-1.5">
                      {deliveryCfg?.deliveryNote && (
                        <p className="text-xs text-muted-foreground">{deliveryCfg.deliveryNote}</p>
                      )}
                      <input
                        type="text"
                        value={deliveryAddress}
                        maxLength={240}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder={en ? "Delivery address or reference (optional)" : "Dirección o referencia de envío (opcional)"}
                        className="h-9 w-full rounded-lg border bg-background px-3 text-xs outline-none focus:border-ring"
                      />
                    </div>
                  )}
                </div>
              )}

              {paymentMethods.length > 0 && (
                <div className="grid gap-2 border-t pt-4">
                  <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    <CreditCard className="size-3.5" /> {en ? "Payment method" : "Método de pago"}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {paymentMethods.map((method) => {
                      const active = paymentMethod === method;
                      return (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setPaymentMethod(active ? "" : method)}
                          className={cn(
                            "h-8 rounded-full border px-3 text-xs font-medium transition",
                            active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-foreground/40",
                          )}
                        >
                          {paymentMethodLabel(method, locale)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid gap-2 border-t pt-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <Tag className="size-3.5" /> {en ? "Discount code" : "Cupón de descuento"}
                </p>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
                    <span className="font-mono font-semibold">
                      {appliedCoupon.code}
                      <span className="ml-2 font-sans font-normal text-muted-foreground">
                        {appliedCoupon.kind === "percent"
                          ? `-${appliedCoupon.value}%`
                          : `-${price(appliedCoupon.value, locale, currency)}`}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => { setAppliedCoupon(null); setCouponError(null); }}
                      aria-label={en ? "Remove coupon" : "Quitar cupón"}
                      className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      maxLength={24}
                      onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void applyCoupon(); } }}
                      placeholder={en ? "e.g. IG10" : "Ej. IG10"}
                      className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-3 font-mono text-xs uppercase outline-none focus:border-ring"
                    />
                    <button
                      type="button"
                      disabled={!couponInput.trim() || checkingCoupon}
                      onClick={() => void applyCoupon()}
                      className="h-9 shrink-0 rounded-lg border bg-card px-3.5 text-xs font-semibold transition hover:bg-muted disabled:opacity-50"
                    >
                      {checkingCoupon ? <Loader2 className="size-3.5 animate-spin" /> : (en ? "Apply" : "Aplicar")}
                    </button>
                  </div>
                )}
                {couponError && <p className="text-xs text-destructive">{couponError}</p>}
                {couponBelowMin && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    {en
                      ? `Minimum order for this coupon is ${price(appliedCoupon!.minOrderCents, locale, currency)}.`
                      : `El mínimo para este cupón es ${price(appliedCoupon!.minOrderCents, locale, currency)}.`}
                  </p>
                )}
              </div>

              <div className="grid gap-2 border-t pt-4">
                <input
                  type="text"
                  value={customerName}
                  maxLength={80}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={en ? "Your name (optional)" : "Tu nombre (opcional)"}
                  className="h-9 w-full rounded-lg border bg-background px-3 text-xs outline-none focus:border-ring"
                />
                <input
                  type="text"
                  value={notes}
                  maxLength={400}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={en ? "Order notes (optional)" : "Notas del pedido (opcional)"}
                  className="h-9 w-full rounded-lg border bg-background px-3 text-xs outline-none focus:border-ring"
                />
              </div>
            </div>
          )}
        </div>

        {cart.items.length > 0 && (
          <div className="grid gap-2.5 border-t bg-card px-6 py-4">
            {(discountCents > 0 || deliveryMethod === "delivery") && (
              <div className="grid gap-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-mono">{price(subtotalCents, locale, currency)}</span>
                </div>
                {discountCents > 0 && appliedCoupon && (
                  <div className="flex justify-between text-success">
                    <span>{en ? "Discount" : "Descuento"} ({appliedCoupon.code})</span>
                    <span className="font-mono">-{price(discountCents, locale, currency)}</span>
                  </div>
                )}
                {deliveryMethod === "delivery" && (
                  <div className="flex justify-between">
                    <span>{en ? "Delivery" : "Envío"}</span>
                    <span className="font-mono">
                      {deliveryCfg?.deliveryFeeMode === "free"
                        ? (en ? "Free" : "Gratis")
                        : deliveryCfg?.deliveryFeeMode === "fixed"
                          ? price(deliveryFeeCents, locale, currency)
                          : (en ? "To be arranged" : "A coordinar")}
                    </span>
                  </div>
                )}
              </div>
            )}
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-muted-foreground">Total</span>
              <span className="font-mono text-xl font-bold">{price(finalTotalCents, locale, currency)}</span>
            </div>
            {submitError && <p className="text-xs font-medium text-destructive">{submitError}</p>}
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleCheckout()}
              className={cn(
                "flex h-12 items-center justify-center gap-2 px-5 text-sm font-semibold transition disabled:opacity-60",
                buttonRadiusClass(shop.style?.radius),
                primaryButtonClass(shop.style?.buttonStyle),
              )}
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : shop.whatsapp ? <WhatsAppIcon className="size-5" /> : <ShoppingBag className="size-4" />}
              {submitting
                ? (en ? "Creating order…" : "Registrando pedido…")
                : shop.whatsapp
                  ? (en ? "Send order via WhatsApp" : "Enviar pedido por WhatsApp")
                  : (en ? "Confirm order" : "Confirmar pedido")}
            </button>
            <button
              type="button" onClick={() => { cart.clear(); setAppliedCoupon(null); setSubmitError(null); }}
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
