import { useState, type ReactNode } from "react";
import { ChevronDown, ImageIcon, Plus, Trash2, Upload, X } from "lucide-react";
import { price, type Product } from "./catalog";
import { field, type PanelShop } from "./panel";
import { CheckField, Field, FormSelect, PanelForm, SectionHead, slugPattern, usePanelAction } from "./PanelForm";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PanelCatalog({ shop }: { shop: PanelShop }) {
  const [adding, setAdding] = useState(false);
  return (
    <Card className="rounded-2xl">
      <SectionHead label="Catálogo" title="Productos y servicios" text="Tocá una ficha para editarla. La posición ordena el catálogo de menor a mayor." />
      <CardContent className="grid gap-4">
        <Collapsible open={adding} onOpenChange={setAdding} className="rounded-xl border">
          <CollapsibleTrigger asChild>
            <button type="button" className="flex w-full items-center gap-3 px-4 py-3.5 text-left font-semibold">
              <span className="grid size-7 place-items-center rounded-full bg-accent text-accent-foreground">
                <Plus className={"size-4 transition-transform " + (adding ? "rotate-45" : "")} />
              </span>
              Agregar producto o servicio
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t px-4 py-5">
            <ItemForm shopSlug={shop.slug} onSaved={() => setAdding(false)} />
          </CollapsibleContent>
        </Collapsible>

        {!shop.products?.length && (
          <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
            Tu catálogo está vacío. Agregá tu primera ficha.
          </p>
        )}
        <div className="divide-y">
          {shop.products?.map((item) => (
            <Row key={item.slug} summary={
              <>
                {item.imageUrl
                  ? <img src={item.imageUrl} alt="" referrerPolicy="no-referrer" className="size-12 shrink-0 rounded-lg object-cover" />
                  : <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><ImageIcon className="size-5" /></span>}
                <span className="grid min-w-0 flex-1">
                  <span className="truncate font-semibold">{item.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {item.kind === "service" ? "Servicio" + (item.durationMinutes ? " · " + item.durationMinutes + " min" : "") : "Producto"}
                  </span>
                </span>
                {item.hidden && <Badge variant="secondary">Oculto</Badge>}
                {!item.available && !item.hidden && <Badge variant="secondary">No disponible</Badge>}
                <span className="font-mono text-sm">{price(item.priceCents)}</span>
              </>
            }>
              <ItemForm shopSlug={shop.slug} item={item} />
              <DeleteItem shopSlug={shop.slug} item={item} />
            </Row>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** Expandable list row shared by the catalog and the agenda. */
export function Row({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  return (
    <Collapsible className="group/row">
      <CollapsibleTrigger asChild>
        <button type="button" className="flex w-full items-center gap-3.5 rounded-xl px-2 py-3.5 text-left transition-colors hover:bg-muted/60">
          {summary}
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/row:rotate-180" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="grid gap-6 px-2 pt-3 pb-6">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function DeleteItem({ shopSlug, item }: { shopSlug: string; item: Product }) {
  const { run, pending } = usePanelAction();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="justify-self-start text-destructive hover:bg-destructive/10 hover:text-destructive">
          <Trash2 /> Eliminar ficha
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar “{item.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            La ficha y su enlace dejarán de existir. Si solo querés retirarla un tiempo, marcala como oculta.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Volver</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={() => void run({ action: "eliminar-item", shopSlug, item: { slug: item.slug } }, "Ficha eliminada")}
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function surcharge(item: Product | undefined, group: string, value: string) {
  const cents = item?.options?.[Number(group)]?.prices?.[Number(value)] ?? 0;
  return cents > 0 ? (cents / 100).toFixed(2) : undefined;
}

function ImageField({ initial }: { initial?: string }) {
  const [url, setUrl] = useState(initial ?? "");
  const [status, setStatus] = useState<{ text: string; error?: boolean }>();
  async function upload(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      setStatus({ text: "La foto supera los 5 MB", error: true });
      return;
    }
    setStatus({ text: "Subiendo foto…" });
    try {
      const response = await fetch("/subir", { method: "POST", body: file });
      if (response.status === 401) {
        window.location.assign("/ingresar");
        return;
      }
      if (!response.ok) throw new Error((await response.text()).trim() || "No se pudo subir la foto");
      const result = await response.json();
      setUrl(result.url);
      setStatus({ text: "Foto lista. Guardá la ficha para publicarla." });
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : "No se pudo subir la foto", error: true });
    }
  }
  return (
    <div className="grid gap-3">
      <Label>Foto</Label>
      <div className="flex flex-wrap items-center gap-4">
        {url
          ? <img src={url} alt="" referrerPolicy="no-referrer" className="size-28 rounded-xl object-cover" />
          : <span className="grid size-28 place-items-center rounded-xl border border-dashed bg-muted/40 text-muted-foreground"><ImageIcon /></span>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="rounded-full" asChild>
            <label className="cursor-pointer">
              <Upload /> Subir foto
              <input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void upload(file);
              }} />
            </label>
          </Button>
          {url && (
            <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => { setUrl(""); setStatus(undefined); }}>
              <X /> Quitar foto
            </Button>
          )}
        </div>
      </div>
      <Field label="O URL de la foto">
        <Input name="imageUrl" placeholder="https://…" maxLength={2048} value={url} onChange={(event) => setUrl(event.target.value)} />
      </Field>
      {status && (
        <p role={status.error ? "alert" : "status"} className={"text-sm " + (status.error ? "text-destructive" : "text-muted-foreground")}>
          {status.text}
        </p>
      )}
    </div>
  );
}

function ItemForm({ shopSlug, item, onSaved }: { shopSlug: string; item?: Product; onSaved?: () => void }) {
  const [kind, setKind] = useState<Product["kind"]>(item?.kind ?? "product");
  const [groups, setGroups] = useState(() => (item?.options ?? []).map((option, index) => ({
    id: String(index),
    values: option.values.map((_, valueIndex) => String(valueIndex)),
  })));
  return (
    <PanelForm
      submit={item ? "Guardar ficha" : "Agregar al catálogo"}
      success={item ? "Ficha guardada" : "Ficha agregada"}
      clear={!item}
      onSaved={item ? undefined : () => {
        setKind("product");
        setGroups([]);
        onSaved?.();
      }}
      payload={(form) => ({
        action: item ? "editar-item" : "crear-item",
        shopSlug,
        item: {
          slug: item?.slug ?? field(form, "slug"),
          name: field(form, "name"),
          kind,
          durationMinutes: Number(field(form, "durationMinutes")),
          priceCents: Math.round(Number(field(form, "price")) * 100),
          imageUrl: field(form, "imageUrl"),
          options: groups.map((group) => ({
            name: field(form, "group-" + group.id),
            values: group.values.map((id) => field(form, "value-" + group.id + "-" + id)),
            prices: group.values.map((id) => Math.round(Number(field(form, "price-" + group.id + "-" + id) || 0) * 100)),
          })),
          position: Number(field(form, "position")),
          available: form.has("available"),
          hidden: form.has("hidden"),
        },
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Nombre"><Input name="name" defaultValue={item?.name} required maxLength={120} /></Field>
        {!item && (
          <Field label="Enlace de la ficha">
            <Input name="slug" required maxLength={64} placeholder="mi-producto" pattern={slugPattern} className="font-mono" />
          </Field>
        )}
        {!item && (
          <Field label="Tipo">
            <FormSelect
              value={kind} onValueChange={(value) => setKind(value === "service" ? "service" : "product")}
              options={[{ value: "product", label: "Producto" }, { value: "service", label: "Servicio" }]}
            />
          </Field>
        )}
        <Field label="Precio en USD">
          <Input name="price" type="number" min={0} max={999999.99} step={0.01} defaultValue={item ? (item.priceCents / 100).toFixed(2) : undefined} required />
        </Field>
        {kind === "service" && (
          <Field label="Duración en minutos">
            <Input name="durationMinutes" type="number" min={1} max={1440} defaultValue={item?.durationMinutes} required />
          </Field>
        )}
        <Field label="Posición en el catálogo">
          <Input name="position" type="number" min={0} max={999999} defaultValue={item?.position ?? 0} required />
        </Field>
      </div>

      <ImageField initial={item?.imageUrl} />

      <div className="grid gap-3">
        <h3 className="font-display text-lg font-semibold tracking-tight">Variantes</h3>
        {groups.map((group, index) => (
          <div key={group.id} className="grid gap-3 rounded-xl border bg-muted/40 p-4">
            <Field label="Nombre de la variante">
              <Input name={"group-" + group.id} defaultValue={item?.options?.[Number(group.id)]?.name} placeholder="Tamaño" maxLength={60} required />
            </Field>
            {group.values.map((id) => (
              <div key={id} className="flex flex-wrap items-end gap-2.5">
                <Field label="Opción" className="flex-[1_1_10rem]">
                  <Input name={"value-" + group.id + "-" + id} defaultValue={item?.options?.[Number(group.id)]?.values[Number(id)]} placeholder="A4" maxLength={60} required />
                </Field>
                <Field label="Recargo USD" className="flex-[1_1_10rem]">
                  <Input name={"price-" + group.id + "-" + id} type="number" min={0} max={999999.99} step={0.01} placeholder="0.00" defaultValue={surcharge(item, group.id, id)} />
                </Field>
                <Button type="button" variant="ghost" size="icon" aria-label="Quitar opción" disabled={group.values.length === 1} onClick={() => {
                  setGroups(groups.map((current) => current.id === group.id ? {
                    ...current, values: current.values.filter((value) => value !== id),
                  } : current));
                }}><X /></Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="rounded-full" disabled={group.values.length >= 12} onClick={() => {
                const id = crypto.randomUUID();
                setGroups(groups.map((current) => current.id === group.id ? { ...current, values: [...current.values, id] } : current));
              }}><Plus /> Agregar opción</Button>
              <Button type="button" variant="ghost" size="sm" className="rounded-full text-muted-foreground" onClick={() => setGroups(groups.filter((current) => current.id !== group.id))}>
                Quitar variante {index + 1}
              </Button>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="justify-self-start rounded-full" disabled={groups.length >= 8} onClick={() => {
          setGroups([...groups, { id: crypto.randomUUID(), values: ["0"] }]);
        }}><Plus /> Agregar variante</Button>
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-3">
        <CheckField name="available" label="Disponible" defaultChecked={item?.available ?? true} />
        <CheckField name="hidden" label="Ocultar del catálogo público" defaultChecked={item?.hidden ?? false} />
      </div>
    </PanelForm>
  );
}
