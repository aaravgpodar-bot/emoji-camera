"""Tiny server-side OpenAI helper for the Emoji Camera AI Mood Caption feature.

Keeps the API key on the server (loaded from a local .env) and turns a detected
expression label into a short, fun, shareable one-line caption using
OpenAI's gpt-5.4-nano model via the Responses API.
"""

import os
from pathlib import Path

from openai import OpenAI

BASE_DIR = Path(__file__).resolve().parent


def _load_dotenv():
    """Minimal .env loader so we don't add an extra dependency."""
    env_path = BASE_DIR / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_dotenv()

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-5.4-nano")

SYSTEM_PROMPT = (
    "You are the playful voice of an Emoji Camera app. "
    "The user pointed a webcam at their face and the app detected one main "
    "facial expression. Given that expression label, write ONE short, witty, "
    "shareable caption (max ~12 words) that someone could post under a selfie. "
    "Keep it friendly and fun. You may include exactly one fitting emoji. "
    "Return only the caption text, no quotes, no extra lines."
)


def _client():
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not set. Add it to a local .env file.")
    return OpenAI(api_key=OPENAI_API_KEY, timeout=30)


def generate_mood_caption(expression_label: str, emoji: str = "", context: str = "") -> str:
    """Return a short AI caption for the given detected expression label."""
    label = (expression_label or "neutral").strip().lower()

    user_parts = [f"Detected expression: {label}."]
    if emoji:
        user_parts.append(f"Matching emoji shown over the face: {emoji}.")
    if context:
        user_parts.append(f"Extra context: {context.strip()}.")
    user_parts.append("Write the caption now.")
    user_message = " ".join(user_parts)

    client = _client()
    response = client.responses.create(
        model=OPENAI_MODEL,
        input=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        reasoning={"effort": "low"},
        text={"verbosity": "low"},
        max_output_tokens=600,
    )
    caption = (response.output_text or "").strip()
    # Strip wrapping quotes if the model added them anyway.
    if len(caption) >= 2 and caption[0] in "\"'" and caption[-1] in "\"'":
        caption = caption[1:-1].strip()
    return caption
