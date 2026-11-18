import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { apiFetch } from "./api";

export const getSeller = createServerFn({ method: "GET" }).handler(async () => {
  setResponseHeader("Cache-Control", "private, no-store");
  const response = await apiFetch("/api/auth/session", { request: getRequest() });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("No se pudo consultar la sesión");
  return (await response.json()) as { email: string };
});
