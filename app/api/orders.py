from __future__ import annotations

from datetime import datetime

from app.api.serializers import OrderSerializer
from app.core.permissions import has_permission
from app.db.models import Order, OrderItem, Product
from app.db.session import get_session


def _parse_iso_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


class OrderService:
    """Order read/write access. Viewing requires VIEW_ORDERS, writing requires EDIT_ORDERS."""

    def get_all(self, role: str) -> list[dict]:
        """Orders are staff-only data — unlike the product catalog, guest/client get nothing."""
        if not has_permission(role, "VIEW_ORDERS"):
            return []
        session = get_session()
        try:
            orders = session.query(Order).order_by(Order.order_no).all()
            return [OrderSerializer.to_dict(o) for o in orders]
        finally:
            session.close()

    def create(self, role: str, data: dict) -> dict:
        if not has_permission(role, "EDIT_ORDERS"):
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

    def update(self, role: str, order_no: int, data: dict) -> dict:
        if not has_permission(role, "EDIT_ORDERS"):
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

    def delete(self, role: str, order_no: int) -> dict:
        if not has_permission(role, "EDIT_ORDERS"):
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
    def _apply_items(session, order: Order, arts_text: str) -> None:
        order.items.clear()
        parts = [p.strip() for p in (arts_text or "").split(",") if p.strip()]
        products_by_article = {p.article: p for p in session.query(Product).all()}
        for i in range(0, len(parts) - 1, 2):
            article, qty = parts[i], parts[i + 1]
            if not qty.lstrip("-").isdigit():
                continue
            product = products_by_article.get(article)
            order.items.append(OrderItem(product_id=product.id if product else None, article=article, qty=int(qty)))
