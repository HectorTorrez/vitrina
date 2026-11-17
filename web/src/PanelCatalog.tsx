import { useState } from "react";
import { price, type Product } from "./catalog";
import type { PanelShop } from "./panel";
import { field, PanelForm } from "./PanelForm";

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

function readOptions(text: string): Product["options"] {
  if (!text) return [];
  return text.split("\n").filter((line) => line.trim()).map((line) => {
    const separator = line.indexOf(":");
    if (separator < 0) throw new Error("Escribí cada variante como Nombre: opción, opción");
    return { name: line.slice(0, separator), values: line.slice(separator + 1).split(",") };
  });
}

function ItemForm({ shopSlug, item }: { shopSlug: string; item?: Product }) {
  const [kind, setKind] = useState<Product["kind"]>(item?.kind ?? "product");
  return (
    <PanelForm submit={item ? "Guardar ficha" : "Agregar al catálogo"} clear={!item} payload={(form) => ({
      action: item ? "editar-item" : "crear-item",
      shopSlug,
      item: {
        slug: item?.slug ?? field(form, "slug"),
        name: field(form, "name"),
        kind,
        durationMinutes: Number(field(form, "durationMinutes")),
        priceCents: Math.round(Number(field(form, "price")) * 100),
        imageUrl: field(form, "imageUrl"),
        options: readOptions(field(form, "options")),
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
      <label>URL de la foto
        <input name="imageUrl" type="url" placeholder="https://…" maxLength={2048} defaultValue={item?.imageUrl} />
      </label>
      <label>Variantes, una por línea
        <textarea name="options" rows={3} maxLength={4000} placeholder="Tamaño: A4, A3" defaultValue={item?.options?.map(({ name, values }) => name + ": " + values.join(", ")).join("\n")} />
      </label>
      <div className="panel-fields">
        <label className="panel-check"><input name="available" type="checkbox" defaultChecked={item?.available ?? true} />Disponible</label>
        <label className="panel-check"><input name="hidden" type="checkbox" defaultChecked={item?.hidden ?? false} />Ocultar del catálogo público</label>
      </div>
    </PanelForm>
  );
}
