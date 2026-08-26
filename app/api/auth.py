from __future__ import annotations

from werkzeug.security import check_password_hash

from app.db.models import User
from app.db.session import get_session


class AuthService:
    def authenticate(self, login: str, password: str) -> dict | None:
        session = get_session()
        try:
            user = session.query(User).filter(User.login == login).first()
            if not user or not check_password_hash(user.password_hash, password):
                return None
            return {"id": user.id, "role": user.role, "fio": user.full_name}
        finally:
            session.close()
