export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  const response = new Response(JSON.stringify(body), { status, headers });
  response.headers.set("content-type", "application/json; charset=utf-8");
  response.headers.set("cache-control", "no-store");
  return response;
}

// The body, or null once it runs past `max` bytes: a declared length over the cap is
// refused before reading, and a stream is cancelled the moment it passes it.
export async function readBody(request: Request, max: number): Promise<ArrayBuffer | null> {
  if (Number(request.headers.get("content-length") ?? 0) > max) {
    return null;
  }
  if (!request.body) {
    return new ArrayBuffer(0);
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}

// One JSON line per event, which Workers Logs indexes by field.
export function log(level: "info" | "warn" | "error", event: string, fields: Record<string, string | number> = {}): void {
  console[level](JSON.stringify({ level, event, ...fields }));
}
