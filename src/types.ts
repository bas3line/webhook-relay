// The Worker's secrets: `wrangler secret put` in production, `.dev.vars` for `npm run dev`.
// Each source brings its own signing secret, and each destination its own address.
export interface Env {
  readonly BOAT_WEBHOOK_SECRET: string;
  readonly DISCORD_WEBHOOK_URL: string;
}

export interface Field {
  readonly name: string;
  readonly value: string;
  // Set in monospace: IDs, states, anything you'd copy rather than read.
  readonly code?: boolean;
  readonly inline?: boolean;
}

// What happened, in no service's format. A source writes one, a destination posts it.
export interface Message {
  readonly sender: { readonly name: string; readonly iconUrl: string };
  readonly title: string;
  readonly url?: string;
  readonly color: number;
  readonly fields: readonly Field[];
  readonly footer: string;
  readonly timestamp?: string;
}

export interface Event {
  readonly id: string;
  readonly type: string;
  readonly message: Message;
}

// One service that sends webhooks, reached at POST /<name>.
export interface Source {
  readonly name: string;
  // Whether the request really came from the service. Runs on the raw body, before anything parses it.
  verify(request: Request, body: ArrayBuffer, env: Env): Promise<boolean>;
  // The body as an event, or null when it isn't one of the service's.
  read(body: ArrayBuffer): Event | null;
}
