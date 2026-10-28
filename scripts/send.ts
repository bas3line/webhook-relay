// Signs a sample boat event the way boat does and posts it to the relay.
//
//   npm run send                          sandbox.ready, to `npm run dev` on :8787
//   npm run send -- degraded              any of the six events, with or without `sandbox.`
//   npm run send -- error https://<your worker>/boat
//
// The secret comes from BOAT_WEBHOOK_SECRET, or from .dev.vars.
import { existsSync } from "node:fs";

import { signDelivery } from "../src/boat.ts";
import { SAMPLE_EVENTS, sampleEvent } from "../src/samples.ts";

const [name = "ready", url = "http://localhost:8787/boat"] = process.argv.slice(2);
const type = name.startsWith("sandbox.") ? name : `sandbox.${name}`;

if (!(type in SAMPLE_EVENTS)) {
  console.error(`Unknown event "${name}". One of: ${Object.keys(SAMPLE_EVENTS).join(", ")}`);
  process.exit(1);
}

if (!process.env.BOAT_WEBHOOK_SECRET && existsSync(".dev.vars")) {
  process.loadEnvFile(".dev.vars");
}
const secret = process.env.BOAT_WEBHOOK_SECRET;
if (!secret) {
  console.error("Set BOAT_WEBHOOK_SECRET, or put it in .dev.vars (see .dev.vars.example).");
  process.exit(1);
}

const event = sampleEvent(type);
const body = JSON.stringify(event);
const timestamp = String(Math.floor(Date.now() / 1000));
const signature = await signDelivery(secret, event.id, timestamp, new TextEncoder().encode(body).buffer as ArrayBuffer);

const response = await fetch(url, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-ascii-event": type,
    "x-ascii-delivery": event.id,
    "x-ascii-timestamp": timestamp,
    "x-ascii-signature": signature,
    "x-ascii-attempt": "1",
  },
  body,
});

console.log(`${type} → ${url}: ${response.status} ${await response.text()}`);
process.exitCode = response.ok ? 0 : 1;
