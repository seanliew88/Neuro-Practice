# NeuroPractice

NeuroPractice is an account-based collection of timed cognitive practice games. Each
completed session is saved to the player's private history, while daily game-mode
rankings provide an optional comparison with other players.

## Try It

The production site is available at:

**[Open NeuroPractice](https://neuropractice.seanliew8898.workers.dev)**

Create an account to play, retain performance history across devices, and enter the
daily rankings.

## Available Games

- **ShapeShift** — Switch between classification rules under time pressure. Symbol
  Switch tests letter and number classification, while Arrow + Arithmetic combines
  visual comparison with parity decisions. Sessions last one to three minutes.
- **Tower** — Rearrange coloured floors to match a target while following
  Tower-of-Hanoi movement rules. The minimum solution is shown for practice, and
  sessions last one to five minutes.
- **Number Box** — Combine four numbers with addition, subtraction, multiplication,
  and division to reach a target, using every number exactly once. Sessions last one
  to five minutes.
- **Grill Master** — Monitor an increasingly busy grill and pull each piece during its
  cooked window before it burns. Sessions last one to three minutes.
- **Balloon** — A Balloon Analogue Risk Task-inspired game where each pump increases
  potential reward and burst risk. Later phases increase both rewards and penalties.
  Sessions last one to five minutes.
- **Figure It Out** — Recreate a hidden figure from aggregate property-match feedback.
  Shape and colour appear first, with pattern, size, and border introduced as the
  session progresses. Sessions last one to five minutes.

Code Compare, Digit, and The Switch are planned but not yet available.

## Repository Structure

```text
Neuro-Practice/
├── web/                              Static frontend served by Cloudflare
│   ├── index.html                    Game hub
│   ├── home.css                      Home-page design
│   ├── home.js                       Home-page account controls
│   ├── account/                      Registration and sign-in screen
│   ├── rankings/                     Daily leaderboard screen
│   ├── shared/
│   │   └── auth-client.js            Shared authenticated API client
│   └── games/
│       ├── shapeshift/               Task-switching game
│       ├── tower/                    Planning puzzle
│       ├── numberbox/                Arithmetic target game
│       ├── grillmaster/              Divided-attention game
│       ├── balloon/                  BART-style risk game
│       └── figureitout/              Hidden-property deduction game
├── worker/
│   └── index.js                      Accounts, sessions, history, and ranking APIs
├── migrations/                       Versioned Cloudflare D1 schema changes
│   ├── 0001_accounts_and_performances.sql
│   └── 0002_daily_rankings.sql
├── tests/
│   └── worker.test.js                Validation and API-contract unit tests
├── package.json                      Development, test, migration, and deploy scripts
├── package-lock.json                 Locked Node.js dependencies
├── wrangler.jsonc                    Worker, assets, D1, and scheduled-task config
└── README.md
```

## Run

Requires Node.js 20 or newer.

```bash
cd Neuro-Practice
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
