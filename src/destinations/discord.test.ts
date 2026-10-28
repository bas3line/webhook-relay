import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import type { Env, Message } from "../types.ts";
import { sendToDiscord, toDiscordBody } from "./discord.ts";

const message: Message = {
  sender: { name: "boat", iconUrl: "https://boat.dev/apple-touch-icon.png" },
  title: "Sample sandbox is ready",
  url: "https://boat.dev/dashboard?tab=sandboxes",
  color: 0x22c55e,
  fields: [
    { name: "Sandbox", value: "bx_sample", code: true, inline: true },
    { name: "Reason", value: "Plain text" },
  ],
  footer: "sandbox.ready · evt_1",
  timestamp: "2026-10-29T12:00:00.000Z",
};

const env = { DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/1/token" } as Env;

afterEach(() => {
  mock.restoreAll();
});

describe("toDiscordBody", () => {
  it("posts as the sender, with its icon, and pings no one", () => {
    const body = toDiscordBody(message);
    assert.equal(body.username, "boat");
    assert.equal(body.avatar_url, message.sender.iconUrl);
    assert.deepEqual(body.allowed_mentions, { parse: [] });
    assert.equal(body.embeds[0]?.footer.icon_url, message.sender.iconUrl);
    assert.equal(body.embeds[0]?.timestamp, message.timestamp);
  });

  it("sets code fields in monospace, and the rest as written", () => {
    assert.deepEqual(toDiscordBody(message).embeds[0]?.fields, [
      { name: "Sandbox", value: "`bx_sample`", inline: true },
      { name: "Reason", value: "Plain text", inline: undefined },
    ]);
  });

  it("keeps within Discord's limits and drops a timestamp it can't read", () => {
    const long = { ...message, title: "n".repeat(300), fields: [{ name: "ID", value: "bx_`1`", code: true }], timestamp: "yesterday" };
    const embed = toDiscordBody(long).embeds[0];
    assert.equal(embed?.title.length, 256);
    assert.equal(embed?.fields[0]?.value, "`bx_'1'`");
    assert.equal("timestamp" in JSON.parse(JSON.stringify(embed)), false);
  });
});

describe("sendToDiscord", () => {
  it("posts the body to the webhook URL", async () => {
    const fetch = mock.method(globalThis, "fetch", async () => new Response(null, { status: 204 }));
    assert.deepEqual(await sendToDiscord(message, env), { ok: true });
    assert.equal(fetch.mock.calls[0]?.arguments[0], env.DISCORD_WEBHOOK_URL);
  });

  it("reports Discord's refusal, or that it couldn't be reached", async () => {
    mock.method(globalThis, "fetch", async () => new Response('{"message":"You are being rate limited."}', { status: 429 }));
    assert.deepEqual(await sendToDiscord(message, env), { ok: false, status: 429, reason: '{"message":"You are being rate limited."}' });

    mock.restoreAll();
    mock.method(globalThis, "fetch", () => Promise.reject(new TypeError("fetch failed")));
    assert.deepEqual(await sendToDiscord(message, env), { ok: false, status: 0, reason: "TypeError" });
  });
});
