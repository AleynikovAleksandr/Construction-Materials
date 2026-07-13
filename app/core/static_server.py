from __future__ import annotations

import functools
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from app.core.render import STATIC_DIR


class StaticFileServer:
    """Serves a local directory over HTTP so pywebview can load page resources
    from it, instead of a file:// base_uri.

    WKWebView (macOS) and some other WebView backends refuse to load relative
    <link href>/<script src> resources when the page is injected via
    load_html() with a file:// base_uri ('Cannot open file' in devtools),
    even though the HTML itself loads fine. Serving the same directory over
    plain HTTP sidesteps that restriction.

    Uses ThreadingHTTPServer, not the plain single-threaded HTTPServer: a page
    load fires off several parallel requests (css, multiple vendor JS files,
    images) over keep-alive connections. A single-threaded server can only
    service one connection at a time and stalls on the others until they time
    out, so on repeated navigations some assets would randomly fail to load.
    """

    def __init__(self, directory: Path, host: str = "127.0.0.1"):
        self._directory = directory
        self._host = host
        self._lock = threading.Lock()
        self._base_uri: str | None = None

    @property
    def base_uri(self) -> str:
        """Base URL of the running server, starting it on first access."""
        return self._ensure_started()

    def _ensure_started(self) -> str:
        with self._lock:
            if self._base_uri is None:
                handler = functools.partial(SimpleHTTPRequestHandler, directory=str(self._directory))
                server = ThreadingHTTPServer((self._host, 0), handler)
                threading.Thread(target=server.serve_forever, daemon=True).start()
                self._base_uri = f"http://{self._host}:{server.server_port}/"
            return self._base_uri


_static_server = StaticFileServer(STATIC_DIR)


def ensure_static_server() -> str:
    """Start (if needed) and return the base URL of the shared static file server."""
    return _static_server.base_uri
