// boat (https://boat.dev): the six sandbox lifecycle events. https://docs.boat.dev/webhooks
import type { Env, Field, Message, Source } from "../types.ts";

const LOGO_URL = "https://boat.dev/apple-touch-icon.png";
const DASHBOARD_URL = "https://boat.dev/dashboard?tab=sandboxes";
export const BOAT_BLUE = 0x263fa9;

// boat's docs ask receivers to refuse deliveries signed more than five minutes from now.
const MAX_TIMESTAMP_SKEW_SECONDS = 300;

// How each event reads: "<sandbox> <verb>", on a bar of its colour.
export const EVENT_STYLES: Readonly<Record<string, { readonly verb: string; readonly color: number }>> = {
  "sandbox.ready": { verb: "is ready", color: 0x22c55e },
  "sandbox.hydrated": { verb: "finished restoring", color: BOAT_BLUE },
  "sandbox.error": { verb: "failed", color: 0xef4444 },
  "sandbox.archived": { verb: "stopped", color: 0x71717a },
  "sandbox.degraded": { verb: "is degraded", color: 0xf59e0b },
  "sandbox.recovered": { verb: "recovered", color: 0x14b8a6 },
};

// The body of one delivery. https://docs.boat.dev/webhooks#payload
export interface BoatEvent {
  readonly id: string;
  readonly type: string;
  readonly createdAt: string;
  readonly data: {
    readonly sandbox?: { readonly id?: string; readonly name?: string | null };
    readonly previousState?: string;
    readonly state?: string;
    readonly reason?: string | null;
  };
}

const encoder = new TextEncoder();

// boat signs `<delivery id>.<timestamp>.<raw body>` with HMAC-SHA256 and sends `v1=<hex>`.
function signedBytes(delivery: string, timestamp: string, body: ArrayBuffer): Uint8Array<ArrayBuffer> {
  const prefix = encoder.encode(`${delivery}.${timestamp}.`);
  const bytes = new Uint8Array(prefix.length + body.byteLength);
  bytes.set(prefix);
  bytes.set(new Uint8Array(body), prefix.length);
  return bytes;
}

function hmacKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

export async function verifySignature(secret: string, headers: Headers, body: ArrayBuffer, now = Date.now()): Promise<boolean> {
  const delivery = headers.get("x-ascii-delivery") ?? "";
  const timestamp = headers.get("x-ascii-timestamp") ?? "";
  const supplied = (headers.get("x-ascii-signature") ?? "").replace(/^v1=/, "");

  const issuedAt = Number(timestamp);
  if (!delivery || !/^[0-9a-f]{64}$/i.test(supplied) || !Number.isFinite(issuedAt)) {
    return false;
  }
  if (Math.abs(now / 1000 - issuedAt) > MAX_TIMESTAMP_SKEW_SECONDS) {
    return false;
  }

  // subtle.verify compares in constant time.
  const key = await hmacKey(secret, "verify");
  return crypto.subtle.verify("HMAC", key, fromHex(supplied), signedBytes(delivery, timestamp, body));
}

// The other side of verifySignature, for the tests and `npm run send:boat`.
export async function signDelivery(secret: string, delivery: string, timestamp: string, body: ArrayBuffer): Promise<string> {
  const key = await hmacKey(secret, "sign");
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, signedBytes(delivery, timestamp, body)));
  return `v1=${Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseEvent(body: ArrayBuffer): BoatEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return null;
  }

  if (!isRecord(parsed) || typeof parsed.id !== "string" || typeof parsed.type !== "string" || typeof parsed.createdAt !== "string") {
    return null;
  }

  return {
    id: parsed.id,
    type: parsed.type,
    createdAt: parsed.createdAt,
    data: isRecord(parsed.data) ? (parsed.data as BoatEvent["data"]) : {},
  };
}

export function toMessage(event: BoatEvent): Message {
  const style = EVENT_STYLES[event.type];
  const { sandbox, previousState, state, reason } = event.data;
  const subject = sandbox?.name?.trim() || sandbox?.id || "A sandbox";

  const fields: Field[] = [];
  if (sandbox?.id) {
    fields.push({ name: "Sandbox", value: sandbox.id, code: true, inline: true });
  }
  if (state) {
    fields.push({ name: "State", value: previousState ? `${previousState} → ${state}` : state, code: true, inline: true });
  }
  if (reason) {
    fields.push({ name: "Reason", value: reason });
  }

  return {
    sender: { name: "boat", iconUrl: LOGO_URL },
    // An event boat adds later still posts, in boat blue, under its own name.
    title: style ? `${subject} ${style.verb}` : `${subject}: ${event.type}`,
    url: DASHBOARD_URL,
    color: style?.color ?? BOAT_BLUE,
    fields,
    footer: `${event.type} · ${event.id}`,
    timestamp: event.createdAt,
  };
}

export const boat: Source = {
  name: "boat",
  verify: (request: Request, body: ArrayBuffer, env: Env) => verifySignature(env.BOAT_WEBHOOK_SECRET, request.headers, body),
  read(body) {
    const event = parseEvent(body);
    return event && { id: event.id, type: event.type, message: toMessage(event) };
  },
};
