import { useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { getSeller } from "../auth";
import { AuthLayout, authFonts, MailIcon } from "../AuthLayout";

type Status = "enviado" | "ocupado" | "datos" | "servicio";

const errors: Record<Exclude<Status, "enviado">, string> = {
  ocupado: "Ese enlace ya lo usa otra tienda. Probá con otro.",
  datos: "Revisá los datos: el nombre, el enlace (solo minúsculas, números y guiones) y el correo.",
  servicio: "No se pudo procesar la solicitud. Intentá de nuevo en unos minutos.",
};

export const Route = createFileRoute("/registrarse")({
  validateSearch: (search: Record<string, unknown>): { estado?: Status; nombre?: string; enlace?: string } => ({
    estado: search.estado === "enviado" || (typeof search.estado === "string" && Object.hasOwn(errors, search.estado))
      ? (search.estado as Status)
      : undefined,
    nombre: typeof search.nombre === "string" ? search.nombre.slice(0, 100) : undefined,
    enlace: typeof search.enlace === "string" ? search.enlace.slice(0, 64) : undefined,
  }),
  beforeLoad: async () => {
    if (await getSeller()) throw redirect({ to: "/panel" });
  },
  headers: () => ({ "Cache-Control": "private, no-store" }),
  head: () => ({ meta: [{ title: "Abrí tu tienda · Vitrina" }], links: authFonts }),
  component: Signup,
});

/** "Luna Uñas & Spa" → "luna-unas-spa" */
function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/, "");
}

function Signup() {
  const { estado, nombre, enlace } = Route.useSearch();
  const [name, setName] = useState(nombre ?? "");
  const [slug, setSlug] = useState(enlace ?? "");
  const [slugEdited, setSlugEdited] = useState(Boolean(enlace));
  const [sending, setSending] = useState(false);

  if (estado === "enviado") {
    return (
      <AuthLayout>
        <span className="auth-icon"><MailIcon /></span>
        <p className="auth-label">Último paso</p>
        <h1>Confirmá tu correo</h1>
        <p className="auth-lede" role="status">
          Te enviamos un enlace. Al abrirlo se crea tu tienda y entrás directo a tu panel. Revisá también la carpeta de spam.
        </p>
        <p className="auth-note">El enlace vence en 15 minutos y sirve una sola vez.</p>
        <Link to="/registrarse" className="auth-btn auth-btn-ghost">Empezar de nuevo</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <p className="auth-label">Abrí tu tienda</p>
      <h1>Tu vitrina, lista hoy</h1>
      <p className="auth-lede">Contanos cómo se llama tu negocio. Después cargás tu catálogo y tu horario desde el panel.</p>
      {estado && <p className="auth-alert" role="alert">{errors[estado]}</p>}
      <form action="/auth" method="post" className="auth-form" onSubmit={() => setSending(true)}>
        <input type="hidden" name="action" value="signup" />
        <label className="auth-field">
          <span>Nombre del negocio</span>
          <input
            name="shopName" required maxLength={100} placeholder="Luna Uñas" autoComplete="organization" autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugEdited) setSlug(slugify(e.target.value));
            }}
          />
        </label>
        <label className="auth-field">
          <span>Enlace de tu tienda</span>
          <span className="auth-prefix">
            <span aria-hidden="true">/tienda/</span>
            <input
              name="shopSlug" required maxLength={64} placeholder="luna-unas" pattern="[a-z0-9]+(-[a-z0-9]+)*"
              title="Solo minúsculas, números y guiones" autoCapitalize="none" spellCheck={false}
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value.toLowerCase());
                setSlugEdited(true);
              }}
            />
          </span>
        </label>
        <label className="auth-field">
          <span>Tu correo</span>
          <input type="email" name="email" autoComplete="email" maxLength={254} placeholder="vos@tunegocio.com" required />
        </label>
        <button type="submit" className="auth-btn" disabled={sending}>
          {sending ? "Creando…" : "Crear mi tienda"}
        </button>
      </form>
      <p className="auth-note">Te mandamos un enlace al correo para confirmar. Sin contraseñas.</p>
      <p className="auth-switch">¿Ya tenés tienda? <Link to="/ingresar">Ingresá</Link></p>
    </AuthLayout>
  );
}
