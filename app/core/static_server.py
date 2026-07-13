from __future__ import annotations

import functools
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from app.core.render import STATIC_DIR

_lock = threading.Lock()
_base_uri: str | None = None


def ensure_static_server() -> str:
    """Serve app/static/ over a local HTTP server and return its base URL.

    WKWebView (macOS) and some other WebView backends refuse to load relative
    <link href>/<script src> resources when the page is injected via
    load_html() with a file:// base_uri ('Cannot open file' in devtools),
    even though the HTML itself loads fine. Serving the same directory over
    plain HTTP sidesteps that restriction. Starts the server on first call
    and reuses it afterwards.

    Uses ThreadingHTTPServer, not the plain single-threaded HTTPServer: a page
    load fires off several parallel requests (css, multiple vendor JS files,
    images) over keep-alive connections. A single-threaded server can only
    service one connection at a time and stalls on the others until they time
    out, so on repeated navigations some assets randomly fail to load.
    """
    global _base_uri
    with _lock:
        if _base_uri is None:
            handler = functools.partial(SimpleHTTPRequestHandler, directory=str(STATIC_DIR))
            server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
            threading.Thread(target=server.serve_forever, daemon=True).start()
            _base_uri = f"http://127.0.0.1:{server.server_port}/"
        return _base_uri
