import type { Env, Field, Message } from "../types.ts";

// The subset of Discord's execute-webhook body the relay sends.
// https://discord.com/developers/docs/resources/webhook#execute-webhook
export interface DiscordBody {
  readonly username: string;
  readonly avatar_url: string;
  readonly allowed_mentions: { readonly parse: readonly string[] };
  readonly embeds: readonly DiscordEmbed[];
}

export interface DiscordEmbed {
  readonly title: string;
  readonly url?: string;
  readonly color: number;
  readonly fields: readonly { readonly name: string; readonly value: string; readonly inline?: boolean }[];
  readonly footer: { readonly text: string; readonly icon_url: string };
  readonly timestamp?: string;
}

export type Delivery = { readonly ok: true } | { readonly ok: false; readonly status: number; readonly reason: string };

// Discord's limits: 80 characters for a username, 256 for a title, 25 fields of 256 and 1024, 2048 for a footer.
function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function fieldValue(field: Field): string {
  return field.code ? `\`${clip(field.value.replaceAll("`", "'"), 1000)}\`` : clip(field.value, 1024);
}

export function toDiscordBody(message: Message): DiscordBody {
  return {
    username: clip(message.sender.name, 80),
    avatar_url: message.sender.iconUrl,
    // Webhook text is anyone's text: never let it ping the channel.
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: clip(message.title, 256),
        url: message.url,
        color: message.color,
        fields: message.fields.slice(0, 25).map((field) => ({ name: clip(field.name, 256), value: fieldValue(field), inline: field.inline })),
        footer: { text: clip(message.footer, 2048), icon_url: message.sender.iconUrl },
        // Discord refuses the whole message over a bad timestamp, so drop one it can't read.
        timestamp: message.timestamp && !Number.isNaN(Date.parse(message.timestamp)) ? message.timestamp : undefined,
      },
    ],
  };
}

export async function sendToDiscord(message: Message, env: Env): Promise<Delivery> {
  let response: Response;
  try {
    response = await fetch(env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(toDiscordBody(message)),
    });
  } catch (error) {
    return { ok: false, status: 0, reason: error instanceof Error ? error.name : "unreachable" };
  }

  return response.ok ? { ok: true } : { ok: false, status: response.status, reason: (await response.text()).slice(0, 500) };
}
