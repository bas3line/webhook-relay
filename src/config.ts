// boat's own mark, linked from boat.dev so Discord shows the real thing.
export const BOAT_LOGO_URL = "https://boat.dev/apple-touch-icon.png";
export const BOAT_DASHBOARD_URL = "https://boat.dev/dashboard?tab=sandboxes";
export const BOAT_BLUE = 0x263fa9;

// boat's docs ask receivers to refuse deliveries signed more than five minutes away from now.
export const MAX_TIMESTAMP_SKEW_SECONDS = 300;

// A boat delivery is a few hundred bytes; anything this big is not one.
export const MAX_BODY_BYTES = 64 * 1024;

export interface EventStyle {
  readonly verb: string;
  readonly color: number;
}

// How each event reads in Discord: "<sandbox> <verb>", on a bar of its colour.
export const EVENT_STYLES: Readonly<Record<string, EventStyle>> = {
  "sandbox.ready": { verb: "is ready", color: 0x22c55e },
  "sandbox.hydrated": { verb: "finished restoring", color: BOAT_BLUE },
  "sandbox.error": { verb: "failed", color: 0xef4444 },
  "sandbox.archived": { verb: "stopped", color: 0x71717a },
  "sandbox.degraded": { verb: "is degraded", color: 0xf59e0b },
  "sandbox.recovered": { verb: "recovered", color: 0x14b8a6 },
};
