-- Схема БД «СтройМатериалы» (SQLite).
--
-- Соответствует моделям SQLAlchemy в app/db/models.py.
-- Применяется автоматически скриптом data/import_excel_to_db.py при создании
-- базы data/stroymaterialy.db, поэтому при изменении моделей нужно обновить
-- и этот файл (или перегенерировать его из моделей).
--
-- Порядок таблиц важен: справочники (pickup_points, products, users) идут
-- раньше тех, кто на них ссылается по внешнему ключу (orders, order_items).

-- Пункты выдачи заказов.
CREATE TABLE pickup_points (
    id      INTEGER      NOT NULL,
    address VARCHAR(255) NOT NULL,
    PRIMARY KEY (id)
);

-- Товары каталога.
CREATE TABLE products (
    id          INTEGER       NOT NULL,
    article     VARCHAR(50)   NOT NULL,  -- артикул, уникален
    name        VARCHAR(255)  NOT NULL,
    unit        VARCHAR(50)   NOT NULL,  -- единица измерения
    price       NUMERIC(12,2) NOT NULL,
    supplier    VARCHAR(255)  NOT NULL,
    maker       VARCHAR(255)  NOT NULL,  -- производитель
    category    VARCHAR(255)  NOT NULL,
    discount    NUMERIC(5,2)  NOT NULL,  -- скидка, %; >12 подсвечивает карточку
    stock_qty   INTEGER       NOT NULL,  -- остаток на складе
    description TEXT          NOT NULL,
    photo_path  VARCHAR(255)  NOT NULL,  -- имя файла в app/static/img/products/
    PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_products_article ON products (article);

-- Пользователи: администраторы, менеджеры, авторизованные клиенты.
CREATE TABLE users (
    id            INTEGER      NOT NULL,
    full_name     VARCHAR(255) NOT NULL,
    login         VARCHAR(255) NOT NULL,  -- почта, уникальна
    password_hash VARCHAR(255) NOT NULL,  -- werkzeug generate_password_hash
    role          VARCHAR(20)  NOT NULL,  -- admin | manager | client
    PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_users_login ON users (login);

-- Заказы.
CREATE TABLE orders (
    id              INTEGER      NOT NULL,
    order_no        INTEGER      NOT NULL,  -- номер заказа, уникален
    order_date      DATE,
    delivery_date   DATE,
    pickup_point_id INTEGER,
    client_fio      VARCHAR(255) NOT NULL,
    client_user_id  INTEGER,                -- заполняется, если ФИО совпало с users
    pickup_code     VARCHAR(20)  NOT NULL,  -- код для получения
    status          VARCHAR(50)  NOT NULL,  -- Новый | Завершен
    PRIMARY KEY (id),
    FOREIGN KEY (pickup_point_id) REFERENCES pickup_points (id),
    FOREIGN KEY (client_user_id)  REFERENCES users (id)
);

CREATE UNIQUE INDEX ix_orders_order_no ON orders (order_no);

-- Состав заказа: позиции «артикул + количество».
CREATE TABLE order_items (
    id         INTEGER     NOT NULL,
    order_id   INTEGER     NOT NULL,
    product_id INTEGER,                 -- NULL, если артикула нет в products
    article    VARCHAR(50) NOT NULL,
    qty        INTEGER     NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (order_id)   REFERENCES orders (id),
    FOREIGN KEY (product_id) REFERENCES products (id)
);
