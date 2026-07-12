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

Создаёт `data/stroymaterialy.db`, копирует фото товаров и логотип в `app/static/img/`. Запускать заново при изменении файлов в `data/import/`.

## Запуск приложения

```bash
python app/main.py
```

## Роли (логин/пароль — из `data/import/user_import.xlsx`)

- **Гость** — вход не требуется, ссылка «Просмотр товаров как гость» на экране входа. Товары без фильтрации/сортировки/поиска.
- **Авторизированный клиент** — товары без фильтрации/сортировки/поиска.
- **Менеджер** — товары с фильтрацией/сортировкой/поиском, просмотр заказов.
- **Администратор** — товары и заказы с полным CRUD, фильтрацией/сортировкой/поиском.

## Структура

- `app/db/` — модели SQLAlchemy и сессия.
- `app/core/permissions.py` — таблица прав по ролям (зеркало `app/static/js/permissions.js`).
- `app/core/render.py` — рендер Jinja2-шаблонов в HTML-строки.
- `app/api.py` — методы, вызываемые из JS через `pywebview.api.*`.
- `app/templates/` — HTML-оболочки (Jinja2), рендерятся в Python и грузятся в окно через `window.load_html`.
- `app/static/css`, `app/static/js` — стили и логика интерфейса.
- `data/import/` — исходные Excel-файлы и фото для импорта.
- `data/import_excel_to_db.py` — импорт данных из `data/import/*.xlsx` в `data/stroymaterialy.db`.
