import assert from "node:assert/strict";
import test from "node:test";

import {
  constantTimeEqual,
  readCookie,
  serializePerformance,
  serializeRanking,
  utcDayBounds,
  validatePerformance,
} from "../worker/index.js";

// Build one valid ShapeShift payload for scoring tests.
function validPayload() {
  return {
    game: "shapeshift",
    mode: "symbol",
    durationSeconds: 60,
    correct: 9,
    total: 12,
    startedAt: "2026-08-08T12:00:00+00:00",
  };
}

test("calculates trusted performance statistics", () => {
  const performance = validatePerformance(validPayload());
  assert.equal(performance.accuracy, 75);
  assert.equal(performance.score, 6);
  assert.equal(performance.scorePerMinute, 6);
});

test("rejects invalid game durations", () => {
  assert.throws(() => validatePerformance({ ...validPayload(), durationSeconds: 90 }), /duration/);
});

test("sanitizes performance detail metrics", () => {
  const performance = validatePerformance({
    ...validPayload(),
    details: { bestStreak: 4, negative: -1, decimal: 2.5, label: "unsafe" },
  });
  assert.deepEqual(performance.details, { bestStreak: 4 });
});

test("accepts all configured game variants", () => {
  const variants = [
    ["tower", "tower", 300],
    ["numberbox", "classic", 240],
    ["grillmaster", "classic", 120],
    ["balloon", "classic", 300],
    ["figureitout", "classic", 180],
  ];
  for (const [game, mode, durationSeconds] of variants) {
    assert.equal(validatePerformance({ ...validPayload(), game, mode, durationSeconds }).game, game);
  }
});

test("reads an exact cookie name", () => {
  const request = new Request("https://example.com", {
    headers: { Cookie: "theme=dark; neuropractice_session=abc123; other=value" },
  });
  assert.equal(readCookie(request, "neuropractice_session"), "abc123");
  assert.equal(readCookie(request, "missing"), null);
});

test("compares equal fixed-length secrets", () => {
  assert.equal(constantTimeEqual("same-token", "same-token"), true);
  assert.equal(constantTimeEqual("same-token", "diff-token"), false);
  assert.equal(constantTimeEqual("short", "longer"), false);
});

test("serializes D1 rows to the frontend contract", () => {
  const result = serializePerformance({
    id: "one", game: "tower", mode: "tower", duration_seconds: 60,
    correct: 2, total: 3, accuracy: 66.7, score: 1, score_per_minute: 1,
    details: "{\"totalMoves\":12}", started_at: "start", saved_at: "saved",
  });
  assert.equal(result.durationSeconds, 60);
  assert.deepEqual(result.details, { totalMoves: 12 });
});

test("builds UTC day boundaries for daily rankings", () => {
  const day = utcDayBounds(new Date("2026-08-08T23:59:30.000Z"));
  assert.deepEqual(day, {
    date: "2026-08-08",
    start: "2026-08-08T00:00:00.000Z",
    end: "2026-08-08T23:59:59.999Z",
  });
});

test("serializes rankings without account identifiers", () => {
  const ranking = serializeRanking({
    position: 2,
    user_id: "current-user",
    display_name: "Player Two",
    score_per_minute: 8.5,
    accuracy: 91.2,
    score: 17,
    correct: 21,
    total: 25,
    duration_seconds: 120,
  }, "current-user");
  assert.deepEqual(ranking, {
    position: 2,
    displayName: "Player Two",
    scorePerMinute: 8.5,
    accuracy: 91.2,
    score: 17,
    correct: 21,
    total: 25,
    durationSeconds: 120,
    isCurrentUser: true,
  });
  assert.equal("userId" in ranking, false);
});
