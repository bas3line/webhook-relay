export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  const response = new Response(JSON.stringify(body), { status, headers });
  response.headers.set("content-type", "application/json; charset=utf-8");
  response.headers.set("cache-control", "no-store");
  return response;
}

// One JSON line per event, which Workers Logs indexes by field.
export function log(level: "info" | "warn" | "error", event: string, fields: Record<string, string | number> = {}): void {
  console[level](JSON.stringify({ level, event, ...fields }));
}
