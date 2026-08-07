# Tower

Tower is NeuroPractice's planning-puzzle game. Match a randomly generated target tower
by moving coloured floors between three rods.

- Only the top floor of a rod can move.
- A larger floor cannot be placed on a smaller floor.
- The displayed minimum move count is calculated from the exact target using a
  breadth-first search of legal Tower-of-Hanoi states.

Sessions run for 1 through 5 minutes. Completed puzzles immediately generate a new
target while the timer continues. Tower currently does not save performance history.
