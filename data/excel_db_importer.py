"""Импорт демо-данных из data/import/*.xlsx в базу SQLite.

Схема таблиц берётся из app/db/schema.sql (он же — источник истины для моделей
SQLAlchemy); скрипт только создаёт по ней базу и наполняет её строками из книг Excel.

Устройство (без наследования, всё собирается композицией):

* Strategy        — по классу на каждую книгу (ProductsStrategy, UsersStrategy,
                    PickupPointsStrategy, OrdersStrategy). Общего базового класса
                    у них нет: достаточно одинакового набора атрибутов и метода
                    build_rows(), исполнитель работает с любым таким объектом.
* Template Method — ImportRunner.run() задаёт неизменный порядок шагов
                    (прочитать книгу → построить записи → сохранить), а сами шаги
                    делегирует стратегии.
* Factory Method  — StrategyFactory.create_all() решает, какие стратегии нужны и
                    в каком порядке их применять.
* Facade          — ExcelDbImporter скрывает за одним методом run() создание схемы,
                    транзакцию, обход стратегий и вывод отчёта.

Запуск: python data/excel_db_importer.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import pandas as pd
from werkzeug.security import generate_password_hash

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.db.models import (  # noqa: E402
    Order,
    OrderItem,
    PickupPoint,
    Product,
    ROLE_BY_LABEL,
    User,
)
from app.db.session import DB_PATH, engine, get_session  # noqa: E402

IMPORT_DIR = BASE_DIR / "data" / "import"
SCHEMA_PATH = BASE_DIR / "app" / "db" / "schema.sql"


# --------------------------------------------------------------------- значения
class Value:
    """Приведение ячеек pandas к типам Python (пустая ячейка приходит как NaN)."""

    @staticmethod
    def text(cell) -> str:
        return "" if pd.isna(cell) else str(cell).strip()

    @staticmethod
    def number(cell) -> float:
        return 0.0 if pd.isna(cell) else float(cell)

    @staticmethod
    def integer(cell) -> int:
        return 0 if pd.isna(cell) else int(cell)

    @staticmethod
    def date(cell):
        """Даты pandas отдаёт как Timestamp; заведомо неверные (например,
        «30.02.2025») остаются строкой и превращаются в None."""
        return cell.date() if hasattr(cell, "date") else None


# ---------------------------------------------------------------------- чтение
class ExcelReader:
    """Читает книгу Excel в DataFrame."""

    def __init__(self, import_dir: Path = IMPORT_DIR):
        self._import_dir = import_dir

    def read(self, filename: str, has_header: bool = True) -> pd.DataFrame:
        path = self._import_dir / filename
        frame = pd.read_excel(path, header=0 if has_header else None)
        # Хвостовые пустые строки книги в DataFrame не нужны.
        return frame.dropna(how="all")


# ---------------------------------------------------------------------- схема
class SchemaCreator:
    """Пересоздаёт файл базы и применяет к нему SQL-схему."""

    def __init__(self, db_path: Path = DB_PATH, schema_path: Path = SCHEMA_PATH):
        self.db_path = db_path
        self.schema_path = schema_path

    def create(self) -> None:
        if self.db_path.exists():
            self.db_path.unlink()
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        raw = engine.raw_connection()
        try:
            raw.executescript(self.schema_path.read_text(encoding="utf-8"))
            raw.commit()
        finally:
            raw.close()


# ------------------------------------------------------------------ стратегии
class ProductsStrategy:
    filename = "products_import.xlsx"
    label = "Товары"
    has_header = True

    def build_rows(self, frame: pd.DataFrame, session) -> list:
        products = []
        for row in frame.itertuples(index=False, name=None):
            (article, name, unit, price, supplier, maker, category,
             discount, stock_qty, description, photo) = (list(row) + [None] * 11)[:11]

            if not Value.text(article):
                continue

            products.append(Product(
                article=Value.text(article),
                name=Value.text(name),
                unit=Value.text(unit),
                price=Value.number(price),
                supplier=Value.text(supplier),
                maker=Value.text(maker),
                category=Value.text(category),
                discount=Value.number(discount),
                stock_qty=Value.integer(stock_qty),
                description=Value.text(description),
                # Фотографии уже лежат в app/static/img/products/ — книга лишь
                # называет файл, копировать из data/import/ ничего не нужно.
                photo_path=Value.text(photo),
            ))
        return products


class UsersStrategy:
    filename = "users_import.xlsx"
    label = "Пользователи"
    has_header = True

    def build_rows(self, frame: pd.DataFrame, session) -> list:
        users = []
        for row in frame.itertuples(index=False, name=None):
            role_label, full_name, login, password = (list(row) + [None] * 4)[:4]

            role = ROLE_BY_LABEL.get(Value.text(role_label))
            if role is None:
                continue

            users.append(User(
                full_name=Value.text(full_name),
                login=Value.text(login),
                password_hash=generate_password_hash(Value.text(password)),
                role=role,
            ))
        return users


class PickupPointsStrategy:
    filename = "pickup_points_import.xlsx"
    label = "Пункты выдачи"
    # В этой книге нет строки заголовка — первая строка уже адрес.
    has_header = False

    def build_rows(self, frame: pd.DataFrame, session) -> list:
        addresses = [Value.text(row[0]) for row in frame.itertuples(index=False, name=None)]
        return [
            PickupPoint(id=index, address=address)
            for index, address in enumerate(filter(None, addresses), start=1)
        ]


class OrdersStrategy:
    filename = "orders_import.xlsx"
    label = "Заказы"
    has_header = True

    def build_rows(self, frame: pd.DataFrame, session) -> list:
        users_by_fio = {u.full_name: u for u in session.query(User).all()}
        products_by_article = {p.article: p for p in session.query(Product).all()}

        orders = []
        for row in frame.itertuples(index=False, name=None):
            (order_no, articles, order_date, delivery_date,
             address_no, fio, code, status) = (list(row) + [None] * 8)[:8]

            if pd.isna(order_no):
                continue

            client_fio = Value.text(fio)
            client = users_by_fio.get(client_fio)

            order = Order(
                order_no=Value.integer(order_no),
                order_date=Value.date(order_date),
                delivery_date=Value.date(delivery_date),
                pickup_point_id=Value.integer(address_no) or None,
                client_fio=client_fio,
                client_user_id=client.id if client else None,
                pickup_code=Value.text(code),
                status=Value.text(status),
            )
            order.items = self._build_items(articles, products_by_article)
            orders.append(order)
        return orders

    @staticmethod
    def _build_items(articles, products_by_article: dict) -> list:
        """Разбирает строку «АРТ1, 2, АРТ2, 5» на пары «артикул — количество»."""
        parts = [part.strip() for part in Value.text(articles).split(",") if part.strip()]

        items = []
        for index in range(0, len(parts) - 1, 2):
            article, quantity = parts[index], parts[index + 1]
            if not re.fullmatch(r"-?\d+", quantity):
                continue
            product = products_by_article.get(article)
            items.append(OrderItem(
                product_id=product.id if product else None,
                article=article,
                qty=int(quantity),
            ))
        return items


# -------------------------------------------------------------------- фабрика
class StrategyFactory:
    """Создаёт стратегии импорта в порядке зависимостей: заказы ссылаются на
    пользователей и товары, поэтому идут последними."""

    @staticmethod
    def create_all() -> list:
        return [
            ProductsStrategy(),
            UsersStrategy(),
            PickupPointsStrategy(),
            OrdersStrategy(),
        ]


# ------------------------------------------------------------------ исполнитель
class ImportRunner:
    """Шаблонный метод: порядок шагов фиксирован, содержание — за стратегией."""

    def __init__(self, reader: ExcelReader):
        self._reader = reader

    def run(self, strategy, session) -> int:
        frame = self._read(strategy)
        rows = self._build(strategy, frame, session)
        return self._persist(rows, session)

    def _read(self, strategy) -> pd.DataFrame:
        return self._reader.read(strategy.filename, strategy.has_header)

    @staticmethod
    def _build(strategy, frame: pd.DataFrame, session) -> list:
        return strategy.build_rows(frame, session)

    @staticmethod
    def _persist(rows: list, session) -> int:
        session.add_all(rows)
        session.flush()
        return len(rows)


# ---------------------------------------------------------------------- фасад
class ExcelDbImporter:
    """Единая точка входа: создаёт схему и наполняет базу всеми книгами."""

    def __init__(self, schema_creator: SchemaCreator | None = None, reader: ExcelReader | None = None):
        self._schema_creator = schema_creator or SchemaCreator()
        self._runner = ImportRunner(reader or ExcelReader())
        self._strategies = StrategyFactory.create_all()

    def run(self) -> dict[str, int]:
        self._schema_creator.create()

        session = get_session()
        try:
            counts = {s.label: self._runner.run(s, session) for s in self._strategies}
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

        self._report(counts)
        return counts

    def _report(self, counts: dict[str, int]) -> None:
        width = max(len(label) for label in counts) + 1
        for label, count in counts.items():
            print(f"{label + ':':<{width + 1}} {count}")
        print(f"Схема:{'':<{width - 5}} {self._schema_creator.schema_path}")
        print(f"БД создана:{'':<{max(width - 10, 0)}} {self._schema_creator.db_path}")


if __name__ == "__main__":
    ExcelDbImporter().run()
