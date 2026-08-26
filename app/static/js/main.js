class Icons {
  static SVG_ATTRS =
    'viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

  static SEARCH = `<svg class="search-icon" width="18" height="18" ${Icons.SVG_ATTRS} stroke="#8a8a8e" stroke-width="2">
      <circle cx="11" cy="11" r="7"></circle><path d="M20 20 l-3.5 -3.5"></path></svg>`;

  static CLEAR = `<svg width="15" height="15" ${Icons.SVG_ATTRS} stroke="#1c1c1e" stroke-width="2.6">
      <path d="M6 6 L18 18 M18 6 L6 18"></path></svg>`;

  static LOGOUT = `<svg width="24" height="24" ${Icons.SVG_ATTRS} stroke="#1c1c1e" stroke-width="1.8">
      <path d="M14 4 H7 a2 2 0 0 0 -2 2 v12 a2 2 0 0 0 2 2 h7"></path>
      <path d="M11 12 h9"></path><path d="M17 8.5 L20.5 12 L17 15.5"></path></svg>`;

  static edit(size) {
    return `<svg width="${size}" height="${size}" ${Icons.SVG_ATTRS} stroke="#1c1c1e" stroke-width="1.8">
      <path d="M4 20 h16"></path><path d="M14.5 4.5 a2.1 2.1 0 0 1 3 3 L8 17 l-4 1 1-4 z"></path></svg>`;
  }

  static delete(size) {
    return `<svg width="${size}" height="${size}" ${Icons.SVG_ATTRS} stroke="#d0453c" stroke-width="1.8">
      <path d="M4 7 h16"></path><path d="M9 7 V5 a1 1 0 0 1 1 -1 h4 a1 1 0 0 1 1 1 v2"></path>
      <path d="M6.5 7 l1 13 a1 1 0 0 0 1 1 h7 a1 1 0 0 0 1 -1 l1 -13"></path>
      <path d="M10 11 v6 M14 11 v6"></path></svg>`;
  }
}

class Format {
  static esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  static toIsoDate(ru) {
    if (!ru) return "";
    const [d, m, y] = String(ru).split(".");
    return d && m && y ? `${y}-${m}-${d}` : ru;
  }

  static price(value) {
    return Number(value).toLocaleString("ru-RU");
  }
}

class Modal {
  static PLACEHOLDER_PHOTO = "img/placeholder.png";

  constructor({ mode, key, form }) {
    this.mode = mode;
    this.key = key;
    this.form = form;
  }

  get title() { throw new Error("Modal.title не реализован"); }
  get fields() { throw new Error("Modal.fields не реализован"); }
  validate() { throw new Error("Modal.validate не реализован"); }
  buildPayload() { throw new Error("Modal.buildPayload не реализован"); }
  save(payload) { throw new Error("Modal.save не реализован"); }

  extraFieldsHtml() { return ""; }
  bindExtraFields() {}

  static closeCurrent() {
    const overlay = document.querySelector(".modal-overlay");
    if (overlay) overlay.remove();
  }

  open(onSaved) {
    Modal.closeCurrent();
    this.onSaved = onSaved;

    const fieldsHtml = this.fields.map((f) => `
      <div class="modal-field${f.wide ? " wide" : ""}">
        <label class="modal-label">${Format.esc(f.label)}</label>
        <input class="modal-input" type="${f.type}" data-key="${f.key}"
               value="${Format.esc(this.form[f.key] ?? "")}">
      </div>`).join("");

    this.overlay = document.createElement("div");
    this.overlay.className = "modal-overlay";
    this.overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h2 class="modal-title">${Format.esc(this.title)}</h2>
        <div class="modal-grid">${fieldsHtml}${this.extraFieldsHtml()}</div>
        <p class="modal-error"></p>
        <div class="modal-actions">
          <button class="modal-cancel">Отмена</button>
          <button class="modal-save">Сохранить</button>
        </div>
      </div>`;
    document.body.appendChild(this.overlay);

    this.element = this.overlay.querySelector(".modal");
    this.errorText = this.overlay.querySelector(".modal-error");

    for (const input of this.element.querySelectorAll("[data-key]")) {
      const write = () => { this.form[input.dataset.key] = input.value; };
      input.addEventListener("input", write);
      input.addEventListener("change", write);
    }

    this.overlay.addEventListener("click", () => this.close());
    this.element.addEventListener("click", (e) => e.stopPropagation());
    this.element.querySelector(".modal-cancel").addEventListener("click", () => this.close());
    this.element.querySelector(".modal-save").addEventListener("click", () => this.submit());

    this.bindExtraFields();
  }

  close() {
    if (this.overlay) this.overlay.remove();
  }

  setError(message) {
    this.errorText.textContent = message || "";
    this.errorText.classList.toggle("visible", Boolean(message));
  }

  async submit() {
    const validationError = this.validate();
    if (validationError) {
      this.setError(validationError);
      return;
    }

    const res = await this.save(this.buildPayload());
    if (!res || !res.ok) {
      this.setError((res && res.error) || this.saveErrorText);
      return;
    }

    await this.onSaved();
    this.close();
  }
}

class ProductModal extends Modal {
  static FIELDS = [
    { key: "name",  label: "Наименование",  type: "text", wide: true },
    { key: "art",   label: "Артикул",       type: "text" },
    { key: "cat",   label: "Категория",     type: "text" },
    { key: "maker", label: "Производитель", type: "text" },
    { key: "price", label: "Цена, ₽",       type: "number" },
    { key: "disc",  label: "Скидка, %",     type: "number" },
    { key: "stock", label: "Остаток, шт.",  type: "number" },
  ];

  static emptyForm() {
    return { name: "", art: "", cat: "", maker: "", price: "", disc: "", stock: "", desc: "", photo: "" };
  }

  static formFrom(product) {
    return {
      name: product.name, art: product.art, cat: product.cat, maker: product.maker,
      price: String(product.price), disc: String(product.disc), stock: String(product.stock),
      desc: product.desc, photo: product.photo || "",
    };
  }

  get title() { return this.mode === "edit" ? "Редактировать товар" : "Новый товар"; }
  get fields() { return ProductModal.FIELDS; }
  get saveErrorText() { return "Не удалось сохранить товар"; }

  extraFieldsHtml() {
    const photo = this.form.photo || Modal.PLACEHOLDER_PHOTO;
    return `
      <div class="modal-field wide">
        <label class="modal-label">Описание</label>
        <textarea class="modal-textarea" rows="3" data-key="desc">${Format.esc(this.form.desc ?? "")}</textarea>
      </div>
      <div class="photo-row">
        <div class="photo-preview" style="background-image: url('${Format.esc(photo)}')"></div>
        <label class="photo-pick">Выбрать фото
          <input type="file" accept="image/*" hidden>
        </label>
        <button class="photo-clear${this.form.photo ? "" : " hidden"}">Убрать фото</button>
      </div>`;
  }

  bindExtraFields() {
    const preview = this.element.querySelector(".photo-preview");
    const clearButton = this.element.querySelector(".photo-clear");

    this.element.querySelector('input[type="file"]').addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        this.form.photo = reader.result;
        preview.style.backgroundImage = `url('${reader.result}')`;
        clearButton.classList.remove("hidden");
      };
      reader.readAsDataURL(file);
    });

    clearButton.addEventListener("click", () => {
      this.form.photo = "";
      preview.style.backgroundImage = `url('${Modal.PLACEHOLDER_PHOTO}')`;
      clearButton.classList.add("hidden");
    });
  }

  validate() {
    const { name, art } = this.form;
    if (!name || !name.trim() || !art || !art.trim()) return "Заполните наименование и артикул";
    return null;
  }

  buildPayload() {
    const f = this.form;
    return {
      art: f.art.trim(), name: f.name.trim(), cat: (f.cat || "").trim(),
      maker: (f.maker || "").trim(), price: Math.max(0, Number(f.price) || 0),
      disc: Math.max(0, Number(f.disc) || 0),
      stock: Math.max(0, Math.round(Number(f.stock) || 0)),
      desc: (f.desc || "").trim(), photo: f.photo || "",
    };
  }

  save(payload) {
    const api = window.PywebviewBridge.api;
    return this.mode === "edit" ? api.update_product(this.key, payload) : api.create_product(payload);
  }
}

class OrderModal extends Modal {
  static FIELDS = [
    { key: "arts",     label: "Артикул заказа (арт, кол-во, арт, кол-во…)", type: "text", wide: true },
    { key: "date",     label: "Дата заказа",    type: "date" },
    { key: "delivery", label: "Дата доставки",  type: "date" },
    { key: "address",  label: "Адрес пункта выдачи (№)", type: "number" },
    { key: "code",     label: "Код для получения", type: "text" },
    { key: "fio",      label: "ФИО авторизированного клиента", type: "text", wide: true },
  ];

  static emptyForm() {
    return { arts: "", date: "", delivery: "", address: "", fio: "", code: "", status: "Новый" };
  }

  static formFrom(order) {
    return {
      arts: order.arts, date: Format.toIsoDate(order.date), delivery: Format.toIsoDate(order.delivery),
      address: order.address, fio: order.fio, code: order.code, status: order.status,
    };
  }

  get title() { return this.mode === "edit" ? "Редактировать заказ" : "Новый заказ"; }
  get fields() { return OrderModal.FIELDS; }
  get saveErrorText() { return "Не удалось сохранить заказ"; }

  extraFieldsHtml() {
    const status = this.form.status;
    return `
      <div class="modal-field">
        <label class="modal-label">Статус заказа</label>
        <select class="modal-input" data-key="status">
          <option value="Новый"${status === "Новый" ? " selected" : ""}>Новый</option>
          <option value="Завершен"${status === "Завершен" ? " selected" : ""}>Завершен</option>
        </select>
      </div>`;
  }

  validate() {
    if (!this.form.fio || !this.form.fio.trim()) return "Укажите ФИО клиента";
    return null;
  }

  buildPayload() {
    const f = this.form;
    return {
      arts: (f.arts || "").trim(), date: f.date || null, delivery: f.delivery || null,
      address: f.address ? Number(f.address) : null, fio: f.fio.trim(),
      code: (f.code || "").trim(), status: f.status || "Новый",
    };
  }

  save(payload) {
    const api = window.PywebviewBridge.api;
    return this.mode === "edit" ? api.update_order(this.key, payload) : api.create_order(payload);
  }
}

class ProductsView {
  constructor(permissions) {
    this.permissions = permissions;
    this.items = [];
    this.selected = null;
    this.query = "";
    this.maker = "all";
    this.sort = "none";
    this.loading = true;
  }

  static template({ canFilter, canEdit }) {
    return `
      <div class="products-view" style="display: contents">
        <h1 id="catalog-title" class="view-title">Товары</h1>

        ${canFilter ? `
        <div id="toolbar">
          <div class="search-box">
            ${Icons.SEARCH}
            <input class="search-input" id="product-search" type="search"
                   placeholder="Поиск по названию, артикулу, описанию…">
            <button class="search-clear hidden" id="product-search-clear"
                    aria-label="Очистить поиск">${Icons.CLEAR}</button>
          </div>
          <select class="select maker" id="maker-select" aria-label="Производитель">
            <option value="all">Все производители</option>
          </select>
          <select class="select sort" id="sort-select" aria-label="Сортировка">
            <option value="none">Без сортировки</option>
            <option value="stock-asc">Остаток: по возрастанию</option>
            <option value="stock-desc">Остаток: по убыванию</option>
            <option value="price-asc">Цена: по возрастанию</option>
            <option value="price-desc">Цена: по убыванию</option>
            <option value="disc-asc">Скидка: по возрастанию</option>
            <option value="disc-desc">Скидка: по убыванию</option>
          </select>
          ${canEdit ? `<button class="accent-btn" id="add-product">+ Добавить товар</button>` : ""}
        </div>` : ""}

        <div class="empty-state hidden" id="product-empty">
          <span class="empty-title">Ничего не найдено</span>
          <span class="empty-hint">Измените запрос или сбросьте фильтры</span>
        </div>

        <div class="product-list" id="product-list"></div>
      </div>`;
  }

  mount(dashboard) {
    this.dashboard = dashboard;
    this.element = document.querySelector(".products-view");
    this.list = document.getElementById("product-list");
    this.empty = document.getElementById("product-empty");

    if (this.permissions.canFilter) this.bindToolbar();
    if (this.permissions.canEdit) {
      document.getElementById("add-product").addEventListener("click", () => this.openAddModal());
    }
    this.bindListEvents();
  }

  bindToolbar() {
    const search = document.getElementById("product-search");
    const clear = document.getElementById("product-search-clear");

    search.addEventListener("input", () => {
      this.query = search.value;
      clear.classList.toggle("hidden", this.query.length === 0);
      this.render();
    });
    clear.addEventListener("click", () => {
      this.query = "";
      search.value = "";
      clear.classList.add("hidden");
      this.render();
    });

    this.makerSelect = document.getElementById("maker-select");
    this.makerSelect.addEventListener("change", (e) => { this.maker = e.target.value; this.render(); });
    document.getElementById("sort-select")
      .addEventListener("change", (e) => { this.sort = e.target.value; this.render(); });
  }

  bindListEvents() {
    this.list.addEventListener("click", async (e) => {
      const card = e.target.closest(".product-card");
      if (!card) return;
      const product = this.items.find((r) => r.art === card.dataset.art);
      if (!product) return;

      const action = e.target.closest("[data-action]");
      if (action && action.dataset.action === "edit-product") {
        this.openEditModal(product);
      } else if (action && action.dataset.action === "delete-product") {
        await window.PywebviewBridge.api.delete_product(product.art);
        if (this.selected === product.art) this.selected = null;
        this.reload();
      } else {
        this.toggleSelection(product.art);
      }
    });

    this.list.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const card = e.target.closest(".product-card");
      if (!card) return;
      e.preventDefault();
      this.toggleSelection(card.dataset.art);
    });
  }

  toggleSelection(article) {
    this.selected = this.selected === article ? null : article;
    this.render();
  }

  openAddModal() {
    new ProductModal({ mode: "add", form: ProductModal.emptyForm() })
      .open(() => this.reload());
  }

  openEditModal(product) {
    new ProductModal({ mode: "edit", key: product.art, form: ProductModal.formFrom(product) })
      .open(() => this.reload());
  }

  async reload() {
    const api = window.PywebviewBridge.api;
    if (!api) return;
    this.items = (await api.get_products()) || [];
    this.renderMakerOptions();
    this.render();
  }

  visibleItems() {
    const words = this.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let list = this.items.filter((r) => {
      if (this.maker !== "all" && r.maker !== this.maker) return false;
      if (!words.length) return true;
      const hay = [r.name, r.art, r.cat, r.desc, r.maker].join(" ").toLowerCase();
      return words.every((w) => hay.includes(w));
    });

    if (this.sort !== "none") {
      const [key, dir] = this.sort.split("-");
      const mul = dir === "asc" ? 1 : -1;
      list = [...list].sort((x, y) => (Number(x[key]) - Number(y[key])) * mul);
    }
    return list;
  }

  renderMakerOptions() {
    if (!this.makerSelect) return;
    const makers = [...new Set(this.items.map((r) => r.maker).filter(Boolean))].sort();
    this.makerSelect.innerHTML = `<option value="all">Все производители</option>`
      + makers.map((m) => `<option value="${Format.esc(m)}">${Format.esc(m)}</option>`).join("");
    this.makerSelect.value = makers.includes(this.maker) ? this.maker : "all";
    this.maker = this.makerSelect.value;
  }

  cardHtml(r) {
    const classes = ["product-card"];
    if (Number(r.disc) > 12) classes.push("high-discount");
    if (r.art === this.selected) classes.push("selected");
    const photo = r.photo || Modal.PLACEHOLDER_PHOTO;

    return `
      <div class="${classes.join(" ")}" role="button" tabindex="0" data-art="${Format.esc(r.art)}">
        <div class="product-photo" style="background-image: url('${Format.esc(photo)}')"></div>
        <div class="product-info">
          <div class="product-head">
            <h2 class="product-name">${Format.esc(r.name)}</h2>
            <span class="product-category">${Format.esc(r.cat)}</span>
          </div>
          <span class="product-meta">Артикул ${Format.esc(r.art)} · ${Format.esc(r.maker)}</span>
          <p class="product-desc">${Format.esc(r.desc)}</p>
        </div>
        <div class="product-side">
          <b class="product-price">${Format.esc(Format.price(r.price))} ₽</b>
          <span class="product-stat">Остаток: ${Format.esc(r.stock)} шт.</span>
          <span class="product-stat">Скидка: ${Format.esc(r.disc)} %</span>
          ${this.permissions.canEdit ? `
          <div class="product-actions">
            <button class="icon-btn" data-action="edit-product" aria-label="Редактировать"
                    title="Редактировать">${Icons.edit(17)}</button>
            <button class="icon-btn" data-action="delete-product" aria-label="Удалить"
                    title="Удалить">${Icons.delete(17)}</button>
          </div>` : ""}
        </div>
      </div>`;
  }

  render() {
    const list = this.visibleItems();
    this.empty.classList.toggle("hidden", this.loading || list.length !== 0);
    this.list.innerHTML = list.map((r) => this.cardHtml(r)).join("");
  }

  show(visible) {
    this.element.style.display = visible ? "contents" : "none";
  }
}

class OrdersView {
  constructor(permissions) {
    this.permissions = permissions;
    this.items = [];
    this.query = "";
  }

  static template({ canEdit }) {
    return `
      <div class="orders-view" style="display: none">
        <h1 class="view-title centered">Заказы</h1>
        <div class="orders-toolbar">
          <div class="search-box">
            ${Icons.SEARCH}
            <input class="search-input" id="order-search" type="search" placeholder="Поиск по заказам…">
            <button class="search-clear hidden" id="order-search-clear"
                    aria-label="Очистить поиск">${Icons.CLEAR}</button>
          </div>
          ${canEdit ? `<button class="accent-btn" id="add-order">+ Добавить заказ</button>` : ""}
        </div>
        <div class="orders-scroll"><div class="orders-table" id="order-table"></div></div>
        <div class="empty-state hidden" id="order-empty">
          <span class="empty-title">Заказы не найдены</span>
          <span class="empty-hint">Измените поисковый запрос</span>
        </div>
      </div>`;
  }

  mount() {
    this.element = document.querySelector(".orders-view");
    this.table = document.getElementById("order-table");
    this.empty = document.getElementById("order-empty");

    this.bindSearch();
    if (this.permissions.canEditOrders) {
      document.getElementById("add-order").addEventListener("click", () => this.openAddModal());
      this.bindTableEvents();
    }
  }

  bindSearch() {
    const search = document.getElementById("order-search");
    const clear = document.getElementById("order-search-clear");

    search.addEventListener("input", () => {
      this.query = search.value;
      clear.classList.toggle("hidden", this.query.length === 0);
      this.render();
    });
    clear.addEventListener("click", () => {
      this.query = "";
      search.value = "";
      clear.classList.add("hidden");
      this.render();
    });
  }

  bindTableEvents() {
    this.table.addEventListener("click", async (e) => {
      const action = e.target.closest("[data-action]");
      if (!action) return;
      const row = e.target.closest(".order-row");
      const order = this.items.find((o) => String(o.num) === row.dataset.num);
      if (!order) return;

      if (action.dataset.action === "edit-order") {
        this.openEditModal(order);
      } else if (action.dataset.action === "delete-order") {
        await window.PywebviewBridge.api.delete_order(order.num);
        this.reload();
      }
    });
  }

  openAddModal() {
    new OrderModal({ mode: "add", form: OrderModal.emptyForm() })
      .open(() => this.reload());
  }

  openEditModal(order) {
    new OrderModal({ mode: "edit", key: order.num, form: OrderModal.formFrom(order) })
      .open(() => this.reload());
  }

  async reload() {
    const api = window.PywebviewBridge.api;
    if (!api || !this.permissions.canViewOrders) return;
    this.items = (await api.get_orders()) || [];
    this.render();
  }

  visibleItems() {
    const words = this.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return this.items.filter((o) => {
      if (!words.length) return true;
      const hay = [o.num, o.arts, o.date, o.delivery, o.address, o.fio, o.code, o.status]
        .join(" ").toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }

  headHtml() {
    return `
      <div class="order-row head">
        <div>Номер заказа</div><div>Артикул заказа</div><div>Дата заказа</div><div>Дата доставки</div>
        <div>Адрес пункта выдачи</div><div>ФИО авторизированного клиента</div>
        <div>Код для получения</div><div>Статус заказа</div>
        ${this.permissions.canEditOrders ? "<div></div>" : ""}
      </div>`;
  }

  rowHtml(o) {
    return `
      <div class="order-row body" data-num="${Format.esc(o.num)}">
        <div class="num">${Format.esc(o.num)}</div>
        <div class="num">${Format.esc(o.arts)}</div>
        <div class="num">${Format.esc(o.date)}</div>
        <div class="num">${Format.esc(o.delivery)}</div>
        <div class="num">${Format.esc(o.address)}</div>
        <div>${Format.esc(o.fio)}</div>
        <div class="num">${Format.esc(o.code)}</div>
        <div><span class="status${o.status === "Новый" ? " new" : ""}">${Format.esc(o.status)}</span></div>
        ${this.permissions.canEditOrders ? `
        <div class="order-actions">
          <button class="icon-btn" data-action="edit-order" aria-label="Редактировать заказ"
                  title="Редактировать заказ">${Icons.edit(16)}</button>
          <button class="icon-btn" data-action="delete-order" aria-label="Удалить заказ"
                  title="Удалить заказ">${Icons.delete(16)}</button>
        </div>` : ""}
      </div>`;
  }

  render() {
    const list = this.visibleItems();
    this.empty.classList.toggle("hidden", list.length !== 0);
    this.table.innerHTML = this.headHtml() + list.map((o) => this.rowHtml(o)).join("");
  }

  show(visible) {
    this.element.style.display = visible ? "contents" : "none";
  }
}

class Dashboard {
  constructor(root) {
    this.root = root;
    this.user = window.__USER__ || { role: "guest", fio: "Гость", roleLabel: "Гость" };

    const role = this.user.role;
    this.permissions = {
      canFilter: window.Permissions.has(role, "FILTER_SORT_SEARCH"),
      canEdit: window.Permissions.has(role, "EDIT_PRODUCTS"),
      canViewOrders: window.Permissions.has(role, "VIEW_ORDERS"),
      canEditOrders: window.Permissions.has(role, "EDIT_ORDERS"),
    };

    this.productsView = new ProductsView(this.permissions);
    this.ordersView = this.permissions.canViewOrders ? new OrdersView(this.permissions) : null;
  }

  start() {
    window.AppConfig.applyTitle();
    this.render();
    this.bindEvents();

    window.PywebviewBridge.onReady(async () => {
      await this.productsView.reload();
      if (this.ordersView) await this.ordersView.reload();
      this.productsView.loading = false;
      this.productsView.render();
    });
  }

  topbarHtml() {
    const isGuest = this.user.role === "guest";
    const logoutLabel = isGuest ? "Войти" : "Выйти";

    return `
      <div id="topbar">
        <div class="brand">
          <div class="brand-logo">
            <img src="img/logo.png" alt="Логотип ${Format.esc(window.AppConfig.COMPANY_NAME)}">
          </div>
          <span class="brand-name">${Format.esc(window.AppConfig.COMPANY_NAME)}</span>
        </div>

        ${this.permissions.canViewOrders ? `
        <div id="segmented" role="tablist">
          <div class="tab-indicator"></div>
          <button class="tab" role="tab" aria-selected="true" data-tab="products">Товары</button>
          <button class="tab" role="tab" aria-selected="false" data-tab="orders">Заказы</button>
        </div>` : "<div></div>"}

        <div id="userbox">
          <div class="user-chip">
            <div class="user-avatar">${Format.esc((this.user.fio || "Г")[0])}</div>
            <div class="user-text">
              <span class="user-name">${Format.esc(this.user.fio || "Гость")}</span>
              <span class="user-role">${Format.esc(this.user.roleLabel || "Гость")}</span>
            </div>
          </div>
          <button class="logout-btn" aria-label="${logoutLabel}" title="${logoutLabel}">${Icons.LOGOUT}</button>
        </div>
      </div>`;
  }

  render() {
    const pageClass = this.permissions.canEditOrders ? "page can-edit-orders" : "page";

    this.root.innerHTML = `
      <div class="${pageClass}">
        ${this.topbarHtml()}
        ${ProductsView.template({ canFilter: this.permissions.canFilter, canEdit: this.permissions.canEdit })}
        ${this.ordersView ? OrdersView.template({ canEdit: this.permissions.canEditOrders }) : ""}
      </div>`;

    this.productsView.mount(this);
    if (this.ordersView) this.ordersView.mount();
  }

  bindEvents() {
    document.querySelector(".logout-btn")
      .addEventListener("click", () => window.PywebviewBridge.api.logout());

    this.segmented = document.getElementById("segmented");
    if (!this.segmented) return;

    for (const button of this.segmented.querySelectorAll(".tab")) {
      button.addEventListener("click", () => this.setTab(button.dataset.tab));
    }
  }

  setTab(tab) {
    const isProducts = tab === "products";
    this.segmented.classList.toggle("orders-active", !isProducts);
    for (const button of this.segmented.querySelectorAll(".tab")) {
      button.setAttribute("aria-selected", String(button.dataset.tab === tab));
    }
    this.productsView.show(isProducts);
    this.ordersView.show(!isProducts);
  }
}

new Dashboard(document.getElementById("root")).start();
