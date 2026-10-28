import { BOAT_BLUE, BOAT_DASHBOARD_URL, BOAT_LOGO_URL, EVENT_STYLES } from "./config.ts";
import type { BoatEvent } from "./types.ts";

// The subset of Discord's execute-webhook body this relay sends.
// https://discord.com/developers/docs/resources/webhook#execute-webhook
export interface DiscordMessage {
  readonly username: string;
  readonly avatar_url: string;
  readonly allowed_mentions: { readonly parse: readonly string[] };
  readonly embeds: readonly DiscordEmbed[];
}

export interface DiscordEmbed {
  readonly title: string;
  readonly url: string;
  readonly color: number;
  readonly fields: readonly DiscordField[];
  readonly footer: { readonly text: string; readonly icon_url: string };
  readonly timestamp?: string;
}

export interface DiscordField {
  readonly name: string;
  readonly value: string;
  readonly inline?: boolean;
}

// Discord's limits: 256 characters for a title, 1024 for a field, 2048 for a footer.
function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function code(value: string): string {
  return `\`${clip(value.replaceAll("`", "'"), 1000)}\``;
}

export function toDiscordMessage(event: BoatEvent): DiscordMessage {
  const style = EVENT_STYLES[event.type];
  const { sandbox, previousState, state, reason } = event.data;
  const subject = sandbox?.name?.trim() || sandbox?.id || "A sandbox";

  const fields: DiscordField[] = [];
  if (sandbox?.id) {
    fields.push({ name: "Sandbox", value: code(sandbox.id), inline: true });
  }
  if (state) {
    fields.push({ name: "State", value: code(previousState ? `${previousState} → ${state}` : state), inline: true });
  }
  if (reason) {
    fields.push({ name: "Reason", value: clip(reason, 1024) });
  }

  return {
    username: "boat",
    avatar_url: BOAT_LOGO_URL,
    // Sandbox names are anyone's text: never let one ping the channel.
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: clip(style ? `${subject} ${style.verb}` : `${subject}: ${event.type}`, 256),
        url: BOAT_DASHBOARD_URL,
        color: style?.color ?? BOAT_BLUE,
        fields,
        footer: { text: clip(`${event.type} · ${event.id}`, 2048), icon_url: BOAT_LOGO_URL },
        // Discord refuses the whole message over a bad timestamp, so drop one it can't read.
        timestamp: Number.isNaN(Date.parse(event.createdAt)) ? undefined : event.createdAt,
      },
    ],
  };
}
