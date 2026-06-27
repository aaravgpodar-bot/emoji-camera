import os
import sys
from pathlib import Path


PROJECT_DIR = Path.home() / "emoji-camera"
if not PROJECT_DIR.exists():
    PROJECT_DIR = Path(__file__).resolve().parent

if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

os.environ.setdefault("EMOJI_CAMERA_DATA_DIR", str(Path.home() / "emoji_camera_data"))

from server import app as application  # noqa: E402
