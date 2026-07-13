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

## Переход на PostgreSQL (pgloader)

По умолчанию приложение использует SQLite (`data/stroymaterialy.db`). Чтобы перенести
уже наполненную БД на PostgreSQL, используется `pgloader` — он сам создаёт таблицы,
переносит данные и типы, восстанавливает автоинкременты (`sequences`).

### 1. Установить PostgreSQL и pgloader

```bash
# macOS
brew install postgresql@16 pgloader
brew services start postgresql@16

# Ubuntu / Debian
sudo apt install postgresql pgloader
sudo systemctl start postgresql
```

### 2. Создать базу и пользователя в PostgreSQL

Логин/пароль/имя базы ниже — те же, что уже прописаны в `.env.example` и
`data/sqlite_to_postgres.load`. Если меняете их — поправьте оба файла одинаково.

```bash
sudo -u postgres psql -c "CREATE USER stroymaterialy WITH PASSWORD 'stroymaterialy';"
sudo -u postgres psql -c "CREATE DATABASE stroymaterialy OWNER stroymaterialy;"
```

### 3. Убедиться, что SQLite-БД наполнена

```bash
python data/import_excel_to_db.py
```

### 4. Запустить перенос через pgloader

Готовый скрипт `data/sqlite_to_postgres.load` уже настроен на файл `data/stroymaterialy.db`
и базу `stroymaterialy` из шага 2:

```bash
pgloader data/sqlite_to_postgres.load
```

pgloader выведет отчёт: сколько таблиц/строк перенесено и есть ли ошибки/предупреждения.

### 5. Переключить приложение на PostgreSQL

```bash
cp .env.example .env
```

По умолчанию в `.env.example` уже стоит `DATABASE_URL` на базу `stroymaterialy` из шага 2 —
менять ничего не нужно, если не меняли логин/пароль/хост. `app/db/session.py` при старте
сам подхватывает `.env` (через `python-dotenv`) и, если `DATABASE_URL` задан, подключается
к PostgreSQL вместо `data/stroymaterialy.db`. Понадобится драйвер `psycopg2-binary` — он уже
есть в `requirements.txt`.

```bash
python app/main.py
```

Если `.env` нет или в нём нет `DATABASE_URL` — приложение как и раньше работает на SQLite,
никаких изменений в коде для этого не требуется.

## Структура

- `app/db/` — модели SQLAlchemy и сессия (`DATABASE_URL` из `.env`, по умолчанию SQLite).
- `app/core/permissions.py` — таблица прав по ролям (зеркало `app/static/js/permissions.js`).
- `app/core/render.py` — рендер Jinja2-шаблонов в HTML-строки.
- `app/core/static_server.py` — локальный HTTP-сервер для `app/static/`.
- `app/api/` — сервисы (`AuthService`, `SessionService`, `ProductService`, `OrderService`) и фасад `Api`, вызываемый из JS через `pywebview.api.*`.
- `app/templates/` — HTML-оболочки (Jinja2), рендерятся в Python и грузятся в окно через `window.load_html`.
- `app/static/css`, `app/static/js` — стили и логика интерфейса.
- `data/import/` — исходные Excel-файлы и фото для импорта.
- `data/import_excel_to_db.py` — импорт данных из `data/import/*.xlsx` в `data/stroymaterialy.db`.
- `data/sqlite_to_postgres.load` — скрипт pgloader для переноса БД на PostgreSQL.
- `.env.example` — шаблон `DATABASE_URL` для подключения к PostgreSQL (см. «Переход на PostgreSQL»).
