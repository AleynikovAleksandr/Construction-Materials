from __future__ import annotations

from app.api.auth import AuthService
from app.core.render import STATIC_BASE_URI, render_dashboard, render_login

GUEST_USER = {"id": None, "role": "guest", "fio": "Гость"}


class SessionService:
    """Owns the single logged-in session (who is the current user) and drives
    window navigation between the login screen and the role dashboard."""

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
        if self._window:
            self._window.load_html(html, base_uri=STATIC_BASE_URI)
