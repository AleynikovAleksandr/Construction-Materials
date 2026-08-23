# ООО «СтройМатериалы»

Десктоп-приложение (pywebview-окно + HTML/CSS/JS-интерфейс) с БД на SQLAlchemy/SQLite, наполняемой из `data/import/*.xlsx`.

## Установка

```bash
python3 -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Наполнение БД из Excel

```bash
python data/import_excel_to_db.py
```

Создаёт `data/materials.db` по схеме `app/db/schema.sql` и наполняет её из `data/import/*.xlsx`. Запускать заново при изменении Excel-файлов.

Картинки в импорте не участвуют — фото товаров, логотип и иконка уже лежат в `app/static/img/`, а Excel лишь указывает имя файла фото.

## Запуск приложения

```bash
python app/main.py
```

## Роли (логин/пароль — из `data/import/users_import.xlsx`)

- **Гость** — вход не требуется, ссылка «Просмотр товаров как гость» на экране входа. Товары без фильтрации/сортировки/поиска.
- **Авторизированный клиент** — товары без фильтрации/сортировки/поиска.
- **Менеджер** — товары с фильтрацией/сортировкой/поиском, просмотр заказов.
- **Администратор** — товары и заказы с полным CRUD, фильтрацией/сортировкой/поиском.

## Структура

- `app/db/schema.sql` — SQL-схема всех таблиц; по ней создаётся база.
- `app/db/models.py`, `app/db/session.py` — модели SQLAlchemy и сессия.
- `app/core/permissions.py` — таблица прав по ролям (зеркало `app/static/js/permissions.js`).
- `app/core/render.py` — рендер Jinja2-шаблонов в HTML-строки.
- `app/core/static_server.py` — локальный HTTP-сервер для `app/static/`.
- `app/api/` — сервисы (`AuthService`, `SessionService`, `ProductService`, `OrderService`) и фасад `Api`, вызываемый из JS через `pywebview.api.*`.
- `app/templates/` — HTML-оболочки (Jinja2), рендерятся в Python и грузятся в окно через `window.load_html`.
- `app/static/css`, `app/static/js` — стили и логика интерфейса.
- `app/static/img/` — логотип, иконка, заглушка и фото товаров.
- `data/import/` — исходные Excel-файлы: `products_import.xlsx`, `users_import.xlsx`, `orders_import.xlsx`, `pickup_points_import.xlsx`.
- `data/import_excel_to_db.py` — создаёт БД по `schema.sql` и импортирует в неё данные из Excel.
