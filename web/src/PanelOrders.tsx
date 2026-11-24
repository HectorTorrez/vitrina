import { useMemo, useState, type FormEvent } from "react";
import { Check, CheckCircle2, CreditCard, Loader2, MapPin, PackageCheck, Plus, ShoppingBag, Store, Tag, Trash2, Truck, XCircle } from "lucide-react";
import { paymentMethodLabel, price } from "./catalog";
import { useI18n } from "./i18n";
import type { OrderStatus, PanelOrder, ShopCoupon } from "./orders";
import type { PanelShop } from "./panel";
import { AffixInput, Field, FormSection, SectionHead, usePanelAction } from "./PanelForm";
import { shopToday } from "./booking";
import { WhatsAppIcon } from "./store/StoreParts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Tab = "orders" | "coupons";
type StatusFilter = "all" | OrderStatus;

function statusMeta(status: OrderStatus, en: boolean) {
  switch (status) {
    case "new":
      return { label: en ? "New" : "Nuevo", className: "border-blue-300 bg-blue-50 text-blue-800" };
    case "confirmed":
      return { label: en ? "Confirmed" : "Confirmado", className: "border-amber-300 bg-amber-50 text-amber-800" };
    case "delivered":
      return { label: en ? "Delivered" : "Entregado", className: "border-emerald-300 bg-emerald-50 text-emerald-800" };
    case "cancelled":
      return { label: en ? "Cancelled" : "Cancelado", className: "border-border bg-muted text-muted-foreground" };
  }
}

export function PanelOrders({ shop }: { shop: PanelShop }) {
  const { locale } = useI18n();
  const en = locale === "en";
  const currency = shop.currency || "USD";
  const orders = shop.orders ?? [];
  const coupons = shop.coupons ?? [];

  const [tab, setTab] = useState<Tab>("orders");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const { run, pending } = usePanelAction();

  const currentMonth = shopToday(0, shop.timezone).slice(0, 7);
  const monthlyStats = useMemo(() => {
    const inMonth = orders.filter((o) => o.localMonth === currentMonth && o.status !== "cancelled");
    const totalCents = inMonth.reduce((sum, o) => sum + o.totalCents, 0);
    const confirmedCents = inMonth.filter((o) => o.status === "confirmed" || o.status === "delivered").reduce((sum, o) => sum + o.totalCents, 0);
    return { count: inMonth.length, totalCents, confirmedCents };
  }, [orders, currentMonth]);

  const counts: Record<StatusFilter, number> = {
    all: orders.length,
    new: orders.filter((o) => o.status === "new").length,
    confirmed: orders.filter((o) => o.status === "confirmed").length,
    delivered: orders.filter((o) => o.status === "delivered").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
  };

  const visibleOrders = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  function setStatus(order: PanelOrder, status: OrderStatus) {
    const label = statusMeta(status, en).label.toLowerCase();
    void run(
      { action: "estado-pedido", shopSlug: shop.slug, orderId: order.id, orderStatus: status },
      en ? `Order ${order.code} marked as ${label}` : `Pedido ${order.code} marcado como ${label}`,
    );
  }

  return (
    <div className="grid gap-6">
      <SectionHead
        label={en ? "Sales" : "Ventas"}
        title={en ? "Orders & coupons" : "Pedidos y cupones"}
        text={en
          ? "Track orders sent from your storefront and manage discount codes."
          : "Seguí los pedidos enviados desde tu tienda y administrá cupones de descuento."}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-full border bg-card p-1">
          <button
            type="button"
            onClick={() => setTab("orders")}
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded-full px-4 text-sm font-medium transition",
              tab === "orders" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ShoppingBag className="size-3.5" />
            {en ? "Orders" : "Pedidos"}
            <span className="opacity-70">{orders.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("coupons")}
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded-full px-4 text-sm font-medium transition",
              tab === "coupons" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Tag className="size-3.5" />
            {en ? "Coupons" : "Cupones"}
            <span className="opacity-70">{coupons.length}</span>
          </button>
        </div>
      </div>

      {tab === "orders" ? (
        <div className="grid gap-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1 rounded-2xl border bg-card p-4">
              <span className="text-xs text-muted-foreground">{en ? "Estimated this month" : "Monto estimado del mes"}</span>
              <span className="font-display text-2xl font-bold tracking-tight">{price(monthlyStats.totalCents, locale, currency)}</span>
              <span className="text-xs text-muted-foreground">
                {monthlyStats.count} {monthlyStats.count === 1 ? (en ? "active order" : "pedido activo") : (en ? "active orders" : "pedidos activos")}
              </span>
            </div>
            <div className="grid gap-1 rounded-2xl border bg-card p-4">
              <span className="text-xs text-muted-foreground">{en ? "Confirmed / Delivered" : "Confirmados / Entregados"}</span>
              <span className="font-display text-2xl font-bold tracking-tight">{price(monthlyStats.confirmedCents, locale, currency)}</span>
              <span className="text-xs text-muted-foreground">{en ? "Current month" : "Mes actual"}</span>
            </div>
            <div className="grid gap-1 rounded-2xl border bg-card p-4">
              <span className="text-xs text-muted-foreground">{en ? "New pending review" : "Nuevos por confirmar"}</span>
              <span className="font-display text-2xl font-bold tracking-tight">{counts.new}</span>
              <span className="text-xs text-muted-foreground">{en ? "All time" : "En bandeja"}</span>
            </div>
          </div>

          {orders.length > 0 && (
            <div className="flex gap-1 overflow-x-auto rounded-full border bg-card p-1 [scrollbar-width:none] sm:w-fit">
              {([
                ["all", en ? "All" : "Todos"],
                ["new", en ? "New" : "Nuevos"],
                ["confirmed", en ? "Confirmed" : "Confirmados"],
                ["delivered", en ? "Delivered" : "Entregados"],
                ["cancelled", en ? "Cancelled" : "Cancelados"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={cn(
                    "h-8 shrink-0 rounded-full px-3.5 text-sm font-medium transition",
                    filter === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label} <span className="opacity-60">{counts[value]}</span>
                </button>
              ))}
            </div>
          )}

          {orders.length === 0 ? (
            <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
              <span className="grid size-14 place-items-center rounded-2xl bg-accent text-brand-ink">
                <ShoppingBag className="size-6" />
              </span>
              <p className="font-display text-xl font-semibold">{en ? "No orders yet" : "Todavía no tenés pedidos"}</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {en
                  ? "When customers send their bag via WhatsApp, each order appears here with a short code like #1001."
                  : "Cuando tus clientes envíen su carrito por WhatsApp, cada pedido aparecerá aquí con un código corto como #1001."}
              </p>
            </div>
          ) : visibleOrders.length === 0 ? (
            <p className="rounded-2xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
              {en ? "No orders with this status." : "No hay pedidos con este estado."}
            </p>
          ) : (
            <ul className="grid gap-3">
              {visibleOrders.map((order) => {
                const meta = statusMeta(order.status, en);
                return (
                  <li key={order.id} className="grid gap-4 rounded-2xl border bg-card p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="grid gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-base font-bold">{order.code}</span>
                          <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
                          <span className="font-mono text-xs text-muted-foreground">{order.localCreatedAt.replace("T", " · ")}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                          {order.customerName && <span className="font-medium text-foreground">{order.customerName}</span>}
                          {order.customerPhone && (
                            <a
                              href={"https://wa.me/" + order.customerPhone.replace(/\D/g, "")}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-foreground underline underline-offset-4"
                            >
                              <WhatsAppIcon className="size-3.5" /> {order.customerPhone}
                            </a>
                          )}
                          {order.deliveryMethod && (
                            <span className="inline-flex items-center gap-1 text-xs">
                              {order.deliveryMethod === "delivery" ? <Truck className="size-3.5" /> : <Store className="size-3.5" />}
                              {order.deliveryMethod === "delivery" ? (en ? "Delivery" : "Envío") : (en ? "Pickup" : "Retiro")}
                            </span>
                          )}
                          {order.paymentMethod && (
                            <span className="inline-flex items-center gap-1 text-xs">
                              <CreditCard className="size-3.5" />
                              {paymentMethodLabel(order.paymentMethod, locale)}
                            </span>
                          )}
                          {order.couponCode && (
                            <span className="inline-flex items-center gap-1 font-mono text-xs text-success">
                              <Tag className="size-3" /> {order.couponCode} (-{price(order.discountCents, locale, currency)})
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="font-mono text-lg font-bold">{price(order.totalCents, locale, currency)}</span>
                    </div>

                    <ul className="grid gap-1.5 rounded-xl bg-muted/40 p-3 text-sm">
                      {order.items.map((item, idx) => (
                        <li key={item.slug + idx} className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0">
                            <span className="font-mono font-semibold">{item.quantity}x</span> {item.name}
                            {item.choices && Object.keys(item.choices).length > 0 && (
                              <span className="ml-1.5 text-xs text-muted-foreground">
                                ({Object.entries(item.choices).map(([k, v]) => `${k}: ${v}`).join(" · ")})
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 font-mono text-xs text-muted-foreground">
                            {price(item.unitPriceCents * item.quantity, locale, currency)}
                          </span>
                        </li>
                      ))}
                      {order.deliveryFeeCents > 0 && (
                        <li className="flex items-baseline justify-between gap-3 border-t pt-1.5 text-xs text-muted-foreground">
                          <span>{en ? "Delivery fee" : "Costo de envío"}</span>
                          <span className="font-mono">{price(order.deliveryFeeCents, locale, currency)}</span>
                        </li>
                      )}
                    </ul>

                    {(order.deliveryAddress || order.notes) && (
                      <div className="grid gap-1 text-xs text-muted-foreground">
                        {order.deliveryAddress && (
                          <p className="flex items-start gap-1.5">
                            <MapPin className="mt-0.5 size-3.5 shrink-0" /> {order.deliveryAddress}
                          </p>
                        )}
                        {order.notes && <p className="italic">“{order.notes}”</p>}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                      <span className="text-xs text-muted-foreground">
                        {order.stockDeducted && (en ? "Stock deducted" : "Stock descontado")}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {order.status === "new" && (
                          <Button type="button" size="sm" className="rounded-full" disabled={pending} onClick={() => setStatus(order, "confirmed")}>
                            <Check className="size-3.5" /> {en ? "Confirm" : "Confirmar"}
                          </Button>
                        )}
                        {(order.status === "new" || order.status === "confirmed") && (
                          <Button type="button" size="sm" variant="outline" className="rounded-full" disabled={pending} onClick={() => setStatus(order, "delivered")}>
                            <PackageCheck className="size-3.5" /> {en ? "Mark delivered" : "Entregado"}
                          </Button>
                        )}
                        {order.status !== "cancelled" && (
                          <Button type="button" size="sm" variant="ghost" className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={pending} onClick={() => setStatus(order, "cancelled")}>
                            <XCircle className="size-3.5" /> {en ? "Cancel" : "Cancelar"}
                          </Button>
                        )}
                        {order.status === "cancelled" && (
                          <Button type="button" size="sm" variant="outline" className="rounded-full" disabled={pending} onClick={() => setStatus(order, "new")}>
                            <CheckCircle2 className="size-3.5" /> {en ? "Reopen" : "Reabrir"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <CouponsSection shop={shop} coupons={coupons} />
      )}
    </div>
  );
}

function CouponsSection({ shop, coupons }: { shop: PanelShop; coupons: ShopCoupon[] }) {
  const { locale } = useI18n();
  const en = locale === "en";
  const currency = shop.currency || "USD";
  const { run, pending } = usePanelAction();

  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("10");
  const [minOrder, setMinOrder] = useState("");
  const [expiresDate, setExpiresDate] = useState("");

  async function create(event: FormEvent) {
    event.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;
    const numValue = kind === "percent"
      ? Math.round(Number(value || 0))
      : Math.round(Number(value.replace(",", ".") || 0) * 100);
    const minOrderCents = minOrder.trim() ? Math.round(Number(minOrder.replace(",", ".") || 0) * 100) : 0;
    const ok = await run(
      {
        action: "crear-cupon",
        shopSlug: shop.slug,
        coupon: {
          code: cleanCode,
          kind,
          value: numValue,
          minOrderCents,
          expiresDate,
          active: true,
        },
      },
      en ? "Coupon created" : "Cupón creado",
    );
    if (ok) {
      setCode("");
      setValue(kind === "percent" ? "10" : "");
      setMinOrder("");
      setExpiresDate("");
    }
  }

  return (
    <div className="grid gap-6">
      <FormSection
        title={en ? "New discount code" : "Nuevo cupón de descuento"}
        text={en ? "Customers can enter this code in their bag before sending the order." : "Tus clientes pueden aplicar este código en el carrito antes de enviar su pedido."}
      >
        <form onSubmit={create} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={en ? "Code" : "Código"} hint={en ? "2–24 letters or numbers" : "2 a 24 letras o números"}>
              <Input
                value={code}
                maxLength={24}
                required
                placeholder="IG10"
                className="h-10 font-mono uppercase"
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
              />
            </Field>
            <div className="grid content-start gap-2">
              <span className="text-sm font-medium">{en ? "Type" : "Tipo"}</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setKind("percent")}
                  className={cn(
                    "h-10 flex-1 rounded-lg border text-sm font-medium transition",
                    kind === "percent" ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-foreground/40",
                  )}
                >
                  % {en ? "Percent" : "Porcentaje"}
                </button>
                <button
                  type="button"
                  onClick={() => setKind("fixed")}
                  className={cn(
                    "h-10 flex-1 rounded-lg border text-sm font-medium transition",
                    kind === "fixed" ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-foreground/40",
                  )}
                >
                  $ {en ? "Fixed" : "Monto fijo"}
                </button>
              </div>
            </div>
            <Field label={kind === "percent" ? (en ? "Discount (%)" : "Descuento (%)") : (en ? "Discount amount" : "Monto de descuento")}>
              {kind === "percent" ? (
                <AffixInput
                  suffix="%"
                  value={value}
                  inputMode="numeric"
                  placeholder="10"
                  inputClassName="font-mono"
                  onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 3))}
                />
              ) : (
                <AffixInput
                  prefix="$"
                  suffix={currency}
                  value={value}
                  inputMode="decimal"
                  placeholder="5.00"
                  inputClassName="font-mono"
                  onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ""))}
                />
              )}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={en ? "Minimum subtotal" : "Pedido mínimo"} optional>
              <AffixInput
                prefix="$"
                suffix={currency}
                value={minOrder}
                inputMode="decimal"
                placeholder="0.00"
                inputClassName="font-mono"
                onChange={(e) => setMinOrder(e.target.value.replace(/[^\d.,]/g, ""))}
              />
            </Field>
            <Field label={en ? "Expiration date" : "Fecha de vencimiento"} optional>
              <Input type="date" value={expiresDate} onChange={(e) => setExpiresDate(e.target.value)} className="h-10" />
            </Field>
          </div>
          <div>
            <Button type="submit" disabled={pending || !code.trim() || !value.trim()} className="rounded-full px-5">
              {pending ? <Loader2 className="animate-spin" /> : <Plus />}
              {en ? "Create coupon" : "Crear cupón"}
            </Button>
          </div>
        </form>
      </FormSection>

      {coupons.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
          {en ? "You haven't created any discount codes yet." : "Todavía no creaste cupones de descuento."}
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {coupons.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
              <div className="grid gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold">{c.code}</span>
                  <Badge variant="secondary" className="font-mono">
                    {c.kind === "percent" ? `-${c.value}%` : `-${price(c.value, locale, currency)}`}
                  </Badge>
                  {!c.active && <Badge variant="outline">{en ? "Paused" : "Inactivo"}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {c.uses} {c.uses === 1 ? (en ? "use" : "uso") : (en ? "uses" : "usos")}
                  {c.minOrderCents > 0 && ` · ${en ? "Min." : "Mín."} ${price(c.minOrderCents, locale, currency)}`}
                  {c.expiresDate && ` · ${en ? "Expires" : "Vence"} ${c.expiresDate}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={c.active}
                  disabled={pending}
                  aria-label={c.code}
                  onCheckedChange={(active) =>
                    void run(
                      { action: "editar-cupon", shopSlug: shop.slug, coupon: { ...c, active } },
                      active ? (en ? "Coupon activated" : "Cupón activado") : (en ? "Coupon paused" : "Cupón desactivado"),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={pending}
                  aria-label={en ? "Delete coupon" : "Eliminar cupón"}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    void run(
                      { action: "eliminar-cupon", shopSlug: shop.slug, coupon: { id: c.id } },
                      en ? "Coupon deleted" : "Cupón eliminado",
                    )
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
