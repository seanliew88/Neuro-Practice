# ShapeShift

ShapeShift is a local browser-based cognitive practice game for task switching. It has
two modes and records completed sessions on the local machine only.

## Modes

- **Symbol switch:** show two alphanumeric cards, such as `X2` and `A10`, on every
  trial. When the left card is active, classify its letter as vowel/consonant; when the
  right card is active, classify its number as even/odd.
- **Arrow + arithmetic:** randomly choose either arrow-set comparison or arithmetic
  parity on each trial.

Each session lasts 1, 2, or 3 minutes. The home screen configures the session; the game
screen contains only active play. Live metrics show score, attempts, accuracy, and score
per minute. Every correct answer is `+1`; every wrong answer is `-1`. Past sessions remain in a separate view that
unlocks only after a session finishes, and keeps the most recent 50 results in
`data/performances.json`.

Use **Quit this session** to end a practice run without saving its partial result.

## Run

Requires Python 3.11 or newer. No packages need to be installed.

```bash
cd '/Users/seanliew/Documents/AI Memory Workspace/projects/neuropractice'
python3 server.py
```

Open <http://127.0.0.1:8000> in a browser. Use the left and right arrow keys for the
corresponding answers, or select the buttons directly.

## Test

```bash
cd '/Users/seanliew/Documents/AI Memory Workspace/projects/neuropractice'
python3 -m unittest discover -s tests -v
```

## Data

Performance history remains on this computer and is ignored by Git. Delete
`data/performances.json` while the server is stopped to reset local history.
