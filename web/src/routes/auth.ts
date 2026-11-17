import { createFileRoute } from "@tanstack/react-router";
import { authRequest } from "../auth.server";

export const Route = createFileRoute("/auth")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = URL.parse(process.env.VITRINA_WEB_ORIGIN || request.url);
        const headers = new Headers({ "Cache-Control": "no-store" });
        if (!origin || request.headers.get("Origin") !== origin.origin) {
          return new Response("Origen inválido", { status: 403, headers });
        }
        const form = await readForm(request);
        if (!form) {
          return new Response("Formulario inválido", { status: 400, headers });
        }
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
        const response = await authRequest(action, request, payload).catch(() => null);
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
  const response = await authRequest("signup", request, {
    email: form.get("email") ?? "", shopName, shopSlug,
  }).catch(() => null);
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

async function readForm(request: Request) {
  if (request.headers.get("Content-Type") !== "application/x-www-form-urlencoded" || !request.body) {
    return null;
  }
  const reader = request.body.getReader();
  const buffer = new Uint8Array(4096);
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return new URLSearchParams(new TextDecoder().decode(buffer.subarray(0, length)));
      if (length + value.length > buffer.length) {
        await reader.cancel();
        return null;
      }
      buffer.set(value, length);
      length += value.length;
    }
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}
