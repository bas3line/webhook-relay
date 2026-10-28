import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";

import { parseEvent, signDelivery, verifySignature } from "./boat.ts";
import { sampleEvent } from "./samples.ts";

const SECRET = "whsec_test";
const NOW = Date.parse("2026-10-29T12:00:00.000Z");
const TIMESTAMP = String(NOW / 1000);

function bytes(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

async function signedHeaders(body: ArrayBuffer, secret = SECRET, timestamp = TIMESTAMP): Promise<Headers> {
  return new Headers({
    "x-ascii-delivery": "evt_1",
    "x-ascii-timestamp": timestamp,
    "x-ascii-signature": await signDelivery(secret, "evt_1", timestamp, body),
  });
}

describe("verifySignature", () => {
  const body = bytes(JSON.stringify(sampleEvent("sandbox.ready")));

  it("accepts a delivery signed with the secret", async () => {
    assert.equal(await verifySignature(SECRET, await signedHeaders(body), body, NOW), true);
  });

  it("matches boat's documented HMAC over delivery, timestamp and body", async () => {
    // Computed the way boat's docs do it, with node:crypto rather than Web Crypto.
    const expected = createHmac("sha256", SECRET).update("evt_1.1700000000.{}").digest("hex");
    assert.equal(await signDelivery(SECRET, "evt_1", "1700000000", bytes("{}")), `v1=${expected}`);
  });

  it("refuses another secret, a changed body, or a missing header", async () => {
    assert.equal(await verifySignature(SECRET, await signedHeaders(body, "whsec_other"), body, NOW), false);
    assert.equal(await verifySignature(SECRET, await signedHeaders(body), bytes("{}"), NOW), false);

    const headers = await signedHeaders(body);
    headers.delete("x-ascii-delivery");
    assert.equal(await verifySignature(SECRET, headers, body, NOW), false);
  });

  it("refuses a delivery signed more than five minutes from now", async () => {
    const stale = String(NOW / 1000 - 301);
    assert.equal(await verifySignature(SECRET, await signedHeaders(body, SECRET, stale), body, NOW), false);
    const early = String(NOW / 1000 + 301);
    assert.equal(await verifySignature(SECRET, await signedHeaders(body, SECRET, early), body, NOW), false);
  });

  it("refuses a signature that isn't 64 hex characters", async () => {
    const headers = await signedHeaders(body);
    headers.set("x-ascii-signature", "v1=nothex");
    assert.equal(await verifySignature(SECRET, headers, body, NOW), false);
  });
});

describe("parseEvent", () => {
  it("reads a boat event", () => {
    const event = sampleEvent("sandbox.error");
    assert.deepEqual(parseEvent(bytes(JSON.stringify(event))), event);
  });

  it("refuses anything that isn't one", () => {
    assert.equal(parseEvent(bytes("not json")), null);
    assert.equal(parseEvent(bytes("[]")), null);
    assert.equal(parseEvent(bytes(JSON.stringify({ id: "evt_1", type: "sandbox.ready" }))), null);
  });

  it("treats a missing data object as empty", () => {
    const event = parseEvent(bytes(JSON.stringify({ id: "evt_1", type: "sandbox.ready", createdAt: "2026-10-29T12:00:00.000Z", data: "x" })));
    assert.deepEqual(event?.data, {});
  });
});
