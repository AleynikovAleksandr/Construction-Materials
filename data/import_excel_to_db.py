"""Import demo data from data/import/*.xlsx into the SQLite database.

The database schema itself comes from app/db/schema.sql (kept in sync with the
SQLAlchemy models); this script only creates the database from that schema and
fills it with the workbook rows.

Usage: python data/import_excel_to_db.py
"""
from __future__ import annotations

import re
import sys
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

PRODUCTS_XLSX = IMPORT_DIR / "products_import.xlsx"
USERS_XLSX = IMPORT_DIR / "users_import.xlsx"
ORDERS_XLSX = IMPORT_DIR / "orders_import.xlsx"
PICKUP_POINTS_XLSX = IMPORT_DIR / "pickup_points_import.xlsx"


def _load_rows(path: Path, skip_header: bool = True) -> list[tuple]:
    """Read the first worksheet as a list of row tuples."""
    worksheet = openpyxl.load_workbook(path, data_only=True).active
    rows = list(worksheet.iter_rows(values_only=True))
    return rows[1:] if skip_header else rows


def create_schema() -> None:
    """Recreate the database file and apply app/db/schema.sql to it."""
    if DB_PATH.exists():
        DB_PATH.unlink()
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    raw = engine.raw_connection()
    try:
        raw.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
        raw.commit()
    finally:
        raw.close()


def import_products(session) -> int:
    count = 0
    for row in _load_rows(PRODUCTS_XLSX):
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
            # Photos already live in app/static/img/products/ - the workbook only
            # names the file, it is not copied from data/import/ any more.
            photo_path=str(photo).strip() if photo else "",
        ))
        count += 1
    session.flush()
    return count


def import_users(session) -> int:
    count = 0
    for row in _load_rows(USERS_XLSX):
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
    session.flush()
    return count


def import_pickup_points(session) -> int:
    # This workbook has no header row - the first row is already an address.
    addresses = [row[0] for row in _load_rows(PICKUP_POINTS_XLSX, skip_header=False) if row and row[0]]
    for idx, address in enumerate(addresses, start=1):
        session.add(PickupPoint(id=idx, address=str(address).strip()))
    session.flush()
    return len(addresses)


def import_orders(session) -> int:
    users_by_fio = {u.full_name: u for u in session.query(User).all()}
    products_by_article = {p.article: p for p in session.query(Product).all()}

    count = 0
    for row in _load_rows(ORDERS_XLSX):
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

        # "ART1, 2, ART2, 5" -> pairs of (article, quantity)
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
        count += 1
    session.flush()
    return count


def main():
    create_schema()

    session = get_session()
    try:
        n_products = import_products(session)
        n_users = import_users(session)
        n_points = import_pickup_points(session)
        n_orders = import_orders(session)
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

    print(f"Товары:        {n_products}")
    print(f"Пользователи:  {n_users}")
    print(f"Пункты выдачи: {n_points}")
    print(f"Заказы:        {n_orders}")
    print(f"Схема:         {SCHEMA_PATH}")
    print(f"БД создана:    {DB_PATH}")


if __name__ == "__main__":
    main()
