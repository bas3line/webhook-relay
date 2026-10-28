import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import { signDelivery } from "./boat.ts";
import worker from "./index.ts";
import { sampleEvent } from "./samples.ts";
import type { Env } from "./types.ts";

const env: Env = {
  BOAT_WEBHOOK_SECRET: "whsec_test",
  DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/1/token",
};

interface DiscordCall {
  readonly url: string;
  readonly body: unknown;
}

let calls: DiscordCall[];
let discord: () => Response | Promise<Response>;

async function deliver(body: string, init: { secret?: string; method?: string } = {}): Promise<Response> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await signDelivery(init.secret ?? env.BOAT_WEBHOOK_SECRET, "evt_1", timestamp, new TextEncoder().encode(body).buffer as ArrayBuffer);
  const request = new Request("https://relay.example/boat", {
    method: init.method ?? "POST",
    headers: { "x-ascii-delivery": "evt_1", "x-ascii-timestamp": timestamp, "x-ascii-signature": signature },
    body,
  });
  return worker.fetch(request, env);
}

beforeEach(() => {
  calls = [];
  discord = () => new Response(null, { status: 204 });
  mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    return discord();
  });
  for (const level of ["info", "warn", "error"] as const) {
    mock.method(console, level, () => undefined);
  }
});

afterEach(() => {
  mock.restoreAll();
});

describe("POST /boat", () => {
  it("posts a signed event to Discord and answers 200", async () => {
    const event = sampleEvent("sandbox.ready");

    const response = await deliver(JSON.stringify(event));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, id: event.id });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, env.DISCORD_WEBHOOK_URL);
    assert.match(JSON.stringify(calls[0]?.body), /Sample sandbox is ready/);
  });

  it("refuses a bad signature without calling Discord", async () => {
    const response = await deliver(JSON.stringify(sampleEvent("sandbox.ready")), { secret: "whsec_other" });

    assert.equal(response.status, 401);
    assert.equal(calls.length, 0);
  });

  it("refuses a signed body that isn't an event", async () => {
    const response = await deliver("[]");

    assert.equal(response.status, 400);
    assert.equal(calls.length, 0);
  });

  it("answers 502 when Discord refuses or can't be reached, so boat retries", async () => {
    discord = () => new Response('{"message":"You are being rate limited."}', { status: 429 });
    const limited = await deliver(JSON.stringify(sampleEvent("sandbox.error")));
    assert.equal(limited.status, 502);
    assert.deepEqual(await limited.json(), { error: "discord_rejected", status: 429 });

    discord = () => Promise.reject(new TypeError("fetch failed"));
    const unreachable = await deliver(JSON.stringify(sampleEvent("sandbox.error")));
    assert.equal(unreachable.status, 502);
  });

  it("refuses a body far bigger than any delivery, streamed or declared", async () => {
    const streamed = await deliver("x".repeat(64 * 1024 + 1));
    assert.equal(streamed.status, 413);

    const declared = new Request("https://relay.example/boat", {
      method: "POST",
      headers: { "content-length": String(10 * 1024 * 1024) },
      body: "{}",
    });
    assert.equal((await worker.fetch(declared, env)).status, 413);
    assert.equal(calls.length, 0);
  });
});

describe("routes", () => {
  it("answers health checks, and only POST on /boat", async () => {
    const health = await worker.fetch(new Request("https://relay.example/health"), env);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).service, "webhook-relay");

    const get = await worker.fetch(new Request("https://relay.example/boat"), env);
    assert.equal(get.status, 405);
    assert.equal(get.headers.get("allow"), "POST");

    const missing = await worker.fetch(new Request("https://relay.example/nope"), env);
    assert.equal(missing.status, 404);
  });
});
