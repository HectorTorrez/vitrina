export function authRequest(
  action: "link" | "signup" | "verify" | "logout" | "session",
  request: Request,
  payload?: { email: string } | { token: string } | { email: string; shopName: string; shopSlug: string },
) {
  const api = process.env.VITRINA_API_URL || "http://127.0.0.1:8080";
  return fetch(api + "/api/auth/" + action, {
    method: action === "session" ? "GET" : "POST",
    headers: {
      Cookie: request.headers.get("Cookie") || "",
      "Content-Type": "application/json",
    },
    body: payload && JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
    redirect: "error",
  });
}
