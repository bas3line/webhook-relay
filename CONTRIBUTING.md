# Contributing

Thanks for wanting to make the relay better. Fixes, clearer messages, and new sources or destinations are all welcome.

## Setup

You need Node 24 or later, which runs TypeScript files directly, so the tests and scripts need no build step.

```sh
git clone https://github.com/bas3line/webhook-relay
cd webhook-relay
npm install
cp .dev.vars.example .dev.vars
npm run dev                  # the Worker on http://localhost:8787
npm run send -- ready        # a signed sample event, to the Worker on :8787
```

To see a message in Discord, put a webhook URL from a channel of your own in `.dev.vars`. Without one, the Worker answers `npm run send` with a 502, which is still enough to check the signature path.

## How it fits together

- `src/index.ts`: the Worker. Routes requests, and on `POST /boat` checks the signature, parses the event and posts the message.
- `src/boat.ts`: everything boat-shaped. `verifySignature`, its mirror `signDelivery`, and `parseEvent`.
- `src/discord.ts`: `toDiscordMessage`, an event as Discord's execute-webhook body.
- `src/config.ts`: boat's logo and dashboard link, and the sentence and colour for each event. A wording or colour change starts here.
- `src/http.ts`: JSON responses and one-line JSON logs.
- `src/samples.ts`: one delivery of each event. The tests and `scripts/send.ts` use it; the Worker never imports it.
- `scripts/send.ts`: signs a sample delivery the way boat does and posts it.

### Another source or destination

The name is wider than boat on purpose. A new source is a module like `boat.ts`: how to check its signature, and how to read its body. A new destination is a module like `discord.ts`: an event in, that service's message out. Each source gets its own route in `src/index.ts` and its own secrets in `wrangler.jsonc` and `.dev.vars.example`. Keep a source's signature check ahead of everything else it does.

## The rules the relay follows

- **No runtime dependencies.** The Worker uses web APIs only: `fetch`, Web Crypto, `TextEncoder`. If something needs a library, say why in the pull request.
- **Check the signature on the raw bytes, first.** Nothing parses, logs or forwards a body before it's verified.
- **Secrets stay secret.** They come from the Worker's environment, never from code, and never appear in a log line or an error response. That includes the Discord webhook URL: its last part is a token.
- **A failed post is a non-2xx.** That's how boat knows to retry. Only answer 2xx once the message is in Discord.
- **Discord's limits are the relay's limits.** Titles 256 characters, fields 1024, and `allowed_mentions` empty, so text from a sandbox can never ping a channel.
- **Messages say what happened.** "Production worker failed", not "Event received". Plain verbs, sentence case.

## Checks

```sh
npm run check      # typecheck, tests, and the Worker bundled by Wrangler
```

CI runs the same on every pull request. Tests live beside the code they test, as `src/*.test.ts`, on Node's own runner (`node:test`). A change to a message needs a test of the message; a change to a route needs one through `worker.fetch`, as in `src/index.test.ts`.

## Pull requests

Keep each one to one change, and say what it changes and how you checked it. For a change to a message, include a screenshot of it in Discord. Commits in the imperative ("Show the sandbox's region"), one idea each.
