from __future__ import annotations

import sys
import traceback
from pathlib import Path

import webview

APP_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(APP_DIR.parent))

from app.api import Api  # noqa: E402
from app.core.render import STATIC_BASE_URI, render_login  # noqa: E402

ERROR_PAGE = """<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Ошибка запуска</title></head>
<body style="font-family: monospace; padding: 24px; white-space: pre-wrap; background: #1c1c1e; color: #ff6b6b;">
<h2 style="color: #fff;">Не удалось загрузить приложение</h2>
{traceback}
</body></html>"""


def _on_ready(window: webview.Window, api: Api):
    api.set_window(window)
    try:
        window.load_html(render_login(), base_uri=STATIC_BASE_URI)
    except Exception:
        tb = traceback.format_exc()
        print(tb, file=sys.stderr)
        window.load_html(ERROR_PAGE.format(traceback=tb))


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
    webview.start(_on_ready, (window, api), debug=True)


if __name__ == "__main__":
    main()
