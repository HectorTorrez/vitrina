import { PanelImageUpload } from "./PanelImageUpload";
import { uploadImage } from "./uploadImage";
import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Clock, Copy, ExternalLink, ImagePlus, Layers, Link2, Loader2,
  Package, Plus, Sparkles, Star, Trash2, X,
} from "lucide-react";
import { price, type Product } from "./catalog";
import type { PanelShop } from "./panel";
import { AffixInput, Field, FieldError, FormSection, Stepper, usePanelAction } from "./PanelForm";
import { cleanSlugInput, slugError, slugify, uniqueSlug } from "./slug";
import { ProductCard, StoreFrame } from "./store/StoreParts";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useCopied } from "@/lib/useCopied";

interface OptionDraft { id: string; value: string; surcharge: string }
interface GroupDraft { id: string; name: string; values: OptionDraft[] }
export interface ItemDraft {
  kind: Product["kind"];
  name: string;
  description: string;
  slug: string;
  slugEdited: boolean;
  price: string;
  duration: string;
  imageUrl: string;
  gallery: string[];
  groups: GroupDraft[];
  available: boolean;
  hidden: boolean;
  position: number;
}

let counter = 0;
const newId = () => "n" + ++counter;
const money = (cents: number) => (cents / 100).toFixed(2);
const toCents = (value: string) => Math.round(Number(value.replace(",", ".") || 0) * 100);
const validMoney = (value: string) => /^\d{1,6}([.,]\d{0,2})?$/.test(value.trim());
const validImage = (url: string) => url.startsWith("/media/") || /^https:\/\/[^/\s]+/.test(url);
const maxDescription = 2000;
const maxGallery = 8;

function toDraft(item: Product | undefined, nextPosition: number): ItemDraft {
  return {
    kind: item?.kind ?? "product",
    name: item?.name ?? "",
    description: item?.description ?? "",
    slug: item?.slug ?? "",
    slugEdited: Boolean(item),
    price: item ? money(item.priceCents) : "",
    duration: item?.durationMinutes ? String(item.durationMinutes) : "60",
    imageUrl: item?.imageUrl ?? "",
    gallery: item?.gallery ?? [],
    groups: (item?.options ?? []).map((group) => ({
      id: newId(),
      name: group.name,
      values: group.values.map((value, index) => ({
        id: newId(), value, surcharge: group.prices?.[index] ? money(group.prices[index]) : "",
      })),
    })),
    available: item?.available ?? true,
    hidden: item?.hidden ?? false,
    position: item?.position ?? nextPosition,
  };
}

export function nextPosition(products: Product[]) {
  return products.reduce((max, product) => Math.max(max, product.position + 10), 0);
}

function fromDraft(draft: ItemDraft) {
  return {
    slug: draft.slug,
    name: draft.name.trim(),
    description: draft.description.trim(),
    kind: draft.kind,
    durationMinutes: draft.kind === "service" ? Number(draft.duration) : 0,
    priceCents: toCents(draft.price),
    imageUrl: draft.imageUrl.trim(),
    gallery: draft.gallery,
    options: draft.groups.map((group) => ({
      name: group.name.trim(),
      values: group.values.map((option) => option.value.trim()),
      prices: group.values.map((option) => toCents(option.surcharge)),
    })),
    position: draft.position,
    available: draft.available,
    hidden: draft.hidden,
  };
}

interface ItemErrors {
  name?: string;
  description?: string;
  slug?: string;
  price?: string;
  duration?: string;
  imageUrl?: string;
  groups: Record<string, { name?: string; values: Record<string, string> }>;
}

function validate(draft: ItemDraft, takenSlugs: Set<string>, creating: boolean): ItemErrors {
  const errors: ItemErrors = { groups: {} };
  if (!draft.name.trim()) errors.name = "Escribí un nombre.";
  else if (draft.name.trim().length > 120) errors.name = "Usá hasta 120 caracteres.";
  if (draft.description.trim().length > maxDescription) errors.description = `Usá hasta ${maxDescription} caracteres.`;
  if (creating) {
    errors.slug = slugError(draft.slug) ?? (takenSlugs.has(draft.slug) ? "Otra ficha ya usa este enlace." : undefined);
  }
  if (!draft.price.trim()) errors.price = "Indicá el precio (puede ser 0).";
  else if (!validMoney(draft.price)) errors.price = "Usá un número con hasta 2 decimales, por ejemplo 18.50.";
  if (draft.kind === "service") {
    const minutes = Number(draft.duration);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) errors.duration = "Entre 1 y 1440 minutos.";
  }
  const url = draft.imageUrl.trim();
  if (url && !validImage(url)) errors.imageUrl = "Subí una foto o pegá una dirección que empiece con https://";
  const groupNames = new Set<string>();
  for (const group of draft.groups) {
    const groupErrors: { name?: string; values: Record<string, string> } = { values: {} };
    const name = group.name.trim();
    if (!name) groupErrors.name = "Poné un nombre, por ejemplo Tamaño.";
    else if (groupNames.has(name.toLowerCase())) groupErrors.name = "Ya hay otra variante con este nombre.";
    groupNames.add(name.toLowerCase());
    const values = new Set<string>();
    for (const option of group.values) {
      const value = option.value.trim();
      if (!value) groupErrors.values[option.id] = "Escribí la opción.";
      else if (values.has(value.toLowerCase())) groupErrors.values[option.id] = "Opción repetida.";
      else if (option.surcharge.trim() && !validMoney(option.surcharge)) groupErrors.values[option.id] = "Recargo inválido.";
      values.add(value.toLowerCase());
    }
    if (groupErrors.name || Object.keys(groupErrors.values).length) errors.groups[group.id] = groupErrors;
  }
  return errors;
}

const stepFields: (keyof ItemErrors)[][] = [["name", "description", "slug", "price", "duration"], ["imageUrl"], ["groups"], []];
function stepHasError(errors: ItemErrors, step: number) {
  return stepFields[step].some((key) => key === "groups" ? Object.keys(errors.groups).length > 0 : Boolean(errors[key]));
}

const steps = ["Información", "Fotos", "Variantes", "Publicar"];

export function ItemEditor({ shop, item, open, onOpenChange }: {
  shop: PanelShop;
  item?: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const products = shop.products;
  const [draft, setDraft] = useState(() => toDraft(item, nextPosition(products)));
  const [initial, setInitial] = useState(draft);
  const [step, setStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const { run, pending } = usePanelAction();
  const creating = !item;
  const taken = useMemo(() => new Set(products.map((product) => product.slug)), [products]);
  const errors = validate(draft, taken, creating);
  const visible: ItemErrors = showErrors ? errors : { groups: {} };
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const set = (patch: Partial<ItemDraft>) => setDraft((current) => ({ ...current, ...patch }));

  function reset() {
    const fresh = toDraft(item, nextPosition(products));
    setDraft(fresh);
    setInitial(fresh);
    setStep(0);
    setShowErrors(false);
  }

  function requestClose(next: boolean) {
    if (next) return onOpenChange(true);
    if (dirty && !pending) setConfirmClose(true);
    else {
      onOpenChange(false);
      if (creating) reset();
    }
  }

  function goTo(target: number) {
    if (creating && target > step && steps.slice(step, target).some((_, offset) => stepHasError(errors, step + offset))) {
      setShowErrors(true);
      return;
    }
    setStep(target);
  }

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (creating && step < steps.length - 1) return goTo(step + 1);
    const firstBad = steps.findIndex((_, index) => stepHasError(errors, index));
    if (firstBad >= 0) {
      setShowErrors(true);
      setStep(firstBad);
      return;
    }
    const ok = await run(
      { action: creating ? "crear-item" : "editar-item", shopSlug: shop.slug, item: fromDraft(draft) },
      creating ? "Ficha agregada al catálogo" : "Ficha guardada",
    );
    if (ok) {
      onOpenChange(false);
      if (creating) reset();
      else setInitial(draft);
    }
  }

  const lastStep = step === steps.length - 1;

  return (
    <>
      <Sheet open={open} onOpenChange={requestClose}>
        <SheetContent className="p-0" onOpenAutoFocus={(event) => event.preventDefault()}>
          <form onSubmit={save} noValidate className="flex min-h-0 flex-1 flex-col">
            <div className="grid gap-4 border-b px-5 pt-5 pb-4 sm:px-7">
              <div className="grid gap-1 pr-10">
                <SheetTitle>{creating ? "Nueva ficha" : draft.name || "Editar ficha"}</SheetTitle>
                <SheetDescription>
                  {creating ? "Completá los pasos; podés volver atrás en cualquier momento." : "Tocá un paso para ir directo a esa sección."}
                </SheetDescription>
              </div>
              <Stepper
                steps={steps.map((label, index) => ({ label, error: showErrors && stepHasError(errors, index) }))}
                current={step} onSelect={goTo}
                canSelect={(index) => !creating || index <= step || !steps.slice(0, index).some((_, i) => stepHasError(errors, i))}
              />
            </div>

            <fieldset disabled={pending} className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
              {step === 0 && <BasicsStep draft={draft} set={set} errors={visible} creating={creating} shop={shop} taken={taken} />}
              {step === 1 && <PhotoStep draft={draft} set={set} errors={visible} />}
              {step === 2 && <VariantsStep draft={draft} set={set} errors={visible} />}
              {step === 3 && <PublishStep draft={draft} set={set} shop={shop} />}
            </fieldset>

            <div className="flex items-center justify-between gap-3 border-t bg-card px-5 py-4 sm:px-7">
              {creating ? (
                step > 0
                  ? <Button type="button" variant="ghost" className="rounded-full" onClick={() => setStep(step - 1)}><ArrowLeft /> Atrás</Button>
                  : <Button type="button" variant="ghost" className="rounded-full" onClick={() => requestClose(false)}>Cancelar</Button>
              ) : (
                <p className="text-sm text-muted-foreground">{dirty ? "Cambios sin guardar" : "Sin cambios"}</p>
              )}
              <div className="flex gap-2">
                {creating && !lastStep && (
                  <Button type="submit" size="lg" className="rounded-full px-6">Siguiente <ArrowRight /></Button>
                )}
                {(!creating || lastStep) && (
                  <Button type={creating ? "submit" : "button"} size="lg" className="rounded-full px-6" disabled={pending || (!creating && !dirty)} onClick={creating ? undefined : () => void save()}>
                    {pending ? <Loader2 className="animate-spin" /> : <Check />}
                    {pending ? "Guardando…" : creating ? (draft.hidden ? "Guardar como oculta" : "Publicar ficha") : "Guardar cambios"}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar los cambios?</AlertDialogTitle>
            <AlertDialogDescription>Lo que cambiaste en esta ficha no se va a guardar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => { reset(); onOpenChange(false); }}>
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

type StepProps = { draft: ItemDraft; set: (patch: Partial<ItemDraft>) => void; errors: ItemErrors };

const durations = [15, 30, 45, 60, 90, 120];

function BasicsStep({ draft, set, errors, creating, shop, taken }: StepProps & { creating: boolean; shop: PanelShop; taken: Set<string> }) {
  const suggested = uniqueSlug(slugify(draft.name), taken);
  return (
    <div className="grid gap-6">
      {creating && (
        <div className="grid gap-2">
          <p className="text-sm font-medium">¿Qué vas a publicar?</p>
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Tipo">
            {([
              ["product", Package, "Producto", "Algo que vendés y entregás."],
              ["service", Clock, "Servicio", "Con duración; se puede reservar."],
            ] as const).map(([value, Icon, label, text]) => (
              <button
                key={value} type="button" role="radio" aria-checked={draft.kind === value} onClick={() => set({ kind: value })}
                className={cn(
                  "flex items-start gap-3 rounded-xl border-2 p-3.5 text-left transition",
                  draft.kind === value ? "border-primary bg-card" : "border-transparent bg-muted/70 hover:border-border",
                )}
              >
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", draft.kind === value ? "bg-primary text-primary-foreground" : "bg-card")}>
                  <Icon className="size-4.5" />
                </span>
                <span className="grid gap-0.5">
                  <span className="text-sm font-semibold">{label}</span>
                  <span className="text-xs text-muted-foreground">{text}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <Field label="Nombre" error={errors.name} counter={{ value: draft.name.length, max: 120 }}>
        <Input
          value={draft.name} maxLength={120} autoFocus className="h-10"
          placeholder={draft.kind === "service" ? "Manicura en gel" : "Lámina Sol de tarde"}
          onChange={(e) => set({ name: e.target.value, ...(!draft.slugEdited && creating ? { slug: uniqueSlug(slugify(e.target.value), taken) } : {}) })}
        />
      </Field>

      <Field
        label="Descripción" optional error={errors.description}
        counter={draft.description.length > maxDescription * 0.8 ? { value: draft.description.length, max: maxDescription } : undefined}
        hint={draft.kind === "service" ? "Contá qué incluye, cómo se prepara el cliente o cualquier detalle útil." : "Materiales, medidas, cuidados o lo que haga especial a tu producto."}
      >
        <Textarea
          value={draft.description} maxLength={maxDescription} rows={4} className="min-h-24 bg-card"
          placeholder={draft.kind === "service" ? "Incluye limado, cutícula y esmalte en gel de larga duración." : "Impresión giclée en papel de algodón de 300 g."}
          onChange={(e) => set({ description: e.target.value })}
        />
      </Field>

      {creating ? (
        <Field
          label="Enlace de la ficha" error={errors.slug}
          hint={draft.slugEdited ? "Se usa en la dirección de la ficha. No se puede cambiar después." : "Se arma solo a partir del nombre. No se puede cambiar después."}
        >
          <AffixInput
            prefix={"/" + shop.slug + "/"} value={draft.slug} maxLength={64} placeholder="mi-producto" inputClassName="font-mono"
            autoCapitalize="none" spellCheck={false}
            onChange={(e) => set({ slug: cleanSlugInput(e.target.value), slugEdited: true })}
            onBlur={() => set({ slug: draft.slug.replace(/-+$/, "") })}
            suffix={draft.name && draft.slug !== suggested ? (
              <Button type="button" variant="secondary" size="xs" className="rounded-full" onClick={() => set({ slug: suggested, slugEdited: false })}>
                <Sparkles /> Sugerir
              </Button>
            ) : draft.slug && !errors.slug ? <Check className="mr-1.5 size-4 text-success" /> : undefined}
          />
        </Field>
      ) : (
        <div className="grid gap-2">
          <p className="text-sm font-medium">Enlace de la ficha</p>
          <CopyLink path={"/tienda/" + shop.slug + "/" + draft.slug} />
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={draft.kind === "service" ? "Precio" : "Precio base"} error={errors.price} hint={draft.groups.length ? "Las variantes pueden sumar recargos." : undefined}>
          <AffixInput prefix="$" suffix="USD" value={draft.price} inputMode="decimal" placeholder="0.00" inputClassName="font-mono"
            onChange={(e) => set({ price: e.target.value.replace(/[^\d.,]/g, "") })}
            onBlur={() => validMoney(draft.price) && set({ price: money(toCents(draft.price)) })}
          />
        </Field>
        {draft.kind === "service" && (
          <Field label="Duración" error={errors.duration}>
            <AffixInput suffix="min" value={draft.duration} inputMode="numeric" inputClassName="font-mono" onChange={(e) => set({ duration: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
          </Field>
        )}
      </div>
      {draft.kind === "service" && (
        <div className="-mt-3 flex flex-wrap gap-1.5">
          {durations.map((minutes) => (
            <button
              key={minutes} type="button" onClick={() => set({ duration: String(minutes) })}
              className={cn("h-7 rounded-full border px-3 text-xs font-medium transition", draft.duration === String(minutes) ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-foreground/30")}
            >
              {minutes < 60 ? minutes + " min" : Math.floor(minutes / 60) + " h" + (minutes % 60 ? " " + (minutes % 60) : "")}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CopyLink({ path }: { path: string }) {
  const [copied, copy] = useCopied();
  return (
    <div className="flex h-10 items-center gap-2 rounded-lg border bg-muted/50 pr-1 pl-3">
      <Link2 className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate font-mono text-sm">{path}</span>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Copiar enlace" onClick={() => void copy(window.location.origin + path)}>
        {copied ? <Check className="text-success" /> : <Copy />}
      </Button>
      <Button asChild variant="ghost" size="icon-sm" aria-label="Abrir ficha">
        <a href={path} target="_blank" rel="noreferrer"><ExternalLink /></a>
      </Button>
    </div>
  );
}

function PhotoStep({ draft, set, errors }: StepProps) {
  const [showUrl, setShowUrl] = useState(Boolean(draft.imageUrl && !draft.imageUrl.startsWith("/media/")));

  return (
    <div className="grid gap-5">
      <PanelImageUpload label="Foto de la ficha" value={draft.imageUrl} onChange={(imageUrl) => set({ imageUrl })} />
      {showUrl ? (
        <Field label="Dirección de la foto" error={errors.imageUrl} hint="Pegá un enlace HTTPS a una imagen pública.">
          <Input value={draft.imageUrl} onChange={(e) => set({ imageUrl: e.target.value })} placeholder="https://…" maxLength={2048} className="h-10" />
        </Field>
      ) : (
        <button type="button" onClick={() => setShowUrl(true)} className="justify-self-start text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
          Prefiero pegar el enlace de una foto
        </button>
      )}
      {!draft.imageUrl && <p className="text-sm text-muted-foreground">La foto es opcional, pero las fichas con foto se ven mucho mejor en la tienda y al compartirlas.</p>}
      <GalleryEditor draft={draft} set={set} />
    </div>
  );
}

function GalleryEditor({ draft, set }: Omit<StepProps, "errors">) {
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  // Uploads finish one by one; always append to the latest draft.
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const gallery = draft.gallery;
  const room = maxGallery - gallery.length - busy;

  async function add(files: File[]) {
    setError(undefined);
    const batch = files.slice(0, Math.max(0, room));
    if (files.length > batch.length) setError(`Podés agregar hasta ${maxGallery} fotos adicionales.`);
    setBusy((count) => count + batch.length);
    for (const file of batch) {
      try {
        const url = await uploadImage(file);
        if (url) set({ gallery: [...draftRef.current.gallery, url] });
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "No se pudo subir la foto");
      } finally {
        setBusy((count) => count - 1);
      }
    }
  }

  const remove = (index: number) => set({ gallery: gallery.filter((_, i) => i !== index) });
  const makeMain = (index: number) => {
    const rest = gallery.filter((_, i) => i !== index);
    set({ imageUrl: gallery[index], gallery: draft.imageUrl ? [draft.imageUrl, ...rest] : rest });
  };
  const move = (index: number, delta: number) => {
    const next = [...gallery];
    const [photo] = next.splice(index, 1);
    next.splice(index + delta, 0, photo);
    set({ gallery: next });
  };

  return (
    <div className="grid gap-3 border-t pt-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="grid gap-0.5">
          <p className="font-medium">Más fotos <span className="font-normal text-muted-foreground">(opcional)</span></p>
          <p className="text-sm text-muted-foreground">Mostrá otros ángulos, detalles o resultados. Se ven en la página de la ficha.</p>
        </div>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{gallery.length}/{maxGallery}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {gallery.map((url, index) => (
          <div key={url + index} className="group relative aspect-square overflow-hidden rounded-xl bg-muted ring-1 ring-border">
            <img src={url} alt={`Foto adicional ${index + 1}`} referrerPolicy="no-referrer" className="size-full object-cover" />
            <div className="absolute inset-x-1 bottom-1 flex justify-between gap-0.5 opacity-100 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              <div className="flex gap-0.5">
                <Button type="button" variant="secondary" size="icon-xs" aria-label="Mover antes" disabled={index === 0} onClick={() => move(index, -1)}><ArrowLeft /></Button>
                <Button type="button" variant="secondary" size="icon-xs" aria-label="Mover después" disabled={index === gallery.length - 1} onClick={() => move(index, 1)}><ArrowRight /></Button>
              </div>
              <div className="flex gap-0.5">
                <Button type="button" variant="secondary" size="icon-xs" aria-label="Usar como foto principal" title="Usar como principal" onClick={() => makeMain(index)}><Star /></Button>
                <Button type="button" variant="secondary" size="icon-xs" aria-label="Quitar foto" onClick={() => remove(index)}><Trash2 /></Button>
              </div>
            </div>
          </div>
        ))}
        {Array.from({ length: busy }, (_, index) => (
          <div key={"busy" + index} className="grid aspect-square place-items-center rounded-xl bg-muted ring-1 ring-border">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ))}
        {room > 0 && (
          <button
            type="button" onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); void add(Array.from(e.dataTransfer.files)); }}
            className="grid aspect-square place-items-center rounded-xl border-2 border-dashed bg-muted/40 text-muted-foreground transition hover:border-primary hover:text-foreground"
          >
            <span className="grid justify-items-center gap-1 text-xs font-medium"><ImagePlus className="size-5" /> Agregar</span>
          </button>
        )}
      </div>
      <input
        ref={input} type="file" multiple className="sr-only" tabIndex={-1} aria-label="Agregar fotos adicionales"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          void add(files);
        }}
      />
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}

const presets: { name: string; values: string[] }[] = [
  { name: "Tamaño", values: ["Pequeño", "Mediano", "Grande"] },
  { name: "Color", values: ["Negro", "Blanco"] },
  { name: "Talla", values: ["S", "M", "L", "XL"] },
];

function VariantsStep({ draft, set, errors }: StepProps) {
  const base = validMoney(draft.price) ? toCents(draft.price) : 0;
  const focusNext = useRef<string | null>(null);
  const setGroups = (groups: GroupDraft[]) => set({ groups });
  const updateGroup = (id: string, patch: Partial<GroupDraft>) => setGroups(draft.groups.map((group) => group.id === id ? { ...group, ...patch } : group));
  const updateOption = (group: GroupDraft, id: string, patch: Partial<OptionDraft>) =>
    updateGroup(group.id, { values: group.values.map((option) => option.id === id ? { ...option, ...patch } : option) });
  const addOption = (group: GroupDraft) => {
    if (group.values.length >= 12) return;
    const id = newId();
    focusNext.current = id;
    updateGroup(group.id, { values: [...group.values, { id, value: "", surcharge: "" }] });
  };
  const addGroup = (preset?: { name: string; values: string[] }) => {
    if (draft.groups.length >= 8) return;
    const values = (preset?.values ?? [""]).map((value) => ({ id: newId(), value, surcharge: "" }));
    const group = { id: newId(), name: preset?.name ?? "", values };
    focusNext.current = preset ? null : "group-" + group.id;
    setGroups([...draft.groups, group]);
  };
  const move = (index: number, delta: number) => {
    const groups = [...draft.groups];
    const [group] = groups.splice(index, 1);
    groups.splice(index + delta, 0, group);
    setGroups(groups);
  };
  const autoFocus = (key: string) => (element: HTMLInputElement | null) => {
    if (element && focusNext.current === key) {
      element.focus();
      focusNext.current = null;
    }
  };

  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <p className="font-medium">Variantes y opciones</p>
        <p className="text-sm text-muted-foreground">
          Por ejemplo Tamaño (Pequeño, Grande) o Color. El cliente elige una opción de cada variante; si una opción cuesta más, poné el recargo.
        </p>
      </div>

      {draft.groups.map((group, index) => {
        const groupErrors = errors.groups[group.id];
        return (
          <FormSection
            key={group.id} title={group.name.trim() || "Variante " + (index + 1)} className="bg-muted/30 p-4 sm:p-5"
            aside={
              <div className="flex shrink-0 gap-0.5">
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Subir variante" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp /></Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Bajar variante" disabled={index === draft.groups.length - 1} onClick={() => move(index, 1)}><ArrowDown /></Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Quitar variante" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setGroups(draft.groups.filter((current) => current.id !== group.id))}><Trash2 /></Button>
              </div>
            }
          >
            <Field label="Nombre de la variante" error={groupErrors?.name}>
              <Input
                ref={autoFocus("group-" + group.id)} value={group.name} maxLength={60} placeholder="Tamaño" className="h-10 bg-card" list="variant-names"
                onChange={(e) => updateGroup(group.id, { name: e.target.value })}
              />
            </Field>
            <div className="grid gap-2">
              <div className="grid grid-cols-[minmax(0,1fr)_7.5rem_2rem] gap-2 px-0.5 text-xs font-medium text-muted-foreground sm:grid-cols-[minmax(0,1fr)_8rem_5.5rem_2rem]">
                <span>Opción</span><span>Recargo</span><span className="hidden sm:block">Total</span><span />
              </div>
              {group.values.map((option) => {
                const error = groupErrors?.values[option.id];
                const extra = validMoney(option.surcharge) ? toCents(option.surcharge) : 0;
                return (
                  <div key={option.id} className="grid gap-1">
                    <div className="grid grid-cols-[minmax(0,1fr)_7.5rem_2rem] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_5.5rem_2rem]">
                      <Input
                        ref={autoFocus(option.id)} value={option.value} maxLength={60} placeholder="Ej. Grande" className="h-10 bg-card"
                        aria-invalid={error ? true : undefined} aria-label="Opción"
                        onChange={(e) => updateOption(group, option.id, { value: e.target.value })}
                        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addOption(group);
                          }
                        }}
                      />
                      <AffixInput
                        prefix="+$" value={option.surcharge} inputMode="decimal" placeholder="0.00" aria-label="Recargo" className="bg-card" inputClassName="font-mono"
                        onChange={(e) => updateOption(group, option.id, { surcharge: e.target.value.replace(/[^\d.,]/g, "") })}
                      />
                      <span className="hidden truncate font-mono text-sm text-muted-foreground sm:block">{price(base + extra)}</span>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="Quitar opción" disabled={group.values.length === 1}
                        onClick={() => updateGroup(group.id, { values: group.values.filter((current) => current.id !== option.id) })}>
                        <X />
                      </Button>
                    </div>
                    {error && <FieldError>{error}</FieldError>}
                  </div>
                );
              })}
              <Button type="button" variant="ghost" size="sm" className="justify-self-start rounded-full" disabled={group.values.length >= 12} onClick={() => addOption(group)}>
                <Plus /> Agregar opción {group.values.length >= 12 && "(máximo 12)"}
              </Button>
            </div>
          </FormSection>
        );
      })}
      <datalist id="variant-names">
        {["Tamaño", "Color", "Talla", "Material", "Sabor", "Presentación", "Acabado"].map((name) => <option key={name} value={name} />)}
      </datalist>

      {draft.groups.length === 0 && (
        <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed p-8 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-muted"><Layers className="size-5 text-muted-foreground" /></span>
          <p className="font-medium">Esta ficha no tiene variantes</p>
          <p className="max-w-sm text-sm text-muted-foreground">Es opcional. Si tu {draft.kind === "service" ? "servicio" : "producto"} viene en una sola versión, seguí al siguiente paso.</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" className="rounded-full" disabled={draft.groups.length >= 8} onClick={() => addGroup()}>
          <Plus /> Agregar variante
        </Button>
        {draft.groups.length < 8 && presets.filter((preset) => !draft.groups.some((group) => group.name.trim().toLowerCase() === preset.name.toLowerCase())).map((preset) => (
          <Button key={preset.name} type="button" variant="ghost" size="sm" className="rounded-full text-muted-foreground" onClick={() => addGroup(preset)}>
            <Plus /> {preset.name}
          </Button>
        ))}
      </div>
    </div>
  );
}

function PublishStep({ draft, set, shop }: Omit<StepProps, "errors"> & { shop: PanelShop }) {
  const preview: Product = { ...fromDraft(draft), artwork: "" };
  return (
    <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-start">
      <div className="grid gap-3">
        <ToggleRow
          title="Disponible" checked={draft.available} onChange={(available) => set({ available })}
          text={draft.available ? "Los clientes pueden pedirla o reservarla." : "Se muestra en el catálogo como “No disponible”."}
        />
        <ToggleRow
          title="Visible en la tienda" checked={!draft.hidden} onChange={(visible) => set({ hidden: !visible })}
          text={draft.hidden ? "Oculta: no aparece en el catálogo y su enlace no abre." : "Aparece en el catálogo y se puede compartir."}
        />
        <div className="mt-2 grid gap-2 rounded-xl bg-muted/60 p-4 text-sm">
          <p className="font-medium">Resumen</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-muted-foreground [&_dd]:text-right [&_dd]:text-foreground">
            <dt>Tipo</dt><dd>{draft.kind === "service" ? "Servicio · " + draft.duration + " min" : "Producto"}</dd>
            <dt>Precio</dt><dd className="font-mono">{price(toCents(draft.price))}</dd>
            <dt>Fotos</dt><dd>{(draft.imageUrl ? 1 : 0) + draft.gallery.length || "Ninguna"}</dd>
            <dt>Variantes</dt><dd>{draft.groups.length ? draft.groups.map((group) => group.name || "—").join(", ") : "Ninguna"}</dd>
            <dt>Enlace</dt><dd className="truncate font-mono">/{draft.slug}</dd>
          </dl>
        </div>
      </div>
      <div className="grid gap-2">
        <p className="text-sm font-medium">Así se verá</p>
        <StoreFrame theme={shop.theme} accentColor={shop.accentColor} className="rounded-2xl p-3">
          <ProductCard product={preview} />
        </StoreFrame>
      </div>
    </div>
  );
}

function ToggleRow({ title, text, checked, onChange }: { title: string; text: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border bg-card p-4">
      <span className="grid gap-0.5">
        <span className="font-medium">{title}</span>
        <span className="text-sm text-muted-foreground">{text}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
