import { createFileRoute } from "@tanstack/react-router";
import { apiFetch, readLimited, sameOrigin } from "../api";

function authRequest(action: "link" | "signup" | "verify" | "logout", request: Request, payload?: object) {
  return apiFetch("/api/auth/" + action, {
    request,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload && JSON.stringify(payload),
  }).catch(() => null);
}

export const Route = createFileRoute("/auth")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const headers = new Headers({ "Cache-Control": "no-store" });
        const origin = sameOrigin(request);
        if (!origin) {
          return new Response("Origen inválido", { status: 403, headers });
        }
        const body = request.headers.get("Content-Type") === "application/x-www-form-urlencoded" && await readLimited(request, 4096).catch(() => null);
        if (!body) {
          return new Response("Formulario inválido", { status: 400, headers });
        }
        const form = new URLSearchParams(new TextDecoder().decode(body));
        const action = form.get("action");
        if (action === "signup") {
          return signup(form, request, headers);
        }
        if (action !== "link" && action !== "verify" && action !== "logout") {
          return new Response("Acción inválida", { status: 400, headers });
        }
        const payload =
          action === "link" ? { email: form.get("email") ?? "" }
          : action === "verify" ? { token: form.get("token") ?? "" }
          : undefined;
        const response = await authRequest(action, request, payload);
        let location = "/ingresar?estado=servicio";
        if (action === "link" && response?.status === 202) {
          location = "/ingresar?estado=enviado";
        } else if (action === "link" && response?.status === 400) {
          location = "/ingresar?estado=correo";
        } else if (action === "verify" && response?.status === 401) {
          location = "/ingresar?estado=enlace";
        } else if (response?.status === 204) {
          const cookie = response.headers.get("Set-Cookie");
          if (cookie) {
            headers.set("Set-Cookie", cookie + (origin.protocol === "https:" ? "; Secure" : ""));
          }
          location = action === "verify" ? "/panel" : "/ingresar";
        } else if (action === "logout") {
          return new Response("No se pudo cerrar la sesión. Volvé al panel e intentalo de nuevo.", {
            status: 503,
            headers,
          });
        }
        headers.set("Location", location);
        return new Response(null, { status: 303, headers });
      },
    },
  },
});

async function signup(form: URLSearchParams, request: Request, headers: Headers) {
  const shopName = (form.get("shopName") ?? "").trim().slice(0, 100);
  const shopSlug = (form.get("shopSlug") ?? "").trim().slice(0, 64);
  const response = await authRequest("signup", request, { email: form.get("email") ?? "", shopName, shopSlug });
  const status =
    response?.status === 202 ? "enviado"
    : response?.status === 409 ? "ocupado"
    : response?.status === 400 ? "datos"
    : "servicio";
  // Keep what the visitor typed (except the email) so they can fix it.
  const query = new URLSearchParams({ estado: status });
  if (status !== "enviado") {
    query.set("nombre", shopName);
    query.set("enlace", shopSlug);
  }
  headers.set("Location", "/registrarse?" + query.toString());
  return new Response(null, { status: 303, headers });
}
