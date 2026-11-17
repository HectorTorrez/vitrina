export function panelRequest(request: Request, method: "GET" | "POST", body?: ArrayBuffer) {
  const api = process.env.VITRINA_API_URL || "http://127.0.0.1:8080";
  return fetch(api + "/api/panel", {
    method,
    headers: {
      Cookie: request.headers.get("Cookie") || "",
      "Content-Type": "application/json",
    },
    body,
    signal: AbortSignal.timeout(7000),
    redirect: "error",
  });
}
