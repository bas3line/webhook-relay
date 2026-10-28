import { MAX_TIMESTAMP_SKEW_SECONDS } from "./config.ts";
import type { BoatEvent } from "./types.ts";

const encoder = new TextEncoder();

// boat signs `<delivery id>.<timestamp>.<raw body>` with HMAC-SHA256 and sends `v1=<hex>`.
// https://docs.boat.dev/webhooks#verify-signatures
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

// The other side of verifySignature, for the tests and `npm run send`.
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
