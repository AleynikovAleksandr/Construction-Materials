"""Import demo data from data/import/*.xlsx into the SQLite database.

The database schema itself comes from app/db/schema.sql (kept in sync with the
SQLAlchemy models); this script only creates the database from that schema and
fills it with the workbook rows.

Structure: every workbook is handled by its own Importer subclass sharing the
Importer interface, and ExcelToDbImporter runs them in dependency order.

Usage: python data/import_excel_to_db.py
"""
from __future__ import annotations

import re
import sys
from abc import ABC, abstractmethod
from pathlib import Path

import openpyxl
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


class WorkbookReader:
    """Reads the first worksheet of an .xlsx file as plain row tuples."""

    def __init__(self, path: Path):
        self.path = path

    def rows(self, skip_header: bool = True) -> list[tuple]:
        worksheet = openpyxl.load_workbook(self.path, data_only=True).active
        rows = list(worksheet.iter_rows(values_only=True))
        return rows[1:] if skip_header else rows


class SchemaCreator:
    """Recreates the database file and applies the SQL schema to it."""

    def __init__(self, db_path: Path, schema_path: Path):
        self._db_path = db_path
        self._schema_path = schema_path

    def create(self) -> None:
        if self._db_path.exists():
            self._db_path.unlink()
        self._db_path.parent.mkdir(parents=True, exist_ok=True)

        raw = engine.raw_connection()
        try:
            raw.executescript(self._schema_path.read_text(encoding="utf-8"))
            raw.commit()
        finally:
            raw.close()


class Importer(ABC):
    """Interface for importing one workbook into the database.

    Subclasses declare which file they read (`filename`), what they are called
    in the summary (`label`), and how a row becomes database rows (`_import`).
    """

    filename: str
    label: str
    skip_header: bool = True

    def __init__(self, import_dir: Path = IMPORT_DIR):
        self._reader = WorkbookReader(import_dir / self.filename)

    def run(self, session) -> int:
        """Import the workbook and return how many records were added."""
        count = self._import(session, self._reader.rows(skip_header=self.skip_header))
        session.flush()
        return count

    @abstractmethod
    def _import(self, session, rows: list[tuple]) -> int:
        """Add rows to the session and return the number of records imported."""


class ProductImporter(Importer):
    filename = "products_import.xlsx"
    label = "Товары"

    def _import(self, session, rows: list[tuple]) -> int:
        count = 0
        for row in rows:
            if not row or not row[0]:
                continue
            (article, name, unit, price, supplier, maker, category,
             discount, stock_qty, description, photo) = (list(row) + [None] * 11)[:11]

            session.add(Product(
                article=str(article).strip(),
                name=(name or "").strip(),
                unit=(unit or "").strip(),
                price=float(price or 0),
                supplier=(supplier or "").strip(),
                maker=(maker or "").strip(),
                category=(category or "").strip(),
                discount=float(discount or 0),
                stock_qty=int(stock_qty or 0),
                description=(description or "").strip(),
                # Photos already live in app/static/img/products/ - the workbook
                # only names the file, it is not copied from data/import/.
                photo_path=str(photo).strip() if photo else "",
            ))
            count += 1
        return count


class UserImporter(Importer):
    filename = "users_import.xlsx"
    label = "Пользователи"

    def _import(self, session, rows: list[tuple]) -> int:
        count = 0
        for row in rows:
            if not row or not row[0]:
                continue
            role_label, full_name, login, password = row[:4]
            role = ROLE_BY_LABEL.get((role_label or "").strip())
            if role is None:
                continue
            session.add(User(
                full_name=(full_name or "").strip(),
                login=(login or "").strip(),
                password_hash=generate_password_hash(str(password).strip()),
                role=role,
            ))
            count += 1
        return count


class PickupPointImporter(Importer):
    filename = "pickup_points_import.xlsx"
    label = "Пункты выдачи"
    # This workbook has no header row - the first row is already an address.
    skip_header = False

    def _import(self, session, rows: list[tuple]) -> int:
        addresses = [row[0] for row in rows if row and row[0]]
        for idx, address in enumerate(addresses, start=1):
            session.add(PickupPoint(id=idx, address=str(address).strip()))
        return len(addresses)


class OrderImporter(Importer):
    filename = "orders_import.xlsx"
    label = "Заказы"

    def _import(self, session, rows: list[tuple]) -> int:
        users_by_fio = {u.full_name: u for u in session.query(User).all()}
        products_by_article = {p.article: p for p in session.query(Product).all()}

        count = 0
        for row in rows:
            if not row or row[0] is None:
                continue
            order_no, arts, order_date, delivery_date, address_no, fio, code, status = row[:8]
            fio = (fio or "").strip()

            order = Order(
                order_no=int(order_no),
                order_date=order_date.date() if hasattr(order_date, "date") else None,
                delivery_date=delivery_date.date() if hasattr(delivery_date, "date") else None,
                pickup_point_id=int(address_no) if address_no else None,
                client_fio=fio,
                client_user_id=users_by_fio[fio].id if fio in users_by_fio else None,
                pickup_code=str(code or "").strip(),
                status=(status or "").strip(),
            )
            session.add(order)
            session.flush()

            self._add_items(session, order, arts, products_by_article)
            count += 1
        return count

    @staticmethod
    def _add_items(session, order: Order, arts, products_by_article: dict) -> None:
        """Parse "ART1, 2, ART2, 5" into (article, quantity) pairs."""
        parts = [p.strip() for p in str(arts or "").split(",") if p.strip()]
        for i in range(0, len(parts) - 1, 2):
            article, qty = parts[i], parts[i + 1]
            if not re.match(r"^-?\d+$", qty):
                continue
            product = products_by_article.get(article)
            session.add(OrderItem(
                order_id=order.id,
                product_id=product.id if product else None,
                article=article,
                qty=int(qty),
            ))


class ExcelToDbImporter:
    """Creates the database from the SQL schema and runs every importer.

    Importer order matters: orders reference users and products, so those are
    imported first.
    """

    IMPORTERS = (ProductImporter, UserImporter, PickupPointImporter, OrderImporter)

    def __init__(self, db_path: Path = DB_PATH, schema_path: Path = SCHEMA_PATH):
        self._db_path = db_path
        self._schema_path = schema_path
        self._schema_creator = SchemaCreator(db_path, schema_path)
        self._importers = [importer_cls() for importer_cls in self.IMPORTERS]

    def run(self) -> None:
        self._schema_creator.create()

        session = get_session()
        try:
            results = [(importer.label, importer.run(session)) for importer in self._importers]
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

        self._report(results)

    def _report(self, results: list[tuple[str, int]]) -> None:
        width = max(len(label) for label, _ in results) + 1
        for label, count in results:
            print(f"{label + ':':<{width + 1}} {count}")
        print(f"Схема:{'':<{width - 5}} {self._schema_path}")
        print(f"БД создана:{'':<{max(width - 10, 0)}} {self._db_path}")


if __name__ == "__main__":
    ExcelToDbImporter().run()
