# ShapeShift

ShapeShift is a browser-based cognitive practice game for task switching. It has two
modes and records completed sessions under the signed-in NeuroPractice account.

## Modes

- **Symbol switch:** show two alphanumeric cards, such as `X2` and `A10`, on every
  trial. When the left card is active, classify its letter as vowel/consonant; when the
  right card is active, classify its number as even/odd.
- **Arrow + arithmetic:** randomly choose either arrow-set comparison or arithmetic
  parity on each trial.

Each session lasts 1, 2, or 3 minutes. The home screen configures the session; the game
screen contains only active play. Live metrics show score, attempts, accuracy, and score
per minute. Every correct answer is `+1`; every wrong answer is `-1`. Past sessions
remain in a separate view that unlocks only after a session finishes and keeps the
account's most recent 50 results.

Use **Quit this session** to end a practice run without saving its partial result.

## Run

Requires Node.js 20 or newer and the repository dependencies.

```bash
cd '/Users/seanliew/Documents/AI Memory Workspace/projects/neuropractice'
npm install
npm run db:migrate:local
npm run dev
```

Open the local URL printed by Wrangler. Use the left and right arrow keys for the
corresponding answers, or select the buttons directly.

## Test

```bash
cd '/Users/seanliew/Documents/AI Memory Workspace/projects/neuropractice'
npm test
npm run check
```

## Data

Production history is stored per account in Cloudflare D1. Wrangler keeps the local
D1 database under the gitignored `.wrangler/` directory.
