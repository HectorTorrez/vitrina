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
    hours: form.has("booking") ? weekdays.map((_, day) => form.has("open-day-" + day)
      ? { open: field(form, "open-" + day), close: field(form, "close-" + day) }
      : { open: "", close: "" }) : [],
  };
}

const weekdays = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function HoursFields({ hours }: { hours?: Profile["hours"] }) {
  const [enabled, setEnabled] = useState(Boolean(hours?.some((day) => day.open)));
  return (
    <fieldset className="panel-hours">
      <legend>Reservas en línea</legend>
      <label className="panel-check">
        <input name="booking" type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        Permitir que los clientes reserven servicios en la tienda pública
      </label>
      {enabled && (
        <>
          <p>Horario de atención (hora de El Salvador). Las reservas se ofrecen cada 15 minutos con al menos una hora de anticipación.</p>
          {weekdays.map((name, day) => {
            const current = hours?.[day];
            return (
              <div className="panel-hours-row" key={day}>
                <label className="panel-check">
                  <input name={"open-day-" + day} type="checkbox" defaultChecked={hours?.length ? Boolean(current?.open) : day > 0} />
                  {name}
                </label>
                <label>Abre<input name={"open-" + day} type="time" step={900} defaultValue={current?.open || "09:00"} /></label>
                <label>Cierra<input name={"close-" + day} type="time" step={900} defaultValue={current?.close || "18:00"} /></label>
              </div>
            );
          })}
        </>
      )}
    </fieldset>
  );
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
      <HoursFields hours={profile?.hours} />
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
      {!shop && !panel.operator && (
        <section className="panel-section">
          <h2>Abrí tu tienda</h2>
          <p>Tu cuenta todavía no tiene una tienda. Elegí su nombre y su enlace para empezar.</p>
          <PanelForm submit="Crear tienda" payload={(form) => ({
            action: "crear-tienda", shopSlug: field(form, "shopSlug"), profile: readProfile(form),
          })}>
            <label>Enlace público
              <input name="shopSlug" required maxLength={64} placeholder="mi-tienda" pattern="[a-z0-9]+(-[a-z0-9]+)*" />
            </label>
            <ProfileFields />
          </PanelForm>
        </section>
      )}
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
