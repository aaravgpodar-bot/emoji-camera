import mimetypes
from pathlib import Path


PROJECT_DIR = Path.home() / "emoji-camera"
if not PROJECT_DIR.exists():
    PROJECT_DIR = Path(__file__).resolve().parent


def application(environ, start_response):
    path = environ.get("PATH_INFO", "/").lstrip("/") or "index.html"
    requested = (PROJECT_DIR / path).resolve()

    if not str(requested).startswith(str(PROJECT_DIR.resolve())):
        start_response("403 Forbidden", [("Content-Type", "text/plain; charset=utf-8")])
        return [b"Forbidden"]

    if requested.is_dir():
        requested = requested / "index.html"

    if not requested.exists():
        start_response("404 Not Found", [("Content-Type", "text/plain; charset=utf-8")])
        return [b"Not found"]

    content_type = mimetypes.guess_type(str(requested))[0] or "application/octet-stream"
    start_response("200 OK", [("Content-Type", content_type)])
    return [requested.read_bytes()]
