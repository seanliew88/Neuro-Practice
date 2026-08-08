"""Unit tests for NeuroPractice's local scoring and history persistence."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import server


class PerformanceValidationTests(unittest.TestCase):
    # Build one valid ShapeShift browser payload for scoring tests.
    def valid_payload(self) -> dict[str, object]:
        return {
            "game": "shapeshift",
            "mode": "symbol",
            "durationSeconds": 60,
            "correct": 9,
            "total": 12,
            "startedAt": "2026-08-08T12:00:00+00:00",
        }

    # Calculate server-owned accuracy, signed score, and score-per-minute values.
    def test_validate_performance_calculates_statistics(self) -> None:
        performance = server.validate_performance(self.valid_payload())

        self.assertEqual(performance["accuracy"], 75.0)
        self.assertEqual(performance["score"], 6)
        self.assertEqual(performance["scorePerMinute"], 6.0)
        self.assertEqual(performance["game"], "shapeshift")
        self.assertEqual(performance["mode"], "symbol")

    # Reject invalid task durations before they can be saved to local history.
    def test_validate_performance_rejects_invalid_duration(self) -> None:
        payload = self.valid_payload()
        payload["durationSeconds"] = 90

        with self.assertRaises(ValueError):
            server.validate_performance(payload)

    # Accept Tower's extended five-minute session and retain its detail metrics.
    def test_validate_tower_performance(self) -> None:
        performance = server.validate_performance({
            "game": "tower",
            "mode": "tower",
            "durationSeconds": 300,
            "correct": 3,
            "total": 5,
            "details": {"puzzlesStarted": 5, "totalMoves": 21, "totalMinimumMoves": 17},
            "startedAt": "2026-08-08T12:00:00+00:00",
        })

        self.assertEqual(performance["score"], 1)
        self.assertEqual(performance["details"]["totalMoves"], 21)

    # Accept Number Box timings and puzzle-specific detail metrics.
    def test_validate_numberbox_performance(self) -> None:
        performance = server.validate_performance({
            "game": "numberbox",
            "mode": "classic",
            "durationSeconds": 240,
            "correct": 4,
            "total": 6,
            "details": {
                "skipped": 1,
                "resets": 2,
                "bestStreak": 3,
                "puzzlesSeen": 7,
                "totalSolveMilliseconds": 28500,
                "fastestSolveMilliseconds": 4100,
            },
            "startedAt": "2026-08-08T12:00:00+00:00",
        })

        self.assertEqual(performance["game"], "numberbox")
        self.assertEqual(performance["score"], 2)
        self.assertEqual(performance["details"]["bestStreak"], 3)
        self.assertEqual(performance["details"]["resets"], 2)

    # Accept Grill Master's timing, load, and mistake detail metrics.
    def test_validate_grillmaster_performance(self) -> None:
        performance = server.validate_performance({
            "game": "grillmaster",
            "mode": "classic",
            "durationSeconds": 120,
            "correct": 8,
            "total": 11,
            "details": {
                "rawPulled": 1,
                "charred": 2,
                "bestStreak": 5,
                "peakGrillLoad": 7,
                "totalCookMilliseconds": 57400,
                "fastestCookMilliseconds": 6100,
            },
            "startedAt": "2026-08-08T12:00:00+00:00",
        })

        self.assertEqual(performance["game"], "grillmaster")
        self.assertEqual(performance["score"], 5)
        self.assertEqual(performance["details"]["peakGrillLoad"], 7)

    # Keep only the most recent fifty sessions in the local JSON file.
    def test_save_performance_limits_history(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            history_path = Path(temporary_directory) / "performances.json"
            with patch.object(server, "PERFORMANCES_FILE", history_path):
                for index in range(51):
                    performance = server.validate_performance(self.valid_payload())
                    performance["id"] = str(index)
                    server.save_performance(performance)

                saved_history = server.load_performances()

        self.assertEqual(len(saved_history), 50)
        self.assertEqual(saved_history[0]["id"], "50")
