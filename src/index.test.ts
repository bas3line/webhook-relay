import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import worker from "./index.ts";
import { sampleEvent } from "./sources/boat.samples.ts";
import { signDelivery } from "./sources/boat.ts";
import type { Env } from "./types.ts";

const env: Env = {
  BOAT_WEBHOOK_SECRET: "whsec_test",
  DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/1/token",
};

let posted: unknown[];
let discord: () => Response | Promise<Response>;

async function deliver(body: string, secret = env.BOAT_WEBHOOK_SECRET): Promise<Response> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await signDelivery(secret, "evt_1", timestamp, new TextEncoder().encode(body).buffer as ArrayBuffer);
  const request = new Request("https://relay.example/boat", {
    method: "POST",
    headers: { "x-ascii-delivery": "evt_1", "x-ascii-timestamp": timestamp, "x-ascii-signature": signature },
    body,
  });
  return worker.fetch(request, env);
}

beforeEach(() => {
  posted = [];
  discord = () => new Response(null, { status: 204 });
  mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    posted.push(JSON.parse(String(init.body)));
    return discord();
  });
  for (const level of ["info", "warn", "error"] as const) {
    mock.method(console, level, () => undefined);
  }
});

afterEach(() => {
  mock.restoreAll();
});

describe("POST /<source>", () => {
  it("relays a verified event to Discord and answers 200", async () => {
    const event = sampleEvent("sandbox.ready");

    const response = await deliver(JSON.stringify(event));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, id: event.id });
    assert.equal(posted.length, 1);
    assert.match(JSON.stringify(posted[0]), /Sample sandbox is ready/);
  });

  it("refuses a bad signature without delivering anything", async () => {
    const response = await deliver(JSON.stringify(sampleEvent("sandbox.ready")), "whsec_other");

    assert.equal(response.status, 401);
    assert.equal(posted.length, 0);
  });

  it("refuses a verified body that isn't an event", async () => {
    const response = await deliver("[]");

    assert.equal(response.status, 400);
    assert.equal(posted.length, 0);
  });

  it("answers 502 when the destination refuses or can't be reached, so the sender retries", async () => {
    discord = () => new Response('{"message":"You are being rate limited."}', { status: 429 });
    const limited = await deliver(JSON.stringify(sampleEvent("sandbox.error")));
    assert.equal(limited.status, 502);
    assert.deepEqual(await limited.json(), { error: "delivery_failed", destination: "discord", status: 429 });

    discord = () => Promise.reject(new TypeError("fetch failed"));
    const unreachable = await deliver(JSON.stringify(sampleEvent("sandbox.error")));
    assert.equal(unreachable.status, 502);
  });

  it("refuses a body far bigger than any webhook, streamed or declared", async () => {
    const streamed = await deliver("x".repeat(64 * 1024 + 1));
    assert.equal(streamed.status, 413);

    const declared = new Request("https://relay.example/boat", {
      method: "POST",
      headers: { "content-length": String(10 * 1024 * 1024) },
      body: "{}",
    });
    assert.equal((await worker.fetch(declared, env)).status, 413);
    assert.equal(posted.length, 0);
  });
});

describe("routes", () => {
  it("lists its sources on /health, and takes only POST on a source", async () => {
    const health = await worker.fetch(new Request("https://relay.example/health"), env);
    assert.equal(health.status, 200);
    assert.deepEqual((await health.json()).sources, ["boat"]);

    const get = await worker.fetch(new Request("https://relay.example/boat"), env);
    assert.equal(get.status, 405);
    assert.equal(get.headers.get("allow"), "POST");
  });

  it("answers 404 for a source it doesn't have", async () => {
    const response = await worker.fetch(new Request("https://relay.example/github", { method: "POST", body: "{}" }), env);
    assert.equal(response.status, 404);
  });
});
