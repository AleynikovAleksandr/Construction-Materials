CREATE TABLE pickup_points (
    id      INTEGER      NOT NULL,
    address VARCHAR(255) NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE products (
    id          INTEGER       NOT NULL,
    article     VARCHAR(50)   NOT NULL,
    name        VARCHAR(255)  NOT NULL,
    unit        VARCHAR(50)   NOT NULL,
    price       NUMERIC(12,2) NOT NULL,
    supplier    VARCHAR(255)  NOT NULL,
    maker       VARCHAR(255)  NOT NULL,
    category    VARCHAR(255)  NOT NULL,
    discount    NUMERIC(5,2)  NOT NULL,
    stock_qty   INTEGER       NOT NULL,
    description TEXT          NOT NULL,
    photo_path  VARCHAR(255)  NOT NULL,
    PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_products_article ON products (article);

CREATE TABLE users (
    id            INTEGER      NOT NULL,
    full_name     VARCHAR(255) NOT NULL,
    login         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL,
    PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_users_login ON users (login);

CREATE TABLE orders (
    id              INTEGER      NOT NULL,
    order_no        INTEGER      NOT NULL,
    order_date      DATE,
    delivery_date   DATE,
    pickup_point_id INTEGER,
    client_fio      VARCHAR(255) NOT NULL,
    client_user_id  INTEGER,
    pickup_code     VARCHAR(20)  NOT NULL,
    status          VARCHAR(50)  NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (pickup_point_id) REFERENCES pickup_points (id),
    FOREIGN KEY (client_user_id)  REFERENCES users (id)
);

CREATE UNIQUE INDEX ix_orders_order_no ON orders (order_no);

CREATE TABLE order_items (
    id         INTEGER     NOT NULL,
    order_id   INTEGER     NOT NULL,
    product_id INTEGER,
    article    VARCHAR(50) NOT NULL,
    qty        INTEGER     NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (order_id)   REFERENCES orders (id),
    FOREIGN KEY (product_id) REFERENCES products (id)
);
