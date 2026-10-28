import type { BoatEvent } from "./boat.ts";

// One delivery of each event, shaped like boat's, for the tests and `npm run send:boat`.
// The Worker never imports this file, so none of it ships.
const sandbox = { id: "bx_sample", name: "Sample sandbox" };

export const SAMPLE_EVENTS: Readonly<Record<string, BoatEvent["data"]>> = {
  "sandbox.ready": { sandbox, previousState: "cloning", state: "ready" },
  "sandbox.hydrated": { sandbox },
  "sandbox.error": { sandbox, previousState: "starting", state: "error" },
  "sandbox.archived": { sandbox, previousState: "running", state: "archived" },
  "sandbox.degraded": { sandbox, state: "running", reason: "A firewall rule in the sandbox blocks the boat tunnel." },
  "sandbox.recovered": { sandbox, state: "running", reason: "The tunnel answers again." },
};

export function sampleEvent(type: string, createdAt = new Date().toISOString()): BoatEvent {
  return {
    id: `evt_${crypto.randomUUID().replaceAll("-", "")}`,
    type,
    createdAt,
    data: SAMPLE_EVENTS[type] ?? { sandbox },
  };
}
