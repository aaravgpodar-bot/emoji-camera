import json
import os
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

try:
    from openai_helper import generate_mood_caption
except Exception:  # pragma: no cover - openai may be uninstalled in some setups
    generate_mood_caption = None


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("EMOJI_CAMERA_DATA_DIR", BASE_DIR / "data"))
DB_PATH = DATA_DIR / "emoji_camera.sqlite3"
LEARNABLE_KEYS = {"happy", "laughing", "surprised", "shocked", "sad", "angry", "neutral", "thinking", "sleepy", "cool"}
SIGNATURE_LENGTH = 7

app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path="")
DATA_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/mood-caption")
def mood_caption():
    """AI feature: turn the currently detected expression into a fun caption."""
    if generate_mood_caption is None:
        return jsonify({"error": "AI helper unavailable. Run: pip install -r requirements.txt"}), 503

    body = request.get_json(silent=True) or {}
    label = str(body.get("label", "")).strip()
    emoji = str(body.get("emoji", "")).strip()
    context = str(body.get("context", "")).strip()
    if not label:
        return jsonify({"error": "Missing detected expression label."}), 400
    if label not in LEARNABLE_KEYS:
        return jsonify({"error": "Unknown expression label."}), 400

    try:
        caption = generate_mood_caption(label, emoji=emoji, context=context)
    except Exception as error:  # surface a clean message to the UI
        return jsonify({"error": f"AI caption failed: {error}"}), 502

    if not caption:
        return jsonify({"error": "AI returned an empty caption."}), 502
    return jsonify({"caption": caption, "label": label})


@app.get("/api/learning")
def get_learning():
    with db() as connection:
        rows = connection.execute(
            """
            SELECT emoji_key, signature_json, confirmed, created_at
            FROM expression_learning
            ORDER BY id DESC
            LIMIT 200
            """
        ).fetchall()
    samples = [
        {
            "key": row[0],
            "signature": json.loads(row[1]),
            "confirmed": bool(row[2]),
            "time": row[3],
        }
        for row in rows
    ]
    return jsonify({"samples": samples})


@app.post("/api/learning")
def save_learning():
    body = request.get_json(silent=True) or {}
    key = str(body.get("key", "")).strip()
    signature = body.get("signature")
    confirmed = bool(body.get("confirmed", False))
    if key not in LEARNABLE_KEYS:
        return jsonify({"error": "Unknown emoji key."}), 400
    if not valid_signature(signature):
        return jsonify({"error": "Expression signature must be seven numbers."}), 400

    clean_signature = [round(float(value), 3) for value in signature]
    with db() as connection:
        connection.execute(
            """
            INSERT INTO expression_learning (emoji_key, signature_json, confirmed, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (key, json.dumps(clean_signature, separators=(",", ":")), 1 if confirmed else 0, int(time.time() * 1000)),
        )
        connection.execute(
            """
            DELETE FROM expression_learning
            WHERE id NOT IN (
              SELECT id FROM expression_learning ORDER BY id DESC LIMIT 200
            )
            """
        )
    return jsonify({"saved": True, "key": key})


def valid_signature(signature):
    if not isinstance(signature, list) or len(signature) != SIGNATURE_LENGTH:
        return False
    return all(isinstance(value, (int, float)) and 0 <= float(value) <= 1 for value in signature)


@contextmanager
def db():
    connection = sqlite3.connect(DB_PATH)
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def init_db():
    with sqlite3.connect(DB_PATH) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS expression_learning (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                emoji_key TEXT NOT NULL,
                signature_json TEXT NOT NULL,
                confirmed INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
            )
            """
        )


init_db()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5187))
    app.run(host="127.0.0.1", port=port, debug=True)
