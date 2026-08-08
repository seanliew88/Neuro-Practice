# NeuroPractice

NeuroPractice is a local browser collection of cognitive practice games. It currently
contains ShapeShift, Tower, Number Box, Grill Master, Balloon, and Figure It Out.

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
data/                         Local, gitignored performance history
tests/                        Python persistence tests
server.py                     Dependency-free local server
```

## Run

Requires Python 3.11 or newer. No packages are required.

```bash
cd '/Users/seanliew/Documents/AI Memory Workspace/projects/neuropractice'
python3 server.py
```

Open <http://127.0.0.1:8000>. The home page routes to every available game.
Completed sessions are saved locally per game. Each game shows a post-round detail
summary and a tracker where any saved round can be opened for its full metrics.

## Test

```bash
python3 -m unittest discover -s tests -v
node --check web/games/shapeshift/app.js
node --check web/games/tower/app.js
node --check web/games/numberbox/app.js
node --check web/games/grillmaster/app.js
node --check web/games/balloon/app.js
node --check web/games/figureitout/app.js
```
