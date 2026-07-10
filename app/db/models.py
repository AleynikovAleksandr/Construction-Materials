from __future__ import annotations

from datetime import date

from sqlalchemy import Date, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

ROLE_ADMIN = "admin"
ROLE_MANAGER = "manager"
ROLE_CLIENT = "client"
ROLES = (ROLE_ADMIN, ROLE_MANAGER, ROLE_CLIENT)

ROLE_LABELS = {
    ROLE_ADMIN: "Администратор",
    ROLE_MANAGER: "Менеджер",
    ROLE_CLIENT: "Авторизированный клиент",
}
# Обратный словарь для импорта из Excel ("Роль сотрудника" -> внутренний код роли).
ROLE_BY_LABEL = {v: k for k, v in ROLE_LABELS.items()}


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(255))
    login: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20))

    orders: Mapped[list["Order"]] = relationship(back_populates="client_user")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    article: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    unit: Mapped[str] = mapped_column(String(50), default="")
    price: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    supplier: Mapped[str] = mapped_column(String(255), default="")
    maker: Mapped[str] = mapped_column(String(255), default="")
    category: Mapped[str] = mapped_column(String(255), default="")
    discount: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    stock_qty: Mapped[int] = mapped_column(default=0)
    description: Mapped[str] = mapped_column(Text, default="")
    photo_path: Mapped[str] = mapped_column(String(255), default="")

    order_items: Mapped[list["OrderItem"]] = relationship(back_populates="product")


class PickupPoint(Base):
    __tablename__ = "pickup_points"

    id: Mapped[int] = mapped_column(primary_key=True)
    address: Mapped[str] = mapped_column(String(255))

    orders: Mapped[list["Order"]] = relationship(back_populates="pickup_point")


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_no: Mapped[int] = mapped_column(unique=True, index=True)
    order_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    delivery_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    pickup_point_id: Mapped[int | None] = mapped_column(ForeignKey("pickup_points.id"), nullable=True)
    client_fio: Mapped[str] = mapped_column(String(255), default="")
    client_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    pickup_code: Mapped[str] = mapped_column(String(20), default="")
    status: Mapped[str] = mapped_column(String(50), default="Новый")

    pickup_point: Mapped["PickupPoint | None"] = relationship(back_populates="orders")
    client_user: Mapped["User | None"] = relationship(back_populates="orders")
    items: Mapped[list["OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"))
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id"), nullable=True)
    article: Mapped[str] = mapped_column(String(50), default="")
    qty: Mapped[int] = mapped_column(default=0)

    order: Mapped["Order"] = relationship(back_populates="items")
    product: Mapped["Product | None"] = relationship(back_populates="order_items")
