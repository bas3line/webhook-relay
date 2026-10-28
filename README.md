<div align="center">

<a href="https://github.com/bas3line/webhook-relay">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://ascii.rest/banner/webhook-relay.dark.svg?color=6b8cff,a5b8ff&tagline=all%20your%20webhooks%2C%20one%20worker">
    <img alt="webhook-relay: all your webhooks, one worker" src="https://ascii.rest/banner/webhook-relay.svg?color=263fa9,6b8cff&tagline=all%20your%20webhooks%2C%20one%20worker">
  </picture>
</a>

<br>
<br>

Webhooks from every service you use, checked and posted where you'll read them.<br>
One Cloudflare Worker. A new service is one file.

[sources](#sources) · [deploy your own](#deploy-your-own) · [add a source](#add-a-source) · [how it works](#how-it-works) · [contributing](CONTRIBUTING.md)

[![by @bas3line](https://img.shields.io/badge/by-%40bas3line-181717?logo=github&logoColor=white)](https://github.com/bas3line)
[![CI](https://github.com/bas3line/webhook-relay/actions/workflows/ci.yml/badge.svg)](https://github.com/bas3line/webhook-relay/actions/workflows/ci.yml)
[![MIT](https://img.shields.io/badge/license-MIT-181717)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-181717?logo=typescript&logoColor=white)](tsconfig.json)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-181717?logo=cloudflare&logoColor=white)](wrangler.jsonc)

</div>

<br>

Written in TypeScript by [@bas3line](https://github.com/bas3line). Every service sends webhooks its own way, with its own JSON, its own signature scheme and its own retries. And the places you read them, like a Discord channel, only take their own format. webhook-relay sits in between. Each service is a **source**: one file that knows how to check that service's signature and read its events. Each place you read them is a **destination**: one file that knows how to post a message there. The Worker takes `POST /<source>`, refuses anything that isn't signed by the service it claims to be, and delivers the rest.

## Sources

| source | route | what it sends | file |
| --- | --- | --- | --- |
| [boat](#boat) | `POST /boat` | six sandbox lifecycle events | [`src/sources/boat.ts`](src/sources/boat.ts) |

| destination | needs | file |
| --- | --- | --- |
| Discord | `DISCORD_WEBHOOK_URL` | [`src/destinations/discord.ts`](src/destinations/discord.ts) |

More are on the way. To write one, see [add a source](#add-a-source).

### boat

<img src=".github/readme/message.svg" alt="Two Discord messages from boat, with boat's logo: 'Production worker is ready' on a green bar, and 'Production worker is degraded' on an amber one, with the reason" width="616">

[boat](https://boat.dev) signs its own JSON, so pointing boat straight at a Discord webhook gets every delivery refused with `Cannot send an empty message`. Through the relay, each event posts as "boat", with boat's logo, a sentence for what happened and a colour for it:

| event | message | bar |
| --- | --- | --- |
| `sandbox.ready` | Production worker is ready | green |
| `sandbox.hydrated` | Production worker finished restoring | boat blue |
| `sandbox.error` | Production worker failed | red |
| `sandbox.archived` | Production worker stopped | grey |
| `sandbox.degraded` | Production worker is degraded, and why | amber |
| `sandbox.recovered` | Production worker recovered, and why | teal |

Each message links to the boat dashboard and carries the sandbox ID, the state change (`cloning → ready`), the event ID and the time boat recorded the event. An event boat adds later still posts, in boat blue, under its own name. To hook it up:

```sh
boat webhook create https://webhook-relay.<your-subdomain>.workers.dev/boat --name discord
```

Without `--event`, boat sends all six. It prints the signing secret, `whsec_...`, once: that's `BOAT_WEBHOOK_SECRET`.

## Deploy your own

You need Node 24 or later, a Cloudflare account, and the accounts of the services you're relaying.

```sh
git clone https://github.com/bas3line/webhook-relay
cd webhook-relay
npm install
cp .dev.vars.example .dev.vars
```

1. **Fill in `.dev.vars`.** One line per secret: each source's signing secret (see its section above) and each destination's address. For Discord, in the channel's settings: Integrations, Webhooks, New Webhook, Copy Webhook URL.
2. **Deploy.** The Worker lives at `https://webhook-relay.<your-subdomain>.workers.dev`; your subdomain is on the Workers & Pages page of the Cloudflare dashboard. A new Worker takes its secrets from a file on the first deploy, and later deploys keep them:

   ```sh
   npx wrangler deploy --secrets-file .dev.vars
   ```

3. **Point each service at its route,** `https://webhook-relay.<your-subdomain>.workers.dev/<source>`.
4. **Try it.** For boat, this signs a sample event with your secret and posts it through the Worker to your channel:

   ```sh
   npm run send:boat -- ready https://webhook-relay.<your-subdomain>.workers.dev/boat
   ```

To change a secret later, `npx wrangler secret put <NAME>`.

### Deploy on every push

In the Cloudflare dashboard, open Workers & Pages, the `webhook-relay` Worker, Settings, Builds, and connect your fork. Set the build command to `npm run check` and leave the deploy command as `npx wrangler deploy`. Every push to `main` is typechecked, tested and bundled, then deployed. The secrets stay on the Worker between deploys, and `secrets.required` in `wrangler.jsonc` fails a deploy if one goes missing, instead of letting the Worker answer every event with an error.

## Add a source

A source is one file in `src/sources/` that exports a `Source`:

```ts
export const github: Source = {
  name: "github", // the route: POST /github
  verify: (request, body, env) => checkHubSignature(env.GITHUB_WEBHOOK_SECRET, request.headers, body),
  read(body) {
    // The body as { id, type, message }, or null when it isn't one of GitHub's events.
  },
};
```

`verify` gets the raw bytes before anything parses them. `read` turns the service's JSON into a `Message`: a sender with a name and an icon, a title, a colour, fields, and a footer. Destinations post that, so a source never writes Discord's format or anyone else's. Then:

1. Add it to the list in `src/sources/index.ts`.
2. Add its secret to `Env` in `src/types.ts`, to `secrets.required` in `wrangler.jsonc`, and to `.dev.vars.example`.
3. Give it tests beside it, `src/sources/<name>.test.ts`, and a section in this README.

[CONTRIBUTING.md](CONTRIBUTING.md) has the rules a source follows. A destination works the same way, in `src/destinations/`.

## Run it locally

```sh
npm run dev                       # the Worker on http://localhost:8787
npm run send:boat -- degraded     # a signed sample boat event, to the Worker on :8787
```

`npm run dev` reads `.dev.vars`. Locally, any signing secret works, as long as the send script signs with the same one.

| script | |
| --- | --- |
| `npm run dev` | the Worker, with `wrangler dev` |
| `npm run send:boat -- <event> [url]` | signs a sample boat delivery (`ready`, `hydrated`, `error`, `archived`, `degraded`, `recovered`) and posts it |
| `npm test` | the tests, with Node's own test runner |
| `npm run check` | typecheck, tests, and the Worker bundled the way Cloudflare will bundle it; what CI runs |
| `npm run deploy` | the checks, then `wrangler deploy` |

## How it works

| route | |
| --- | --- |
| `POST /<source>` | a webhook. 200 delivered, 401 bad signature, 400 not one of the source's events, 413 too big, 502 the destination refused it or couldn't be reached |
| `GET /health` | `{"ok":true,"sources":["boat"]}`, for uptime checks |

- **Signatures first.** Each source checks the raw bytes before anything parses them, the way that service documents it. boat's is HMAC-SHA256 over `<delivery id>.<timestamp>.<body>`, compared in constant time, and refused if it was signed more than five minutes from now. A bad signature is a 401, and nothing is delivered.
- **Retries.** A 2xx tells the sender the event arrived. When a destination refuses a message or can't be reached, the Worker answers 502, and the sender tries again on its own schedule (boat: with backoff, up to 8 times). The status and the destination's reason show in Workers Logs.
- **At least once.** Senders can deliver an event twice, and the Worker keeps no state, so a retried event can post twice. The event ID in each footer tells the two apart.
- **No pings.** Discord messages go out with mentions turned off. A webhook's text is anyone's text, and it never pings a channel.

```
src/
  index.ts         the Worker: routes POST /<source>, verifies, reads, delivers
  types.ts         Env, Source, and Message, the format sources write and destinations post
  http.ts          JSON responses, log lines, and a body read with a size cap
  sources/
    index.ts       the list of sources
    boat.ts        boat's signature check, its events, and their messages
  destinations/
    discord.ts     a Message as a Discord webhook post
scripts/
  send-boat.ts     signs a sample boat delivery and posts it
```

No runtime dependencies. The Worker uses only web APIs (`fetch`, Web Crypto, `TextEncoder`). Node runs the TypeScript directly for the tests and scripts, and Wrangler bundles the Worker.

## Contributing

New sources and destinations are the best contribution, and fixes and ideas are welcome too. [CONTRIBUTING.md](CONTRIBUTING.md) covers the setup, the checks, the rules a source follows and how to open a pull request, and the [code of conduct](CODE_OF_CONDUCT.md) applies everywhere. Found a security problem? See [SECURITY.md](SECURITY.md).

## Author

Made by [@bas3line](https://github.com/bas3line). If you use it, a link back is appreciated, and so is a star.

To support it: [GitHub Sponsors](https://github.com/sponsors/bas3line), [Buy Me a Coffee](https://buymeacoffee.com/bas3line) or [PayPal](https://paypal.me/ShubhamYadav886).

## License

The code is MIT, © [@bas3line](https://github.com/bas3line). Each service's name and logo belong to that service. The relay links them from the service's own site to name the product, and isn't made by or affiliated with any of them.
