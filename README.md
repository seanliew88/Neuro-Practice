# NeuroPractice

NeuroPractice is an account-based cognitive practice site. It currently contains
ShapeShift, Tower, Number Box, Grill Master, Balloon, and Figure It Out.

## Structure

```text
web/
  index.html                 NeuroPractice game hub
  games/shapeshift/          Task-switching practice game
  games/tower/               Tower-of-Hanoi planning practice game
  games/numberbox/           Four-number arithmetic target game
  games/grillmaster/         Accelerating grill-management game
  games/balloon/             BART-style risk and reward game
  games/figureitout/         Hidden-property deduction game
web/account/                  Registration and sign-in interface
web/shared/                   Shared authenticated API client
web/rankings/                 Daily game-mode leaderboards
worker/                       Cloudflare Worker API and asset authorization
migrations/                   Versioned Cloudflare D1 schema
tests/                        Worker validation and contract tests
wrangler.jsonc                Workers, assets, and D1 configuration
```

## Run

Requires Node.js 20 or newer.

```bash
cd '/Users/seanliew/Documents/AI Memory Workspace/projects/neuropractice'
npm install
npm run db:migrate:local
npm run dev
```

Open the local URL printed by Wrangler. The home page routes to every available game.
Create an account before opening a game. Wrangler stores local D1 data under
`.wrangler/`; production uses Cloudflare D1. Every completed session belongs to the
signed-in account. Daily rankings expose display names and each account's best result
for the selected game mode, but never expose email addresses.

## Daily Rankings

The account-only `/rankings/` screen provides a separate leaderboard for every game
mode. Rankings reset at midnight UTC and use each account's best completed session for
that UTC day. Score per minute is the primary ranking value; accuracy and raw score
break statistical ties. The top 50 are displayed, while a signed-in player outside the
top 50 can still see their own position.

Leaderboard responses contain display names and performance statistics only. User IDs
and email addresses are never returned. Today’s attempts are retained until the UTC
day closes so additional play cannot remove an earlier best result from the ranking.

## Deploy

The Worker serves the static site, handles account APIs, and stores account-scoped
history in D1. Password hashes use PBKDF2 with per-account salts, and opaque sessions
are stored in D1 and referenced by secure HttpOnly cookies.

1. Push this branch to GitHub after approval.
2. Run `npx wrangler login` and authorize the Cloudflare account.
3. Run `npx wrangler d1 create neuropractice`.
4. Replace the placeholder `database_id` in `wrangler.jsonc` with the returned ID.
5. Run `npm run db:migrate:remote` before every deployment to apply pending schema and
   index migrations in order.
6. Run `npm test && npm run check`.
7. Run `npm run deploy` to publish the site and receive its `workers.dev` URL.

Use `/health` for deployment health checks. A custom domain can be attached from the
Worker's Cloudflare dashboard after the first deployment.

## Test

```bash
npm test
npm run check
```
