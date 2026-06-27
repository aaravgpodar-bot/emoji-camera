# Emoji Camera

A shareable browser app that opens the camera, detects the main face/expression, places an emoji over the face, keeps a recognized emoji history, and captures PNG screenshots.

Live demo:

```text
https://emojicam.pythonanywhere.com
```

## Current Features

- Start and stop the camera.
- Emoji overlay follows the detected face.
- Manual emoji buttons for reliable demos.
- Copyable emoji message composer.
- Recognized emoji history with per-emoji copy buttons.
- PNG screenshot capture.
- Parent presentation in `presentation/emoji-camera-parent-presentation.pptx`.

## AI feature

An **✨ AI Mood Caption** button (in the side panel, under "Current") sends the
*currently detected expression label* (e.g. `happy`, `surprised`) plus the
matching emoji to OpenAI's `gpt-5.4-nano` and shows a short, fun, shareable
one-line caption for your mood. No image ever leaves your machine — only the
expression label is sent.

The OpenAI key stays server-side: the same little Flask app (`server.py`) both
serves `index.html` and exposes a `POST /api/mood-caption` endpoint, so the
whole thing runs at **one** local URL.

Run it:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# Create a .env file (already gitignored) with:
#   OPENAI_API_KEY=sk-...your-key...
#   OPENAI_MODEL=gpt-5.4-nano
#   PORT=5187
python server.py
```

Then open:

```text
http://127.0.0.1:5187
```

Start the camera (or tap a manual emoji), then press **✨ AI Mood Caption**.

## Run Locally

Double-click `start-emoji-camera.bat`, then open:

```text
http://localhost:8095
```

Camera access works on `localhost`. For phones or other computers, use an HTTPS public tunnel.

## Share It

Send the `emoji-camera-share.zip` file. The receiver can unzip it and run `start-emoji-camera.bat`.

The app uses CDN-hosted `face-api.js` models, so it needs an internet connection for expression detection. Manual emoji test buttons still work if the detector cannot load.

## Deploy To PythonAnywhere

1. Upload and unzip `emoji-camera-pythonanywhere.zip` into your PythonAnywhere home folder so the files are in:

```text
/home/YOUR_USERNAME/emoji-camera
```

2. In a PythonAnywhere Bash console:

```bash
cd ~/emoji-camera
python3.10 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

3. In the PythonAnywhere Web tab:

- Create a new manual web app.
- Choose Python 3.10 or newer.
- Set the virtualenv path to `/home/YOUR_USERNAME/emoji-camera/.venv`.
- Edit the WSGI file and replace its contents with the contents of `pythonanywhere_wsgi.py`.
- Reload the web app.

Your site will be available at:

```text
https://YOUR_USERNAME.pythonanywhere.com
```

Camera access should work there because PythonAnywhere serves the app over HTTPS.
