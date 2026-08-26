from __future__ import annotations

import sys
from pathlib import Path

import webview

APP_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(APP_DIR.parent))

from app.api import Api  
from app.core.render import STATIC_DIR, render_login  
from app.core.static_server import ensure_static_server  

APP_ICON_PATH = STATIC_DIR / "img" / "icon.ico"


class Application:
    WINDOW_TITLE = "ООО «СтройМатериалы»"
    WINDOW_SIZE = (1280, 860)
    WINDOW_MIN_SIZE = (980, 640)

    def __init__(self):
        self._api = Api()
        self._window: webview.Window | None = None

    def run(self) -> None:
        self._configure_devtools()
        self._window = self._create_window()
        webview.start(self._on_ready, debug=True, icon=str(APP_ICON_PATH))

    def _configure_devtools(self) -> None:
        webview.settings['OPEN_DEVTOOLS_IN_DEBUG'] = False

    def _create_window(self) -> webview.Window:
        width, height = self.WINDOW_SIZE
        return webview.create_window(
            self.WINDOW_TITLE,
            html="<html><body></body></html>",
            js_api=self._api,
            width=width,
            height=height,
            min_size=self.WINDOW_MIN_SIZE,
        )

    def _on_ready(self) -> None:
        self._api.set_window(self._window)
        self._window.load_html(render_login(), base_uri=ensure_static_server())


if __name__ == "__main__":
    Application().run()
