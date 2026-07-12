from __future__ import annotations

import base64
import mimetypes
import uuid
from datetime import datetime

from app.auth import authenticate
from app.db.models import Order, OrderItem, Product
from app.db.session import get_session
from app.permissions import has_permission
from app.render import STATIC_BASE_URI, STATIC_DIR, render_dashboard, render_login

PRODUCTS_IMG_DIR = STATIC_DIR / "img" / "products"


def _ru_date(value) -> str:
    return value.strftime("%d.%m.%Y") if value else ""


def _parse_iso_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def _product_to_dict(p: Product) -> dict:
    return {
        "art": p.article, "name": p.name, "cat": p.category, "maker": p.maker,
        "price": float(p.price), "disc": float(p.discount), "stock": p.stock_qty,
        "desc": p.description, "photo": f"img/products/{p.photo_path}" if p.photo_path else "",
    }


def _order_to_dict(o: Order) -> dict:
    arts = ", ".join(f"{i.article}, {i.qty}" for i in o.items)
    return {
        "num": o.order_no, "arts": arts, "date": _ru_date(o.order_date), "delivery": _ru_date(o.delivery_date),
        "address": o.pickup_point_id or "", "fio": o.client_fio, "code": o.pickup_code, "status": o.status,
    }


def _save_photo(article: str, photo_value: str) -> str:
    """Accepts either a data: URL (new upload) or an existing 'img/products/xxx' path. Returns stored filename."""
    if not photo_value:
        return ""
    if photo_value.startswith("img/products/"):
        return photo_value.rsplit("/", 1)[-1]
    if photo_value.startswith("data:"):
        header, b64data = photo_value.split(",", 1)
        mime = header.split(";")[0].replace("data:", "")
        ext = mimetypes.guess_extension(mime) or ".jpg"
        filename = f"{article}_{uuid.uuid4().hex[:8]}{ext}"
        PRODUCTS_IMG_DIR.mkdir(parents=True, exist_ok=True)
        (PRODUCTS_IMG_DIR / filename).write_bytes(base64.b64decode(b64data))
        return filename
    return ""


class Api:
    def __init__(self):
        self.window = None
        self.session_user: dict | None = None

    def set_window(self, window):
        self.window = window

    # ---------------------------------------------------------------- auth
    def login(self, login: str, password: str) -> dict:
        user = authenticate(login, password)
        if not user:
            return {"ok": False, "error": "Неверный логин или пароль"}
        self.session_user = user
        self._navigate(render_dashboard(self.session_user))
        return {"ok": True}

    def enter_guest(self) -> dict:
        self.session_user = {"id": None, "role": "guest", "fio": "Гость"}
        self._navigate(render_dashboard(self.session_user))
        return {"ok": True}

    def logout(self) -> dict:
        self.session_user = None
        self._navigate(render_login())
        return {"ok": True}

    def _navigate(self, html: str):
        if self.window:
            self.window.load_html(html, base_uri=STATIC_BASE_URI)

    def _role(self) -> str:
        return (self.session_user or {}).get("role", "guest")

    # ------------------------------------------------------------ products
    def get_products(self) -> list[dict]:
        """Full catalog is visible to every role, including guest — filtering/sorting/search
        is a UI-only capability gated client-side (CAN_FILTER_SORT_SEARCH in main.js)."""
        session = get_session()
        try:
            return [_product_to_dict(p) for p in session.query(Product).all()]
        finally:
            session.close()

    def create_product(self, data: dict) -> dict:
        if not has_permission(self._role(), "EDIT_PRODUCTS"):
            return {"ok": False, "error": "Недостаточно прав"}
        session = get_session()
        try:
            article = (data.get("art") or "").strip()
            if not article:
                return {"ok": False, "error": "Укажите артикул"}
            if session.query(Product).filter(Product.article == article).first():
                return {"ok": False, "error": "Товар с таким артикулом уже существует"}
            product = Product(
                article=article, name=data.get("name", "").strip(), category=data.get("cat", "").strip(),
                maker=data.get("maker", "").strip(), price=float(data.get("price") or 0),
                discount=float(data.get("disc") or 0), stock_qty=int(data.get("stock") or 0),
                description=data.get("desc", "").strip(), photo_path=_save_photo(article, data.get("photo", "")),
            )
            session.add(product)
            session.commit()
            return {"ok": True}
        finally:
            session.close()

    def update_product(self, article: str, data: dict) -> dict:
        if not has_permission(self._role(), "EDIT_PRODUCTS"):
            return {"ok": False, "error": "Недостаточно прав"}
        session = get_session()
        try:
            product = session.query(Product).filter(Product.article == article).first()
            if not product:
                return {"ok": False, "error": "Товар не найден"}
            new_article = (data.get("art") or "").strip()
            if new_article != article and session.query(Product).filter(Product.article == new_article).first():
                return {"ok": False, "error": "Товар с таким артикулом уже существует"}
            product.article = new_article or article
            product.name = data.get("name", "").strip()
            product.category = data.get("cat", "").strip()
            product.maker = data.get("maker", "").strip()
            product.price = float(data.get("price") or 0)
            product.discount = float(data.get("disc") or 0)
            product.stock_qty = int(data.get("stock") or 0)
            product.description = data.get("desc", "").strip()
            photo_path = _save_photo(product.article, data.get("photo", ""))
            if photo_path:
                product.photo_path = photo_path
            elif not data.get("photo"):
                product.photo_path = ""
            session.commit()
            return {"ok": True}
        finally:
            session.close()

    def delete_product(self, article: str) -> dict:
        if not has_permission(self._role(), "EDIT_PRODUCTS"):
            return {"ok": False, "error": "Недостаточно прав"}
        session = get_session()
        try:
            product = session.query(Product).filter(Product.article == article).first()
            if product:
                session.delete(product)
                session.commit()
            return {"ok": True}
        finally:
            session.close()

    # -------------------------------------------------------------- orders
    def get_orders(self) -> list[dict]:
        """Orders are staff-only data — unlike the product catalog, guest/client get nothing."""
        if not has_permission(self._role(), "VIEW_ORDERS"):
            return []
        session = get_session()
        try:
            orders = session.query(Order).order_by(Order.order_no).all()
            return [_order_to_dict(o) for o in orders]
        finally:
            session.close()

    def create_order(self, data: dict) -> dict:
        if not has_permission(self._role(), "EDIT_ORDERS"):
            return {"ok": False, "error": "Недостаточно прав"}
        session = get_session()
        try:
            next_no = (session.query(Order).count() and
                       (max(o.order_no for o in session.query(Order).all()) + 1)) or 1
            order = Order(
                order_no=next_no, order_date=_parse_iso_date(data.get("date")),
                delivery_date=_parse_iso_date(data.get("delivery")),
                pickup_point_id=int(data["address"]) if data.get("address") else None,
                client_fio=(data.get("fio") or "").strip(), pickup_code=(data.get("code") or "").strip(),
                status=data.get("status") or "Новый",
            )
            self._apply_items(session, order, data.get("arts", ""))
            session.add(order)
            session.commit()
            return {"ok": True}
        finally:
            session.close()

    def update_order(self, order_no: int, data: dict) -> dict:
        if not has_permission(self._role(), "EDIT_ORDERS"):
            return {"ok": False, "error": "Недостаточно прав"}
        session = get_session()
        try:
            order = session.query(Order).filter(Order.order_no == int(order_no)).first()
            if not order:
                return {"ok": False, "error": "Заказ не найден"}
            order.order_date = _parse_iso_date(data.get("date"))
            order.delivery_date = _parse_iso_date(data.get("delivery"))
            order.pickup_point_id = int(data["address"]) if data.get("address") else None
            order.client_fio = (data.get("fio") or "").strip()
            order.pickup_code = (data.get("code") or "").strip()
            order.status = data.get("status") or order.status
            self._apply_items(session, order, data.get("arts", ""))
            session.commit()
            return {"ok": True}
        finally:
            session.close()

    def delete_order(self, order_no: int) -> dict:
        if not has_permission(self._role(), "EDIT_ORDERS"):
            return {"ok": False, "error": "Недостаточно прав"}
        session = get_session()
        try:
            order = session.query(Order).filter(Order.order_no == int(order_no)).first()
            if order:
                session.delete(order)
                session.commit()
            return {"ok": True}
        finally:
            session.close()

    @staticmethod
    def _apply_items(session, order: Order, arts_text: str):
        order.items.clear()
        parts = [p.strip() for p in (arts_text or "").split(",") if p.strip()]
        products_by_article = {p.article: p for p in session.query(Product).all()}
        for i in range(0, len(parts) - 1, 2):
            article, qty = parts[i], parts[i + 1]
            if not qty.lstrip("-").isdigit():
                continue
            product = products_by_article.get(article)
            order.items.append(OrderItem(product_id=product.id if product else None, article=article, qty=int(qty)))
