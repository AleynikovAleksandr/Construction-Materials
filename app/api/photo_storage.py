from __future__ import annotations

import base64
import mimetypes
import uuid
from pathlib import Path

from app.core.render import STATIC_DIR

DEFAULT_PRODUCTS_IMG_DIR = STATIC_DIR / "img" / "products"


class PhotoStorage:
    def __init__(self, target_dir: Path = DEFAULT_PRODUCTS_IMG_DIR):
        self._target_dir = target_dir

    def save(self, article: str, photo_value: str) -> str:
        if not photo_value:
            return ""
        if photo_value.startswith("img/products/"):
            return photo_value.rsplit("/", 1)[-1]
        if photo_value.startswith("data:"):
            header, b64data = photo_value.split(",", 1)
            mime = header.split(";")[0].replace("data:", "")
            ext = mimetypes.guess_extension(mime) or ".jpg"
            filename = f"{article}_{uuid.uuid4().hex[:8]}{ext}"
            self._target_dir.mkdir(parents=True, exist_ok=True)
            (self._target_dir / filename).write_bytes(base64.b64decode(b64data))
            return filename
        return ""
