"""Import demo data from data/import/*.xlsx into the SQLite database via SQLAlchemy.

Usage: python data/import_excel_to_db.py
"""
from __future__ import annotations

import re
import shutil
import sys
from pathlib import Path

import openpyxl
from werkzeug.security import generate_password_hash

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.db.models import (  # noqa: E402
    Base,
    Order,
    OrderItem,
    PickupPoint,
    Product,
    ROLE_BY_LABEL,
    User,
)
from app.db.session import DB_PATH, engine, get_session  # noqa: E402

IMPORT_DIR = BASE_DIR / "data" / "import"
PRODUCTS_IMG_DIR = BASE_DIR / "app" / "static" / "img" / "products"
STATIC_IMG_DIR = BASE_DIR / "app" / "static" / "img"
LOGO_SRC = IMPORT_DIR / "icon.png"
LOGO_DST = STATIC_IMG_DIR / "logo.png"
APP_ICON_SRC = IMPORT_DIR / "icon.ico"
APP_ICON_DST = STATIC_IMG_DIR / "icon.ico"
PLACEHOLDER_SRC = IMPORT_DIR / "picture.png"
PLACEHOLDER_DST = STATIC_IMG_DIR / "placeholder.png"


def _rows(ws):
    return list(ws.iter_rows(values_only=True))


def _load_sheet(path: Path):
    wb = openpyxl.load_workbook(path, data_only=True)
    return wb.active


def find_workbook_by_header(expected_first_header: str) -> Path:
    """The two Cyrillic-named files are mangled by filesystem encoding, so we
    locate them by inspecting the header row instead of trusting the filename."""
    for path in IMPORT_DIR.glob("*.xlsx"):
        ws = _load_sheet(path)
        first_row = next(ws.iter_rows(values_only=True), None)
        if first_row and first_row[0] == expected_first_header:
            return path
    raise FileNotFoundError(f"No xlsx with header {expected_first_header!r} found in {IMPORT_DIR}")


def import_products(session) -> int:
    ws = _load_sheet(IMPORT_DIR / "Tovar.xlsx")
    rows = _rows(ws)[1:]
    count = 0
    for row in rows:
        if not row or not row[0]:
            continue
        (article, name, unit, price, supplier, maker, category,
         discount, stock_qty, description, photo) = (list(row) + [None] * 11)[:11]

        photo_path = ""
        if photo:
            src = IMPORT_DIR / str(photo)
            if src.exists():
                dst = PRODUCTS_IMG_DIR / src.name
                shutil.copyfile(src, dst)
                photo_path = src.name

        product = Product(
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
            photo_path=photo_path,
        )
        session.add(product)
        count += 1
    session.flush()
    return count


def import_users(session) -> int:
    ws = _load_sheet(IMPORT_DIR / "user_import.xlsx")
    rows = _rows(ws)[1:]
    count = 0
    for row in rows:
        if not row or not row[0]:
            continue
        role_label, full_name, login, password = row[:4]
        role = ROLE_BY_LABEL.get((role_label or "").strip())
        if role is None:
            continue
        user = User(
            full_name=(full_name or "").strip(),
            login=(login or "").strip(),
            password_hash=generate_password_hash(str(password).strip()),
            role=role,
        )
        session.add(user)
        count += 1
    session.flush()
    return count


def import_pickup_points(session) -> int:
    # No fixed header label for this sheet (first row is already data) ->
    # detect it by shape: single-column sheet of comma-containing addresses.
    for candidate in IMPORT_DIR.glob("*.xlsx"):
        if candidate.name in {"Tovar.xlsx", "user_import.xlsx"}:
            continue
        ws = _load_sheet(candidate)
        if ws.dimensions.split(":")[1].startswith("A"):
            # single-column sheet -> pickup points file
            rows = [r[0] for r in _rows(ws) if r and r[0]]
            if rows and "," in str(rows[0]) and "г." in str(rows[0]):
                for idx, address in enumerate(rows, start=1):
                    session.add(PickupPoint(id=idx, address=str(address).strip()))
                session.flush()
                return len(rows)
    raise FileNotFoundError("Pickup points workbook not found")


def import_orders(session) -> int:
    path = find_workbook_by_header("Номер заказа")
    ws = _load_sheet(path)
    rows = _rows(ws)[1:]

    users_by_fio = {u.full_name: u for u in session.query(User).all()}
    products_by_article = {p.article: p for p in session.query(Product).all()}

    count = 0
    for row in rows:
        if not row or row[0] is None:
            continue
        order_no, arts, order_date, delivery_date, address_no, fio, code, status = row[:8]

        order_date_v = order_date.date() if hasattr(order_date, "date") else None
        delivery_date_v = delivery_date.date() if hasattr(delivery_date, "date") else None
        fio = (fio or "").strip()

        order = Order(
            order_no=int(order_no),
            order_date=order_date_v,
            delivery_date=delivery_date_v,
            pickup_point_id=int(address_no) if address_no else None,
            client_fio=fio,
            client_user_id=users_by_fio[fio].id if fio in users_by_fio else None,
            pickup_code=str(code or "").strip(),
            status=(status or "").strip(),
        )
        session.add(order)
        session.flush()

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


def copy_static_assets():
    PRODUCTS_IMG_DIR.mkdir(parents=True, exist_ok=True)
    STATIC_IMG_DIR.mkdir(parents=True, exist_ok=True)
    for src, dst in ((LOGO_SRC, LOGO_DST), (APP_ICON_SRC, APP_ICON_DST), (PLACEHOLDER_SRC, PLACEHOLDER_DST)):
        if src.exists():
            shutil.copyfile(src, dst)


def main():
    copy_static_assets()

    if DB_PATH.exists():
        DB_PATH.unlink()
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(engine)

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
    print(f"БД создана:    {DB_PATH}")


if __name__ == "__main__":
    main()
