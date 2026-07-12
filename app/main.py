from __future__ import annotations

import sys
from pathlib import Path

import webview

APP_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(APP_DIR.parent))

from app.api import Api  # noqa: E402
from app.core.render import STATIC_BASE_URI, render_login  # noqa: E402


def _on_ready(window: webview.Window, api: Api):
    api.set_window(window)
    window.load_html(render_login(), base_uri=STATIC_BASE_URI)


def main():
    api = Api()
    window = webview.create_window(
        "ООО «СтройМатериалы»",
        html="<html><body></body></html>",
        js_api=api,
        width=1280,
        height=860,
        min_size=(980, 640),
    )
    webview.start(_on_ready, (window, api))


if __name__ == "__main__":
    main()
