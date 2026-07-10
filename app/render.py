from __future__ import annotations

import json
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

from app.db.models import ROLE_LABELS

APP_DIR = Path(__file__).resolve().parent
TEMPLATES_DIR = APP_DIR / "templates"
STATIC_DIR = APP_DIR / "static"
STATIC_BASE_URI = STATIC_DIR.as_uri() + "/"

_env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))


def render_login() -> str:
    return _env.get_template("login.html").render()


def render_dashboard(session_user: dict) -> str:
    role = session_user["role"]
    user_payload = {
        "role": role,
        "fio": session_user.get("fio") or "Гость",
        "roleLabel": "Гость" if role == "guest" else ROLE_LABELS.get(role, role),
    }
    user_json = json.dumps(user_payload, ensure_ascii=False).replace("</", "<\\/")
    return _env.get_template("dashboard.html").render(user_json=user_json)
