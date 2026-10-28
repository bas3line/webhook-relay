import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BOAT_BLUE, BOAT_LOGO_URL, EVENT_STYLES } from "./config.ts";
import { toDiscordMessage } from "./discord.ts";
import { SAMPLE_EVENTS, sampleEvent } from "./samples.ts";

describe("toDiscordMessage", () => {
  it("posts as boat, with boat's logo, and pings no one", () => {
    const message = toDiscordMessage(sampleEvent("sandbox.ready"));
    assert.equal(message.username, "boat");
    assert.equal(message.avatar_url, BOAT_LOGO_URL);
    assert.deepEqual(message.allowed_mentions, { parse: [] });
    assert.equal(message.embeds[0]?.footer.icon_url, BOAT_LOGO_URL);
  });

  it("gives each of the six events its sentence and colour", () => {
    for (const type of Object.keys(SAMPLE_EVENTS)) {
      const embed = toDiscordMessage(sampleEvent(type)).embeds[0];
      assert.equal(embed?.title, `Sample sandbox ${EVENT_STYLES[type]?.verb}`);
      assert.equal(embed?.color, EVENT_STYLES[type]?.color);
    }
  });

  it("shows the sandbox, the state change and the event", () => {
    const event = sampleEvent("sandbox.ready", "2026-10-29T12:00:00.000Z");
    const embed = toDiscordMessage(event).embeds[0];
    assert.deepEqual(embed?.fields, [
      { name: "Sandbox", value: "`bx_sample`", inline: true },
      { name: "State", value: "`cloning → ready`", inline: true },
    ]);
    assert.equal(embed?.footer.text, `sandbox.ready · ${event.id}`);
    assert.equal(embed?.timestamp, "2026-10-29T12:00:00.000Z");
  });

  it("adds the reason a sandbox degraded", () => {
    const fields = toDiscordMessage(sampleEvent("sandbox.degraded")).embeds[0]?.fields;
    assert.deepEqual(fields?.at(-1), { name: "Reason", value: "A firewall rule in the sandbox blocks the boat tunnel." });
  });

  it("falls back to the sandbox id, then to boat blue for an event it doesn't know", () => {
    const event = { id: "evt_1", type: "sandbox.renamed", createdAt: "2026-10-29T12:00:00.000Z", data: { sandbox: { id: "bx_1", name: " " } } };
    const embed = toDiscordMessage(event).embeds[0];
    assert.equal(embed?.title, "bx_1: sandbox.renamed");
    assert.equal(embed?.color, BOAT_BLUE);
  });

  it("keeps within Discord's limits and drops a timestamp it can't read", () => {
    const event = { id: "evt_1", type: "sandbox.ready", createdAt: "yesterday", data: { sandbox: { id: "bx_`1`", name: "n".repeat(300) } } };
    const embed = toDiscordMessage(event).embeds[0];
    assert.equal(embed?.title.length, 256);
    assert.equal(embed?.fields[0]?.value, "`bx_'1'`");
    assert.equal(embed?.timestamp, undefined);
    assert.equal("timestamp" in JSON.parse(JSON.stringify(embed)), false);
  });
});
