# Contributing

Thanks for wanting to make the relay better. New sources and destinations are the best contribution, and fixes and clearer messages are welcome too.

## Setup

You need Node 24 or later, which runs TypeScript files directly, so the tests and scripts need no build step.

```sh
git clone https://github.com/bas3line/webhook-relay
cd webhook-relay
npm install
cp .dev.vars.example .dev.vars
npm run dev                  # the Worker on http://localhost:8787
npm run send:boat -- ready   # a signed sample boat event, to the Worker on :8787
```

To see a message in Discord, put a webhook URL from a channel of your own in `.dev.vars`. Without one, the Worker answers the send script with a 502, which is still enough to check the signature path.

## How it fits together

- `src/index.ts`: the Worker. Finds the source for `POST /<source>`, checks the signature, reads the event and delivers the message. Answers the sender with the status that makes it retry or not.
- `src/types.ts`: `Env` (every secret), `Source`, and `Message`, the neutral format sources write and destinations post.
- `src/sources/`: one file per service. `index.ts` lists them; `boat.ts` is the first. A source's samples, for its tests and its send script, sit beside it as `<name>.samples.ts`.
- `src/destinations/`: one file per place messages go. `discord.ts` turns a `Message` into Discord's execute-webhook body and posts it.
- `src/http.ts`: JSON responses, one-line JSON logs, and `readBody`, which refuses an oversized body without holding it in memory.
- `scripts/send-<source>.ts`: signs a sample delivery the way the service does and posts it.

## Adding a source

1. Write `src/sources/<name>.ts`, exporting a `Source`. Its `name` is its route.
2. Add it to `src/sources/index.ts`.
3. Add its secret, named `<NAME>_WEBHOOK_SECRET`, to `Env` in `src/types.ts`, to `secrets.required` in `wrangler.jsonc`, and to `.dev.vars.example` with a line on where to find it.
4. Write `src/sources/<name>.test.ts`: the signature accepted and refused, the parser on a real payload and on junk, and a message for each event.
5. Add `<name>.samples.ts` and `scripts/send-<name>.ts` if the service can't send you a test delivery itself.
6. Add a row to the sources table in the README, and a section with a screenshot of its messages and how to point the service at the relay.

A destination is the same shape in `src/destinations/`: a `Message` in, that service's request out, and a `Delivery` back saying whether it landed.

## The rules a source follows

- **Verify first, on the raw bytes.** Nothing parses, logs or delivers a body before its signature checks out. Use the scheme the service documents, compare in constant time (`crypto.subtle.verify`), and refuse old timestamps where the service sends them.
- **No runtime dependencies.** Sources and destinations use web APIs only: `fetch`, Web Crypto, `TextEncoder`. If something needs a library, say why in the pull request.
- **Secrets stay secret.** They come from the Worker's environment, never from code, and never appear in a log line or an error response. That includes destination URLs that carry a token, like Discord's.
- **A failed delivery is a non-2xx.** That's how senders know to retry. Only answer 2xx once the message has landed.
- **Write a `Message`, not a destination's format.** A source never builds Discord embeds; the destination does, and enforces its own limits.
- **Messages say what happened.** "Production worker failed", not "Event received". Plain verbs, sentence case, the service's own name and logo.

## Checks

```sh
npm run check      # typecheck, tests, and the Worker bundled by Wrangler
```

CI runs the same on every pull request. Tests live beside the code they test, as `*.test.ts`, on Node's own runner (`node:test`). A change to a route needs a test through `worker.fetch`, as in `src/index.test.ts`.

## Pull requests

Keep each one to one change, and say what it changes and how you checked it. For a new source or a change to a message, include a screenshot of it in Discord. Commits in the imperative ("Add the GitHub source"), one idea each.
