from __future__ import annotations

import functools
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from app.core.render import STATIC_DIR


class StaticFileServer:
    def __init__(self, directory: Path, host: str = "127.0.0.1"):
        self._directory = directory
        self._host = host
        self._lock = threading.Lock()
        self._base_uri: str | None = None

    @property
    def base_uri(self) -> str:
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
    return _static_server.base_uri
