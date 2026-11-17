import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { field, getPanel, type Profile } from "../panel";
import { PanelAgenda } from "../PanelAgenda";
import { PanelCatalog } from "../PanelCatalog";
import { PanelForm } from "../PanelForm";

export const Route = createFileRoute("/panel")({
  beforeLoad: async () => {
    const panel = await getPanel();
    if (!panel) throw redirect({ to: "/ingresar" });
    return { panel };
  },
  headers: () => ({ "Cache-Control": "private, no-store" }),
  component: Panel,
});

function readProfile(form: FormData): Profile {
  return {
    name: field(form, "name"),
    description: field(form, "description"),
    theme: field(form, "theme"),
    instagram: field(form, "instagram"),
    tiktok: field(form, "tiktok"),
    whatsapp: field(form, "whatsapp"),
  };
}

function ProfileFields({ profile }: { profile?: Profile }) {
  return (
    <>
      <label>Nombre<input name="name" defaultValue={profile?.name} required maxLength={100} /></label>
      <label>Descripción<textarea name="description" defaultValue={profile?.description} maxLength={500} rows={3} /></label>
      <label>Tema
        <select name="theme" defaultValue={profile?.theme ?? "costa"}>
          <option value="costa">Costa</option><option value="arena">Arena</option><option value="noche">Noche</option>
        </select>
      </label>
      <div className="panel-fields">
        <label>Usuario de Instagram<input name="instagram" defaultValue={profile?.instagram} maxLength={33} /></label>
        <label>Usuario de TikTok<input name="tiktok" defaultValue={profile?.tiktok} maxLength={33} /></label>
        <label>WhatsApp internacional<input name="whatsapp" type="tel" placeholder="+50370000000" defaultValue={profile?.whatsapp} maxLength={16} /></label>
      </div>
    </>
  );
}

function Panel() {
  const { panel } = Route.useRouteContext();
  const [selected, setSelected] = useState("");
  const shop = panel.shops.find((s) => s.slug === selected) ?? panel.shops[0];

  return (
    <main className="seller-panel">
      <header className="panel-header">
        <div><Link to="/">vitrina.</Link><h1>Panel de vendedor</h1><p>{panel.email}</p></div>
        <form action="/auth" method="post">
          <button type="submit" name="action" value="logout">Cerrar sesión</button>
        </form>
      </header>
      {panel.shops.length > 1 && (
        <label>Tienda
          <select value={shop?.slug} onChange={(event) => setSelected(event.target.value)}>
            {panel.shops.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
          </select>
        </label>
      )}
      {shop && (
        <section className="panel-section" key={shop.slug}>
          <h2>Editar tienda</h2>
          <Link to="/tienda/$shop" params={{ shop: shop.slug }}>Ver tienda pública ↗</Link>
          <PanelForm submit="Guardar tienda" payload={(form) => ({
            action: "editar-tienda", shopSlug: shop.slug, profile: readProfile(form),
          })}>
            <ProfileFields profile={shop} />
          </PanelForm>
        </section>
      )}
      {shop && <PanelCatalog key={shop.slug} shop={shop} />}
      {shop && <PanelAgenda key={shop.slug} shop={shop} />}
      {!shop && !panel.operator && <p>Tu cuenta todavía no tiene una tienda asignada.</p>}
      {panel.operator && (
        <section className="panel-section">
          <h2>Dar de alta una tienda</h2>
          <PanelForm submit="Crear tienda y habilitar vendedor" clear payload={(form) => ({
            action: "crear-tienda", shopSlug: field(form, "shopSlug"),
            email: field(form, "email"), profile: readProfile(form),
          })}>
            <div className="panel-fields">
              <label>Enlace público
                <input name="shopSlug" required maxLength={64} placeholder="mi-tienda" pattern="[a-z0-9]+(-[a-z0-9]+)*" />
              </label>
              <label>Correo del vendedor<input name="email" type="email" required maxLength={254} /></label>
            </div>
            <ProfileFields />
          </PanelForm>
        </section>
      )}
    </main>
  );
}
