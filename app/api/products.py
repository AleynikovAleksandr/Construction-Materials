from __future__ import annotations

from app.api.photo_storage import PhotoStorage
from app.api.serializers import ProductSerializer
from app.core.permissions import has_permission
from app.db.models import Product
from app.db.session import get_session


class ProductService:
    """Product catalog read/write access. Write operations enforce EDIT_PRODUCTS."""

    def __init__(self, photo_storage: PhotoStorage | None = None):
        self._photo_storage = photo_storage or PhotoStorage()

    def get_all(self) -> list[dict]:
        """Full catalog is visible to every role, including guest — filtering/sorting/search
        is a UI-only capability gated client-side (CAN_FILTER_SORT_SEARCH in main.js)."""
        session = get_session()
        try:
            return [ProductSerializer.to_dict(p) for p in session.query(Product).all()]
        finally:
            session.close()

    def create(self, role: str, data: dict) -> dict:
        if not has_permission(role, "EDIT_PRODUCTS"):
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
                description=data.get("desc", "").strip(),
                photo_path=self._photo_storage.save(article, data.get("photo", "")),
            )
            session.add(product)
            session.commit()
            return {"ok": True}
        finally:
            session.close()

    def update(self, role: str, article: str, data: dict) -> dict:
        if not has_permission(role, "EDIT_PRODUCTS"):
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
            photo_path = self._photo_storage.save(product.article, data.get("photo", ""))
            if photo_path:
                product.photo_path = photo_path
            elif not data.get("photo"):
                product.photo_path = ""
            session.commit()
            return {"ok": True}
        finally:
            session.close()

    def delete(self, role: str, article: str) -> dict:
        if not has_permission(role, "EDIT_PRODUCTS"):
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
