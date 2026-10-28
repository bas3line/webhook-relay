# Security

Please don't report security problems in a public issue. Use GitHub's private reporting instead: [report a vulnerability](https://github.com/bas3line/webhook-relay/security/advisories/new). It reaches [@bas3line](https://github.com/bas3line) directly.

The relay holds two secrets, boat's signing secret and a Discord webhook URL, and its one job is to post only what boat signed. Reports about anything that gets a message into a channel without a valid signature, replays an old delivery, or leaks either secret are especially welcome.

Fixes land on `main` and deploy from there.
