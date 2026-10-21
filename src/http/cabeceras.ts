// src/http/cabeceras.ts — A02: todas las respuestas del Worker (los estáticos, vía public/_headers)
export const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

export function conCabeceras(r: Response): Response {
  const h = new Headers(r.headers);
  h.set("content-security-policy", CSP);
  h.set("x-content-type-options", "nosniff");
  h.set("referrer-policy", "strict-origin-when-cross-origin");
  h.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()");
  h.set("x-frame-options", "DENY");
  return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
}
