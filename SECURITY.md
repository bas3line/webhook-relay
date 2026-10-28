# Security

Please don't report security problems in a public issue. Use GitHub's private reporting instead: [report a vulnerability](https://github.com/bas3line/webhook-relay/security/advisories/new). It reaches [@bas3line](https://github.com/bas3line) directly.

The relay holds every source's signing secret and every destination's address, and its one job is to deliver only what a service really signed. Reports about anything that gets a message delivered without a valid signature, replays an old delivery, or leaks a secret are especially welcome.

Fixes land on `main` and deploy from there.
