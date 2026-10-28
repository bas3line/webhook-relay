import { parseEvent, verifySignature } from "./boat.ts";
import { MAX_BODY_BYTES } from "./config.ts";
import { toDiscordMessage } from "./discord.ts";
import { json, log, readBody } from "./http.ts";
import type { Env } from "./types.ts";

const REPOSITORY = "https://github.com/bas3line/webhook-relay";

// Any answer but a 2xx makes boat retry, with backoff, up to 8 times. So a Discord
// outage or rate limit is a 502 here, and boat delivers the event again later.
async function relayBoat(request: Request, env: Env): Promise<Response> {
  // Verify the raw bytes: parsing and re-serialising the JSON would break the signature.
  const body = await readBody(request, MAX_BODY_BYTES);
  if (!body) {
    return json({ error: "payload_too_large" }, 413);
  }

  const delivery = request.headers.get("x-ascii-delivery") ?? "";
  if (!(await verifySignature(env.BOAT_WEBHOOK_SECRET, request.headers, body))) {
    log("warn", "signature_rejected", { delivery });
    return json({ error: "invalid_signature" }, 401);
  }

  const event = parseEvent(body);
  if (!event) {
    log("warn", "payload_rejected", { delivery });
    return json({ error: "invalid_payload" }, 400);
  }

  let discord: Response;
  try {
    discord = await fetch(env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(toDiscordMessage(event)),
    });
  } catch (error) {
    log("error", "discord_unreachable", { eventId: event.id, error: error instanceof Error ? error.name : "unknown" });
    return json({ error: "discord_unreachable" }, 502);
  }

  if (!discord.ok) {
    log("error", "discord_rejected", { eventId: event.id, type: event.type, status: discord.status, body: (await discord.text()).slice(0, 500) });
    return json({ error: "discord_rejected", status: discord.status }, 502);
  }

  log("info", "event_relayed", { eventId: event.id, type: event.type });
  return json({ ok: true, id: event.id });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/boat") {
      return request.method === "POST" ? relayBoat(request, env) : json({ error: "method_not_allowed" }, 405, { allow: "POST" });
    }

    if (pathname === "/" || pathname === "/health") {
      return request.method === "GET"
        ? json({ ok: true, service: "webhook-relay", source: REPOSITORY })
        : json({ error: "method_not_allowed" }, 405, { allow: "GET" });
    }

    return json({ error: "not_found" }, 404);
  },
};
