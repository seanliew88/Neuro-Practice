#!/usr/bin/env python3
"""Run the local NeuroPractice site and persist supported game history."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse
from uuid import uuid4

PROJECT_ROOT = Path(__file__).resolve().parent
WEB_ROOT = PROJECT_ROOT / "web"
PERFORMANCES_FILE = PROJECT_ROOT / "data" / "performances.json"
GAME_RULES = {
    "shapeshift": {"modes": {"symbol", "arrow"}, "durations": {60, 120, 180}},
    "tower": {"modes": {"tower"}, "durations": {60, 120, 180, 240, 300}},
    "numberbox": {"modes": {"classic"}, "durations": {60, 120, 180, 240, 300}},
}


# Return an empty history if the local data file has not been created yet.
def load_performances() -> list[dict[str, Any]]:
    if not PERFORMANCES_FILE.exists():
        return []

    try:
        contents = json.loads(PERFORMANCES_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []

    return contents if isinstance(contents, list) else []


# Validate browser input and calculate statistics on the server, not the client.
def validate_performance(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("A performance must be a JSON object.")

    game = payload.get("game")
    mode = payload.get("mode")
    duration_seconds = payload.get("durationSeconds")
    correct = payload.get("correct")
    total = payload.get("total")

    if game not in GAME_RULES:
        raise ValueError("Unsupported game.")
    if mode not in GAME_RULES[game]["modes"]:
        raise ValueError("Unsupported game mode.")
    if duration_seconds not in GAME_RULES[game]["durations"]:
        raise ValueError("Unsupported session duration.")
    if not isinstance(correct, int) or not isinstance(total, int):
        raise ValueError("Correct and total answers must be integers.")
    if correct < 0 or total < 0 or correct > total:
        raise ValueError("Correct answers must be between zero and total answers.")

    started_at = payload.get("startedAt")
    if not isinstance(started_at, str) or len(started_at) > 80:
        raise ValueError("A valid session start time is required.")

    details = payload.get("details", {})
    if not isinstance(details, dict):
        raise ValueError("Details must be a JSON object.")
    sanitized_details = {
        key: value for key, value in details.items()
        if isinstance(key, str) and isinstance(value, int) and value >= 0
    }

    return {
        "id": str(uuid4()),
        "game": game,
        "mode": mode,
        "durationSeconds": duration_seconds,
        "correct": correct,
        "total": total,
        "accuracy": round((correct / total * 100) if total else 0, 1),
        "score": correct - (total - correct),
        "scorePerMinute": round((correct - (total - correct)) * 60 / duration_seconds, 1),
        "details": sanitized_details,
        "startedAt": started_at,
        "savedAt": datetime.now(UTC).isoformat(),
    }


# Atomically append a session so an interrupted write cannot corrupt history.
def save_performance(performance: dict[str, Any]) -> None:
    PERFORMANCES_FILE.parent.mkdir(parents=True, exist_ok=True)
    performances = load_performances()
    performances.insert(0, performance)
    performances = performances[:50]

    temporary_file = PERFORMANCES_FILE.with_suffix(".tmp")
    temporary_file.write_text(json.dumps(performances, indent=2) + "\n", encoding="utf-8")
    temporary_file.replace(PERFORMANCES_FILE)


class NeuroPracticeHandler(SimpleHTTPRequestHandler):
    """Serve NeuroPractice games plus a minimal local performance API."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(WEB_ROOT), **kwargs)

    # Send a JSON response with consistent UTF-8 headers.
    def send_json(self, status: HTTPStatus, payload: Any) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # Route history reads while delegating static files to the standard handler.
    def do_GET(self) -> None:
        parsed_url = urlparse(self.path)
        if parsed_url.path == "/api/performances":
            requested_game = parse_qs(parsed_url.query).get("game", [None])[0]
            performances = load_performances()
            if requested_game is not None:
                performances = [item for item in performances if item.get("game") == requested_game]
            self.send_json(HTTPStatus.OK, {"performances": performances})
            return
        super().do_GET()

    # Accept completed sessions from the local browser app.
    def do_POST(self) -> None:
        if urlparse(self.path).path != "/api/performances":
            self.send_error(HTTPStatus.NOT_FOUND, "Not found")
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            performance = validate_performance(payload)
            save_performance(performance)
        except (UnicodeDecodeError, ValueError, json.JSONDecodeError) as error:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
            return

        self.send_json(HTTPStatus.CREATED, {"performance": performance})

    # Keep terminal output concise during local play sessions.
    def log_message(self, format: str, *args: Any) -> None:
        print(f"[NeuroPractice] {format % args}")


# Start a threaded local server so browser requests never block the UI.
def run() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", 8000), NeuroPracticeHandler)
    print("NeuroPractice is running at http://127.0.0.1:8000")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nNeuroPractice stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    run()
