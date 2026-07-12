from __future__ import annotations

import sys
from pathlib import Path

import webview

APP_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(APP_DIR.parent))

from app.api import Api  # noqa: E402
from app.core.render import STATIC_DIR, render_login  # noqa: E402
from app.core.static_server import ensure_static_server  # noqa: E402

APP_ICON_PATH = STATIC_DIR / "img" / "icon.ico"


def _on_ready(window: webview.Window, api: Api):
    api.set_window(window)
    window.load_html(render_login(), base_uri=ensure_static_server())


def main():
    # debug=True keeps "Inspect Element" available in the window's context menu,
    # but devtools should stay closed until the user opens them on purpose.
    webview.settings['OPEN_DEVTOOLS_IN_DEBUG'] = False

    api = Api()
    window = webview.create_window(
        "ООО «СтройМатериалы»",
        html="<html><body></body></html>",
        js_api=api,
        width=1280,
        height=860,
        min_size=(980, 640),
    )
    webview.start(_on_ready, (window, api), debug=True, icon=str(APP_ICON_PATH))


if __name__ == "__main__":
    main()
