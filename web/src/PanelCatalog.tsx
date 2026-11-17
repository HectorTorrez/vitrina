import { useState } from "react";
import { price, type Product } from "./catalog";
import { field, type PanelShop } from "./panel";
import { PanelForm } from "./PanelForm";

export function PanelCatalog({ shop }: { shop: PanelShop }) {
  return (
    <section className="panel-section">
      <h2>Catálogo</h2>
      <details>
        <summary>Agregar producto o servicio</summary>
        <ItemForm shopSlug={shop.slug} />
      </details>
      {!shop.products?.length && <p>Tu catálogo está vacío.</p>}
      {shop.products?.map((item) => (
        <details key={item.slug}>
          <summary>{item.name} · {price(item.priceCents)}{item.hidden ? " · Oculto" : ""}</summary>
          <ItemForm shopSlug={shop.slug} item={item} />
        </details>
      ))}
    </section>
  );
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
    <div className="panel-image">
      {url && <img src={url} alt="" referrerPolicy="no-referrer" />}
      <label>Foto
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(file);
        }} />
      </label>
      <label>O URL de la foto
        <input name="imageUrl" placeholder="https://…" maxLength={2048} value={url} onChange={(event) => setUrl(event.target.value)} />
      </label>
      {url && <button type="button" onClick={() => { setUrl(""); setStatus(undefined); }}>Quitar foto</button>}
      {status && <p role={status.error ? "alert" : "status"}>{status.text}</p>}
    </div>
  );
}

function ItemForm({ shopSlug, item }: { shopSlug: string; item?: Product }) {
  const [kind, setKind] = useState<Product["kind"]>(item?.kind ?? "product");
  const [groups, setGroups] = useState(() => (item?.options ?? []).map((option, index) => ({
    id: String(index),
    values: option.values.map((_, valueIndex) => String(valueIndex)),
  })));
  return (
    <PanelForm submit={item ? "Guardar ficha" : "Agregar al catálogo"} clear={!item} onSaved={item ? undefined : () => {
      setKind("product");
      setGroups([]);
    }} payload={(form) => ({
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
        })),
        position: Number(field(form, "position")),
        available: form.has("available"),
        hidden: form.has("hidden"),
      },
    })}>
      <div className="panel-fields">
        <label>Nombre<input name="name" defaultValue={item?.name} required maxLength={120} /></label>
        {!item && <label>Enlace de la ficha<input name="slug" required maxLength={64} placeholder="mi-producto" pattern="[a-z0-9]+(-[a-z0-9]+)*" /></label>}
        {!item && (
          <label>Tipo
            <select value={kind} onChange={(event) => setKind(event.target.value === "service" ? "service" : "product")}>
              <option value="product">Producto</option>
              <option value="service">Servicio</option>
            </select>
          </label>
        )}
        <label>Precio en USD
          <input name="price" type="number" min={0} max={999999.99} step={0.01} defaultValue={item ? (item.priceCents / 100).toFixed(2) : undefined} required />
        </label>
        {kind === "service" && (
          <label>Duración en minutos
            <input name="durationMinutes" type="number" min={1} max={1440} defaultValue={item?.durationMinutes} required />
          </label>
        )}
        <label>Posición en el catálogo<input name="position" type="number" min={0} max={999999} defaultValue={item?.position ?? 0} required /></label>
      </div>
      <ImageField initial={item?.imageUrl} />
      <div className="panel-variants">
        <h3>Variantes</h3>
        {groups.map((group, index) => (
          <div className="panel-variant" key={group.id}>
            <label>Nombre de la variante
              <input name={"group-" + group.id} defaultValue={item?.options?.[Number(group.id)]?.name} placeholder="Tamaño" maxLength={60} required />
            </label>
            {group.values.map((id) => (
              <div className="panel-variant-row" key={id}>
                <label>Opción
                  <input name={"value-" + group.id + "-" + id} defaultValue={item?.options?.[Number(group.id)]?.values[Number(id)]} placeholder="A4" maxLength={60} required />
                </label>
                <button type="button" disabled={group.values.length === 1} onClick={() => {
                  setGroups(groups.map((current) => current.id === group.id ? {
                    ...current, values: current.values.filter((value) => value !== id),
                  } : current));
                }}>Quitar opción</button>
              </div>
            ))}
            <div className="panel-variant-row">
              <button type="button" disabled={group.values.length >= 12} onClick={() => {
                const id = crypto.randomUUID();
                setGroups(groups.map((current) => current.id === group.id ? {
                  ...current, values: [...current.values, id],
                } : current));
              }}>Agregar opción</button>
              <button type="button" onClick={() => setGroups(groups.filter((current) => current.id !== group.id))}>Quitar variante {index + 1}</button>
            </div>
          </div>
        ))}
        <button type="button" disabled={groups.length >= 8} onClick={() => {
          setGroups([...groups, { id: crypto.randomUUID(), values: ["0"] }]);
        }}>Agregar variante</button>
      </div>
      <div className="panel-fields">
        <label className="panel-check"><input name="available" type="checkbox" defaultChecked={item?.available ?? true} />Disponible</label>
        <label className="panel-check"><input name="hidden" type="checkbox" defaultChecked={item?.hidden ?? false} />Ocultar del catálogo público</label>
      </div>
    </PanelForm>
  );
}
