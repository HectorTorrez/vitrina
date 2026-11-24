import { useState } from "react";
import {
  ArrowDown, ArrowUp, Clock, CopyPlus, ExternalLink, Eye, EyeOff, GripVertical, ImageIcon, Layers, MoreHorizontal, Package,
  Pencil, Plus, Search, Trash2,
} from "lucide-react";
import { hasSurcharges, price, type Product } from "./catalog";
import { useI18n } from "./i18n";
import type { PanelShop } from "./panel";
import { SectionHead, usePanelAction } from "./PanelForm";
import { ItemEditor, nextPosition } from "./PanelItemEditor";
import { uniqueSlug } from "./slug";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Filter = "all" | "product" | "service" | "hidden";

export function PanelCatalog({ shop }: { shop: PanelShop }) {
  const { locale, t } = useI18n();
  const products = shop.products;
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [draggingSlug, setDraggingSlug] = useState<string | null>(null);
  const [dragOverSlug, setDragOverSlug] = useState<string | null>(null);
  const { run, pending } = usePanelAction();
  const editingItem = products.find((item) => item.slug === editing);

  const words = query.trim().toLowerCase();
  const visible = products.filter((item) =>
    (filter === "all" || (filter === "hidden" ? item.hidden : item.kind === filter)) &&
    (!words || item.name.toLowerCase().includes(words) || item.slug.includes(words)));
  const counts: Record<Filter, number> = {
    all: products.length,
    product: products.filter((item) => item.kind === "product").length,
    service: products.filter((item) => item.kind === "service").length,
    hidden: products.filter((item) => item.hidden).length,
  };

  function reorderTo(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || toIndex >= products.length) return;
    const order = [...products];
    const [item] = order.splice(fromIndex, 1);
    order.splice(toIndex, 0, item);
    void run(
      { action: "reordenar-items", shopSlug: shop.slug, order: order.map((p) => p.slug) },
      locale === "en" ? "Order updated" : "Orden actualizado",
    );
  }

  function move(index: number, delta: number) {
    reorderTo(index, index + delta);
  }

  function duplicate(item: Product) {
    const slug = uniqueSlug(item.slug.slice(0, 58) + "-copia", products.map((product) => product.slug));
    void run({
      action: "crear-item", shopSlug: shop.slug,
      item: { ...item, slug, name: (item.name + " (copia)").slice(0, 120), hidden: true, position: nextPosition(products) },
    }, "Ficha duplicada como oculta");
  }

  return (
    <div className="grid gap-6">
      <SectionHead
        label={t("panel.nav.catalog")} title={t("catalog.title")}
        text={t("catalog.text")}
        action={<Button size="lg" className="rounded-full px-5" onClick={() => setCreating(true)}><Plus /> {t("catalog.newItem")}</Button>}
      />

      {products.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 overflow-x-auto rounded-full border bg-card p-1 [scrollbar-width:none]">
            {([["all", t("catalog.filterAll")], ["service", t("store.filterServices")], ["product", t("store.filterProducts")], ["hidden", t("catalog.filterHidden")]] as const)
              .filter(([value]) => value === "all" || counts[value] > 0)
              .map(([value, label]) => (
                <button
                  key={value} type="button" onClick={() => setFilter(value)}
                  className={cn("h-8 shrink-0 rounded-full px-3.5 text-sm font-medium transition", filter === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  {label} <span className="opacity-60">{counts[value]}</span>
                </button>
              ))}
          </div>
          {products.length > 5 && (
            <div className="relative ml-auto w-full sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("catalog.search")} className="h-10 rounded-full bg-card pl-9" />
            </div>
          )}
        </div>
      )}

      {products.length === 0 ? (
        <div className="grid justify-items-center gap-4 rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-accent text-brand-ink"><Package className="size-6" /></span>
          <div className="grid gap-1">
            <p className="font-display text-xl font-semibold">{t("catalog.emptyTitle")}</p>
            <p className="max-w-sm text-muted-foreground">{t("catalog.emptyDesc")}</p>
          </div>
          <Button size="lg" className="rounded-full px-6" onClick={() => setCreating(true)}><Plus /> {t("catalog.createFirst")}</Button>
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-card p-10 text-center text-muted-foreground">{t("catalog.noMatch")}</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {visible.map((item) => {
            const index = products.indexOf(item);
            const reorder = filter === "all" && !words;
            return (
              <li
                key={item.slug}
                draggable={reorder && !pending}
                onDragStart={() => setDraggingSlug(item.slug)}
                onDragOver={(e) => {
                  if (!reorder || !draggingSlug || draggingSlug === item.slug) return;
                  e.preventDefault();
                  setDragOverSlug(item.slug);
                }}
                onDragLeave={() => dragOverSlug === item.slug && setDragOverSlug(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  if (reorder && draggingSlug && draggingSlug !== item.slug) {
                    const from = products.findIndex((p) => p.slug === draggingSlug);
                    const to = products.findIndex((p) => p.slug === item.slug);
                    reorderTo(from, to);
                  }
                  setDraggingSlug(null);
                  setDragOverSlug(null);
                }}
                onDragEnd={() => { setDraggingSlug(null); setDragOverSlug(null); }}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/40 sm:gap-4 sm:px-4",
                  item.hidden && "bg-muted/30",
                  draggingSlug === item.slug && "opacity-50",
                  dragOverSlug === item.slug && "bg-accent/60 ring-2 ring-primary/30 ring-inset",
                )}
              >
                {reorder && (
                  <div className="hidden items-center gap-1 sm:flex">
                    <span className="cursor-grab text-muted-foreground/60 active:cursor-grabbing" aria-hidden="true">
                      <GripVertical className="size-4" />
                    </span>
                    <div className="flex flex-col">
                      <button type="button" aria-label={t("catalog.moveUp")} disabled={pending || index === 0} onClick={() => move(index, -1)} className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"><ArrowUp className="size-3.5" /></button>
                      <button type="button" aria-label={t("catalog.moveDown")} disabled={pending || index === products.length - 1} onClick={() => move(index, 1)} className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"><ArrowDown className="size-3.5" /></button>
                    </div>
                  </div>
                )}
                <button type="button" onClick={() => setEditing(item.slug)} className="flex min-w-0 flex-1 items-center gap-3 text-left sm:gap-4">
                  {item.imageUrl
                    ? <img src={item.imageUrl} alt="" referrerPolicy="no-referrer" className={cn("size-14 shrink-0 rounded-xl object-cover", item.hidden && "opacity-50")} />
                    : <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"><ImageIcon className="size-5" /></span>}
                  <span className="grid min-w-0 flex-1 gap-1">
                    <span className="truncate font-semibold">{item.name}</span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        {item.kind === "service" ? <><Clock className="size-3.5" /> {item.durationMinutes} min</> : <><Package className="size-3.5" /> Producto</>}
                      </span>
                      {item.options.length > 0 && (
                        <span className="inline-flex items-center gap-1"><Layers className="size-3.5" /> {item.options.length} {item.options.length === 1 ? "variante" : "variantes"}</span>
                      )}
                      {item.hidden && <Badge variant="secondary" className="gap-1"><EyeOff /> Oculta</Badge>}
                      {!item.available && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">No disponible</Badge>}
                      {item.stock != null && (
                        <Badge
                          variant="outline"
                          className={cn(
                            item.stock === 0
                              ? "border-destructive/40 bg-destructive/10 text-destructive"
                              : item.stock <= 5
                                ? "border-amber-300 bg-amber-50 text-amber-800"
                                : "border-border bg-muted/50 text-muted-foreground",
                          )}
                        >
                          {item.stock === 0 ? (locale === "en" ? "Sold out" : "Agotado") : `Stock: ${item.stock}`}
                        </Badge>
                      )}
                    </span>
                  </span>
                  <span className="hidden text-right font-mono text-sm sm:block">
                    {hasSurcharges(item) && <span className="block text-xs text-muted-foreground">{t("store.from").toLowerCase()}</span>}
                    {price(item.priceCents, locale)}
                  </span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="shrink-0 rounded-full" aria-label={"Acciones de " + item.name}><MoreHorizontal /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditing(item.slug)}><Pencil /> Editar</DropdownMenuItem>
                    {!item.hidden && (
                      <DropdownMenuItem asChild>
                        <a href={"/tienda/" + shop.slug + "/" + item.slug} target="_blank" rel="noreferrer"><ExternalLink /> Ver en la tienda</a>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onSelect={() => void run(
                      { action: "editar-item", shopSlug: shop.slug, item: { ...item, hidden: !item.hidden } },
                      item.hidden ? "Ficha visible en la tienda" : "Ficha oculta",
                    )}>
                      {item.hidden ? <><Eye /> Mostrar en la tienda</> : <><EyeOff /> Ocultar de la tienda</>}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => duplicate(item)}><CopyPlus /> Duplicar</DropdownMenuItem>
                    {reorder && (
                      <>
                        <DropdownMenuItem disabled={index === 0} onSelect={() => move(index, -1)} className="sm:hidden"><ArrowUp /> Subir</DropdownMenuItem>
                        <DropdownMenuItem disabled={index === products.length - 1} onSelect={() => move(index, 1)} className="sm:hidden"><ArrowDown /> Bajar</DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(item)}><Trash2 /> Eliminar</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      )}

      <ItemEditor shop={shop} open={creating} onOpenChange={setCreating} />
      {editingItem && (
        <ItemEditor key={editingItem.slug} shop={shop} item={editingItem} open onOpenChange={(open) => !open && setEditing(null)} />
      )}

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              La ficha y su enlace dejarán de existir. Si solo querés retirarla un tiempo, ocultala.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            {deleting && !deleting.hidden && (
              <Button variant="outline" onClick={() => {
                void run({ action: "editar-item", shopSlug: shop.slug, item: { ...deleting, hidden: true } }, "Ficha oculta");
                setDeleting(null);
              }}>
                <EyeOff /> Ocultar
              </Button>
            )}
            <AlertDialogAction
              disabled={pending}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deleting && void run({ action: "eliminar-item", shopSlug: shop.slug, item: { slug: deleting.slug } }, "Ficha eliminada")}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
