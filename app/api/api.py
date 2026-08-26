from __future__ import annotations

from app.api.auth import AuthService
from app.api.orders import OrderService
from app.api.products import ProductService
from app.api.session import SessionService


class Api:
    def __init__(self):
        self._session = SessionService(AuthService())
        self._products = ProductService()
        self._orders = OrderService()

    def set_window(self, window) -> None:
        self._session.bind_window(window)

    @property
    def session_user(self) -> dict | None:
        return self._session.user


    def login(self, login: str, password: str) -> dict:
        return self._session.login(login, password)

    def enter_guest(self) -> dict:
        return self._session.enter_guest()

    def logout(self) -> dict:
        return self._session.logout()


    def get_products(self) -> list[dict]:
        return self._products.get_all()

    def create_product(self, data: dict) -> dict:
        return self._products.create(self._session.role, data)

    def update_product(self, article: str, data: dict) -> dict:
        return self._products.update(self._session.role, article, data)

    def delete_product(self, article: str) -> dict:
        return self._products.delete(self._session.role, article)


    def get_orders(self) -> list[dict]:
        return self._orders.get_all(self._session.role)

    def create_order(self, data: dict) -> dict:
        return self._orders.create(self._session.role, data)

    def update_order(self, order_no: int, data: dict) -> dict:
        return self._orders.update(self._session.role, order_no, data)

    def delete_order(self, order_no: int) -> dict:
        return self._orders.delete(self._session.role, order_no)
