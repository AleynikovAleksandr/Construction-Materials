from __future__ import annotations

import threading

from app.api.auth import AuthService
from app.core.render import render_dashboard, render_login
from app.core.static_server import ensure_static_server


NAVIGATE_DELAY_SECONDS = 0.1

GUEST_USER = {"id": None, "role": "guest", "fio": "Гость"}


class SessionService:
    def __init__(self, auth_service: AuthService):
        self._auth_service = auth_service
        self._window = None
        self._user: dict | None = None

    def bind_window(self, window) -> None:
        self._window = window

    @property
    def user(self) -> dict | None:
        return self._user

    @property
    def role(self) -> str:
        return (self._user or {}).get("role", "guest")

    def login(self, login: str, password: str) -> dict:
        user = self._auth_service.authenticate(login, password)
        if not user:
            return {"ok": False, "error": "Неверный логин или пароль"}
        self._user = user
        self._navigate(render_dashboard(self._user))
        return {"ok": True}

    def enter_guest(self) -> dict:
        self._user = dict(GUEST_USER)
        self._navigate(render_dashboard(self._user))
        return {"ok": True}

    def logout(self) -> dict:
        self._user = None
        self._navigate(render_login())
        return {"ok": True}

    def _navigate(self, html: str) -> None:
        if not self._window:
            return
        timer = threading.Timer(
            NAVIGATE_DELAY_SECONDS, self._window.load_html, args=(html,), kwargs={"base_uri": ensure_static_server()}
        )
        timer.daemon = True
        timer.start()
