from __future__ import annotations

from app.db.models import Order, Product


def ru_date(value) -> str:
    return value.strftime("%d.%m.%Y") if value else ""


class ProductSerializer:
    @staticmethod
    def to_dict(product: Product) -> dict:
        return {
            "art": product.article, "name": product.name, "cat": product.category, "maker": product.maker,
            "price": float(product.price), "disc": float(product.discount), "stock": product.stock_qty,
            "desc": product.description,
            "photo": f"img/products/{product.photo_path}" if product.photo_path else "",
        }


class OrderSerializer:
    @staticmethod
    def to_dict(order: Order) -> dict:
        arts = ", ".join(f"{item.article}, {item.qty}" for item in order.items)
        return {
            "num": order.order_no, "arts": arts, "date": ru_date(order.order_date),
            "delivery": ru_date(order.delivery_date), "address": order.pickup_point_id or "",
            "fio": order.client_fio, "code": order.pickup_code, "status": order.status,
        }
