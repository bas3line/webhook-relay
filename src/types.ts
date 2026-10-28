// The Worker's secrets: `wrangler secret put` in production, `.dev.vars` for `npm run dev`.
export interface Env {
  readonly BOAT_WEBHOOK_SECRET: string;
  readonly DISCORD_WEBHOOK_URL: string;
}

// The body of one boat delivery. https://docs.boat.dev/webhooks#payload
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
