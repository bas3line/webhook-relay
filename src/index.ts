import { sendToDiscord } from "./destinations/discord.ts";
import { json, log, readBody } from "./http.ts";
import { SOURCES } from "./sources/index.ts";
import type { Env, Source } from "./types.ts";

const REPOSITORY = "https://github.com/bas3line/webhook-relay";

// No webhook the relay takes comes near this; anything bigger is refused unread.
const MAX_BODY_BYTES = 64 * 1024;

// Senders retry on anything but a 2xx (boat with backoff, up to 8 times), so a failed
// delivery is a 502 here and the sender tries again later.
async function relay(source: Source, request: Request, env: Env): Promise<Response> {
  // Verify the raw bytes: parsing and re-serialising the JSON would break the signature.
  const body = await readBody(request, MAX_BODY_BYTES);
  if (!body) {
    return json({ error: "payload_too_large" }, 413);
  }

  if (!(await source.verify(request, body, env))) {
    log("warn", "signature_rejected", { source: source.name });
    return json({ error: "invalid_signature" }, 401);
  }

  const event = source.read(body);
  if (!event) {
    log("warn", "payload_rejected", { source: source.name });
    return json({ error: "invalid_payload" }, 400);
  }

  const delivery = await sendToDiscord(event.message, env);
  if (!delivery.ok) {
    log("error", "delivery_failed", { source: source.name, eventId: event.id, type: event.type, destination: "discord", status: delivery.status, reason: delivery.reason });
    return json({ error: "delivery_failed", destination: "discord", status: delivery.status }, 502);
  }

  log("info", "event_relayed", { source: source.name, eventId: event.id, type: event.type, destination: "discord" });
  return json({ ok: true, id: event.id });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/" || pathname === "/health") {
      return request.method === "GET"
        ? json({ ok: true, service: "webhook-relay", sources: [...SOURCES.keys()], repository: REPOSITORY })
        : json({ error: "method_not_allowed" }, 405, { allow: "GET" });
    }

    const source = SOURCES.get(pathname.slice(1));
    if (source) {
      return request.method === "POST" ? relay(source, request, env) : json({ error: "method_not_allowed" }, 405, { allow: "POST" });
    }

    return json({ error: "not_found" }, 404);
  },
};
