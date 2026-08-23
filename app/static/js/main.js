(function () {
  const USER = window.__USER__ || { role: "guest", fio: "Гость", roleLabel: "Гость" };
  const { hasPermission } = window.Permissions;
  const CAN_FILTER_SORT_SEARCH = hasPermission(USER.role, "FILTER_SORT_SEARCH");
  const CAN_EDIT_PRODUCTS = hasPermission(USER.role, "EDIT_PRODUCTS");
  const CAN_VIEW_ORDERS = hasPermission(USER.role, "VIEW_ORDERS");
  const CAN_EDIT_ORDERS = hasPermission(USER.role, "EDIT_ORDERS");

  const COMPANY_NAME = "ООО «СтройМатериалы»";
  const PLACEHOLDER_PHOTO = "img/placeholder.png";

  const SVG_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  const ICON_SEARCH = `<svg class="search-icon" width="18" height="18" ${SVG_ATTRS} stroke="#8a8a8e" stroke-width="2">
      <circle cx="11" cy="11" r="7"></circle><path d="M20 20 l-3.5 -3.5"></path></svg>`;
  const ICON_CLEAR = `<svg width="15" height="15" ${SVG_ATTRS} stroke="#1c1c1e" stroke-width="2.6">
      <path d="M6 6 L18 18 M18 6 L6 18"></path></svg>`;
  const ICON_LOGOUT = `<svg width="24" height="24" ${SVG_ATTRS} stroke="#1c1c1e" stroke-width="1.8">
      <path d="M14 4 H7 a2 2 0 0 0 -2 2 v12 a2 2 0 0 0 2 2 h7"></path>
      <path d="M11 12 h9"></path><path d="M17 8.5 L20.5 12 L17 15.5"></path></svg>`;
  const iconEdit = (size) => `<svg width="${size}" height="${size}" ${SVG_ATTRS} stroke="#1c1c1e" stroke-width="1.8">
      <path d="M4 20 h16"></path><path d="M14.5 4.5 a2.1 2.1 0 0 1 3 3 L8 17 l-4 1 1-4 z"></path></svg>`;
  const iconDelete = (size) => `<svg width="${size}" height="${size}" ${SVG_ATTRS} stroke="#d0453c" stroke-width="1.8">
      <path d="M4 7 h16"></path><path d="M9 7 V5 a1 1 0 0 1 1 -1 h4 a1 1 0 0 1 1 1 v2"></path>
      <path d="M6.5 7 l1 13 a1 1 0 0 0 1 1 h7 a1 1 0 0 0 1 -1 l1 -13"></path>
      <path d="M10 11 v6 M14 11 v6"></path></svg>`;

  /** Экранирование значений из БД перед вставкой в HTML. */
  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  function toIsoDate(ru) {
    if (!ru) return "";
    const [d, m, y] = String(ru).split(".");
    return d && m && y ? `${y}-${m}-${d}` : ru;
  }

  const state = {
    tab: "products",
    selected: null,
    query: "",
    maker: "all",
    sort: "none",
    items: [],
    orderQuery: "",
    orderItems: [],
    loading: true,
  };

  const api = () => window.pywebview && window.pywebview.api;

  // ---------------------------------------------------------------- разметка
  document.getElementById("root").innerHTML = `
    <div class="page${CAN_EDIT_ORDERS ? " can-edit-orders" : ""}">
      <div id="topbar">
        <div class="brand">
          <div class="brand-logo"><img src="img/logo.png" alt="Логотип ${esc(COMPANY_NAME)}"></div>
          <span class="brand-name">${esc(COMPANY_NAME)}</span>
        </div>

        ${CAN_VIEW_ORDERS ? `
        <div id="segmented" role="tablist">
          <div class="tab-indicator"></div>
          <button class="tab" role="tab" aria-selected="true" data-tab="products">Товары</button>
          <button class="tab" role="tab" aria-selected="false" data-tab="orders">Заказы</button>
        </div>` : "<div></div>"}

        <div id="userbox">
          <div class="user-chip">
            <div class="user-avatar">${esc((USER.fio || "Г")[0])}</div>
            <div class="user-text">
              <span class="user-name">${esc(USER.fio || "Гость")}</span>
              <span class="user-role">${esc(USER.roleLabel || "Гость")}</span>
            </div>
          </div>
          <button class="logout-btn" aria-label="${USER.role === "guest" ? "Войти" : "Выйти"}"
                  title="${USER.role === "guest" ? "Войти" : "Выйти"}">${ICON_LOGOUT}</button>
        </div>
      </div>

      <div class="products-view" style="display: contents">
        <h1 id="catalog-title" class="view-title">Товары</h1>

        ${CAN_FILTER_SORT_SEARCH ? `
        <div id="toolbar">
          <div class="search-box">
            ${ICON_SEARCH}
            <input class="search-input" id="product-search" type="search"
                   placeholder="Поиск по названию, артикулу, описанию…">
            <button class="search-clear hidden" id="product-search-clear"
                    aria-label="Очистить поиск">${ICON_CLEAR}</button>
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
          ${CAN_EDIT_PRODUCTS ? `<button class="accent-btn" id="add-product">+ Добавить товар</button>` : ""}
        </div>` : ""}

        <div class="empty-state hidden" id="product-empty">
          <span class="empty-title">Ничего не найдено</span>
          <span class="empty-hint">Измените запрос или сбросьте фильтры</span>
        </div>

        <div class="product-list" id="product-list"></div>
      </div>

      ${CAN_VIEW_ORDERS ? `
      <div class="orders-view" style="display: none">
        <h1 class="view-title centered">Заказы</h1>
        <div class="orders-toolbar">
          <div class="search-box">
            ${ICON_SEARCH}
            <input class="search-input" id="order-search" type="search" placeholder="Поиск по заказам…">
            <button class="search-clear hidden" id="order-search-clear"
                    aria-label="Очистить поиск">${ICON_CLEAR}</button>
          </div>
          ${CAN_EDIT_ORDERS ? `<button class="accent-btn" id="add-order">+ Добавить заказ</button>` : ""}
        </div>
        <div class="orders-scroll"><div class="orders-table" id="order-table"></div></div>
        <div class="empty-state hidden" id="order-empty">
          <span class="empty-title">Заказы не найдены</span>
          <span class="empty-hint">Измените поисковый запрос</span>
        </div>
      </div>` : ""}
    </div>`;

  const productsView = document.querySelector(".products-view");
  const ordersView = document.querySelector(".orders-view");
  const productList = document.getElementById("product-list");
  const productEmpty = document.getElementById("product-empty");
  const orderTable = document.getElementById("order-table");
  const orderEmpty = document.getElementById("order-empty");
  const segmented = document.getElementById("segmented");

  // ------------------------------------------------------------- загрузка
  async function reloadProducts() {
    const a = api();
    if (!a) return;
    state.items = (await a.get_products()) || [];
    renderMakerOptions();
    renderProducts();
  }

  async function reloadOrders() {
    const a = api();
    if (!a || !CAN_VIEW_ORDERS) return;
    state.orderItems = (await a.get_orders()) || [];
    renderOrders();
  }

  // ---------------------------------------------------------- фильтрация
  // Фильтрация/сортировка товаров — только клиентская сторона (как в исходном макете),
  // т.к. pywebview выполняет JS полностью. Для guest/client элементов управления нет,
  // поэтому query/maker/sort остаются в значениях по умолчанию и список не меняется.
  function visibleProducts() {
    const words = state.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let list = state.items.filter((r) => {
      if (state.maker !== "all" && r.maker !== state.maker) return false;
      if (!words.length) return true;
      const hay = [r.name, r.art, r.cat, r.desc, r.maker].join(" ").toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    if (state.sort !== "none") {
      const [key, dir] = state.sort.split("-");
      const mul = dir === "asc" ? 1 : -1;
      list = [...list].sort((x, y) => (Number(x[key]) - Number(y[key])) * mul);
    }
    return list;
  }

  function visibleOrders() {
    const words = state.orderQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return state.orderItems.filter((o) => {
      if (!words.length) return true;
      const hay = [o.num, o.arts, o.date, o.delivery, o.address, o.fio, o.code, o.status].join(" ").toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }

  // ------------------------------------------------------ отрисовка товаров
  function renderMakerOptions() {
    const select = document.getElementById("maker-select");
    if (!select) return;
    const makers = [...new Set(state.items.map((r) => r.maker).filter(Boolean))].sort();
    select.innerHTML = `<option value="all">Все производители</option>`
      + makers.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join("");
    select.value = makers.includes(state.maker) ? state.maker : "all";
    state.maker = select.value;
  }

  function renderProducts() {
    const list = visibleProducts();
    productEmpty.classList.toggle("hidden", state.loading || list.length !== 0);

    productList.innerHTML = list.map((r) => {
      const classes = ["product-card"];
      if (Number(r.disc) > 12) classes.push("high-discount");
      if (r.art === state.selected) classes.push("selected");
      return `
        <div class="${classes.join(" ")}" role="button" tabindex="0" data-art="${esc(r.art)}">
          <div class="product-photo" style="background-image: url('${esc(r.photo || PLACEHOLDER_PHOTO)}')"></div>
          <div class="product-info">
            <div class="product-head">
              <h2 class="product-name">${esc(r.name)}</h2>
              <span class="product-category">${esc(r.cat)}</span>
            </div>
            <span class="product-meta">Артикул ${esc(r.art)} · ${esc(r.maker)}</span>
            <p class="product-desc">${esc(r.desc)}</p>
          </div>
          <div class="product-side">
            <b class="product-price">${esc(Number(r.price).toLocaleString("ru-RU"))} ₽</b>
            <span class="product-stat">Остаток: ${esc(r.stock)} шт.</span>
            <span class="product-stat">Скидка: ${esc(r.disc)} %</span>
            ${CAN_EDIT_PRODUCTS ? `
            <div class="product-actions">
              <button class="icon-btn" data-action="edit-product" aria-label="Редактировать"
                      title="Редактировать">${iconEdit(17)}</button>
              <button class="icon-btn" data-action="delete-product" aria-label="Удалить"
                      title="Удалить">${iconDelete(17)}</button>
            </div>` : ""}
          </div>
        </div>`;
    }).join("");
  }

  // ----------------------------------------------------- отрисовка заказов
  function renderOrders() {
    if (!orderTable) return;
    const list = visibleOrders();
    orderEmpty.classList.toggle("hidden", list.length !== 0);

    const head = `
      <div class="order-row head">
        <div>Номер заказа</div><div>Артикул заказа</div><div>Дата заказа</div><div>Дата доставки</div>
        <div>Адрес пункта выдачи</div><div>ФИО авторизированного клиента</div>
        <div>Код для получения</div><div>Статус заказа</div>${CAN_EDIT_ORDERS ? "<div></div>" : ""}
      </div>`;

    orderTable.innerHTML = head + list.map((o) => `
      <div class="order-row body" data-num="${esc(o.num)}">
        <div class="num">${esc(o.num)}</div>
        <div class="num">${esc(o.arts)}</div>
        <div class="num">${esc(o.date)}</div>
        <div class="num">${esc(o.delivery)}</div>
        <div class="num">${esc(o.address)}</div>
        <div>${esc(o.fio)}</div>
        <div class="num">${esc(o.code)}</div>
        <div><span class="status${o.status === "Новый" ? " new" : ""}">${esc(o.status)}</span></div>
        ${CAN_EDIT_ORDERS ? `
        <div class="order-actions">
          <button class="icon-btn" data-action="edit-order" aria-label="Редактировать заказ"
                  title="Редактировать заказ">${iconEdit(16)}</button>
          <button class="icon-btn" data-action="delete-order" aria-label="Удалить заказ"
                  title="Удалить заказ">${iconDelete(16)}</button>
        </div>` : ""}
      </div>`).join("");
  }

  // ------------------------------------------------------------- вкладки
  function setTab(tab) {
    state.tab = tab;
    const isProducts = tab === "products";
    segmented.classList.toggle("orders-active", !isProducts);
    for (const button of segmented.querySelectorAll(".tab")) {
      button.setAttribute("aria-selected", String(button.dataset.tab === tab));
    }
    productsView.style.display = isProducts ? "contents" : "none";
    ordersView.style.display = isProducts ? "none" : "contents";
  }

  // ------------------------------------------------------------- модалка
  const PRODUCT_FIELDS = [
    { key: "name",  label: "Наименование",  type: "text",   wide: true },
    { key: "art",   label: "Артикул",       type: "text" },
    { key: "cat",   label: "Категория",     type: "text" },
    { key: "maker", label: "Производитель", type: "text" },
    { key: "price", label: "Цена, ₽",       type: "number" },
    { key: "disc",  label: "Скидка, %",     type: "number" },
    { key: "stock", label: "Остаток, шт.",  type: "number" },
  ];
  const ORDER_FIELDS = [
    { key: "arts",     label: "Артикул заказа (арт, кол-во, арт, кол-во…)", type: "text", wide: true },
    { key: "date",     label: "Дата заказа",    type: "date" },
    { key: "delivery", label: "Дата доставки",  type: "date" },
    { key: "address",  label: "Адрес пункта выдачи (№)", type: "number" },
    { key: "code",     label: "Код для получения", type: "text" },
    { key: "fio",      label: "ФИО авторизированного клиента", type: "text", wide: true },
  ];

  function closeModal() {
    const overlay = document.querySelector(".modal-overlay");
    if (overlay) overlay.remove();
  }

  function openModal(config) {
    closeModal();

    const form = config.form;
    const isProduct = config.entity === "product";
    const fields = isProduct ? PRODUCT_FIELDS : ORDER_FIELDS;
    const title = isProduct
      ? (config.mode === "edit" ? "Редактировать товар" : "Новый товар")
      : (config.mode === "edit" ? "Редактировать заказ" : "Новый заказ");

    const fieldsHtml = fields.map((f) => `
      <div class="modal-field${f.wide ? " wide" : ""}">
        <label class="modal-label">${esc(f.label)}</label>
        <input class="modal-input" type="${f.type}" data-key="${f.key}" value="${esc(form[f.key] ?? "")}">
      </div>`).join("");

    const statusHtml = isProduct ? "" : `
      <div class="modal-field">
        <label class="modal-label">Статус заказа</label>
        <select class="modal-input" data-key="status">
          <option value="Новый"${form.status === "Новый" ? " selected" : ""}>Новый</option>
          <option value="Завершен"${form.status === "Завершен" ? " selected" : ""}>Завершен</option>
        </select>
      </div>`;

    const productExtraHtml = !isProduct ? "" : `
      <div class="modal-field wide">
        <label class="modal-label">Описание</label>
        <textarea class="modal-textarea" rows="3" data-key="desc">${esc(form.desc ?? "")}</textarea>
      </div>
      <div class="photo-row">
        <div class="photo-preview" style="background-image: url('${esc(form.photo || PLACEHOLDER_PHOTO)}')"></div>
        <label class="photo-pick">Выбрать фото
          <input type="file" accept="image/*" hidden>
        </label>
        <button class="photo-clear${form.photo ? "" : " hidden"}">Убрать фото</button>
      </div>`;

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h2 class="modal-title">${esc(title)}</h2>
        <div class="modal-grid">${fieldsHtml}${statusHtml}${productExtraHtml}</div>
        <p class="modal-error"></p>
        <div class="modal-actions">
          <button class="modal-cancel">Отмена</button>
          <button class="modal-save">Сохранить</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const modal = overlay.querySelector(".modal");
    const errorText = overlay.querySelector(".modal-error");

    const setFormError = (message) => {
      errorText.textContent = message || "";
      errorText.classList.toggle("visible", Boolean(message));
    };

    // Значения полей пишем прямо в form — перерисовывать модалку не нужно.
    for (const input of modal.querySelectorAll("[data-key]")) {
      input.addEventListener("input", () => { form[input.dataset.key] = input.value; });
      input.addEventListener("change", () => { form[input.dataset.key] = input.value; });
    }

    if (isProduct) {
      const preview = modal.querySelector(".photo-preview");
      const clearButton = modal.querySelector(".photo-clear");

      modal.querySelector('input[type="file"]').addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          form.photo = reader.result;
          preview.style.backgroundImage = `url('${reader.result}')`;
          clearButton.classList.remove("hidden");
        };
        reader.readAsDataURL(file);
      });

      clearButton.addEventListener("click", () => {
        form.photo = "";
        preview.style.backgroundImage = `url('${PLACEHOLDER_PHOTO}')`;
        clearButton.classList.add("hidden");
      });
    }

    overlay.addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => e.stopPropagation());
    modal.querySelector(".modal-cancel").addEventListener("click", closeModal);

    modal.querySelector(".modal-save").addEventListener("click", async () => {
      if (isProduct) {
        if (!form.name || !form.name.trim() || !form.art || !form.art.trim()) {
          setFormError("Заполните наименование и артикул");
          return;
        }
        const payload = {
          art: form.art.trim(), name: form.name.trim(), cat: (form.cat || "").trim(),
          maker: (form.maker || "").trim(), price: Math.max(0, Number(form.price) || 0),
          disc: Math.max(0, Number(form.disc) || 0),
          stock: Math.max(0, Math.round(Number(form.stock) || 0)),
          desc: (form.desc || "").trim(), photo: form.photo || "",
        };
        const res = config.mode === "edit"
          ? await api().update_product(config.key, payload)
          : await api().create_product(payload);
        if (!res || !res.ok) { setFormError((res && res.error) || "Не удалось сохранить товар"); return; }
        await reloadProducts();
      } else {
        if (!form.fio || !form.fio.trim()) { setFormError("Укажите ФИО клиента"); return; }
        const payload = {
          arts: (form.arts || "").trim(), date: form.date || null, delivery: form.delivery || null,
          address: form.address ? Number(form.address) : null, fio: form.fio.trim(),
          code: (form.code || "").trim(), status: form.status || "Новый",
        };
        const res = config.mode === "edit"
          ? await api().update_order(config.key, payload)
          : await api().create_order(payload);
        if (!res || !res.ok) { setFormError((res && res.error) || "Не удалось сохранить заказ"); return; }
        await reloadOrders();
      }
      closeModal();
    });
  }

  // ------------------------------------------------------------ обработчики
  document.querySelector(".logout-btn").addEventListener("click", () => api().logout());

  if (segmented) {
    for (const button of segmented.querySelectorAll(".tab")) {
      button.addEventListener("click", () => setTab(button.dataset.tab));
    }
  }

  if (CAN_FILTER_SORT_SEARCH) {
    const search = document.getElementById("product-search");
    const clear = document.getElementById("product-search-clear");

    search.addEventListener("input", () => {
      state.query = search.value;
      clear.classList.toggle("hidden", state.query.length === 0);
      renderProducts();
    });
    clear.addEventListener("click", () => {
      state.query = "";
      search.value = "";
      clear.classList.add("hidden");
      renderProducts();
    });

    document.getElementById("maker-select").addEventListener("change", (e) => {
      state.maker = e.target.value;
      renderProducts();
    });
    document.getElementById("sort-select").addEventListener("change", (e) => {
      state.sort = e.target.value;
      renderProducts();
    });
  }

  if (CAN_EDIT_PRODUCTS) {
    document.getElementById("add-product").addEventListener("click", () => openModal({
      entity: "product", mode: "add",
      form: { name: "", art: "", cat: "", maker: "", price: "", disc: "", stock: "", desc: "", photo: "" },
    }));
  }

  // Делегирование: карточки пересоздаются при каждой перерисовке.
  productList.addEventListener("click", async (e) => {
    const card = e.target.closest(".product-card");
    if (!card) return;
    const product = state.items.find((r) => r.art === card.dataset.art);
    if (!product) return;

    const action = e.target.closest("[data-action]");
    if (action && action.dataset.action === "edit-product") {
      openModal({
        entity: "product", mode: "edit", key: product.art,
        form: {
          name: product.name, art: product.art, cat: product.cat, maker: product.maker,
          price: String(product.price), disc: String(product.disc), stock: String(product.stock),
          desc: product.desc, photo: product.photo || "",
        },
      });
      return;
    }
    if (action && action.dataset.action === "delete-product") {
      await api().delete_product(product.art);
      if (state.selected === product.art) state.selected = null;
      reloadProducts();
      return;
    }

    state.selected = state.selected === product.art ? null : product.art;
    renderProducts();
  });

  productList.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".product-card");
    if (!card) return;
    e.preventDefault();
    state.selected = state.selected === card.dataset.art ? null : card.dataset.art;
    renderProducts();
  });

  if (CAN_VIEW_ORDERS) {
    const search = document.getElementById("order-search");
    const clear = document.getElementById("order-search-clear");

    search.addEventListener("input", () => {
      state.orderQuery = search.value;
      clear.classList.toggle("hidden", state.orderQuery.length === 0);
      renderOrders();
    });
    clear.addEventListener("click", () => {
      state.orderQuery = "";
      search.value = "";
      clear.classList.add("hidden");
      renderOrders();
    });
  }

  if (CAN_EDIT_ORDERS) {
    document.getElementById("add-order").addEventListener("click", () => openModal({
      entity: "order", mode: "add",
      form: { arts: "", date: "", delivery: "", address: "", fio: "", code: "", status: "Новый" },
    }));

    orderTable.addEventListener("click", async (e) => {
      const action = e.target.closest("[data-action]");
      if (!action) return;
      const row = e.target.closest(".order-row");
      const order = state.orderItems.find((o) => String(o.num) === row.dataset.num);
      if (!order) return;

      if (action.dataset.action === "edit-order") {
        openModal({
          entity: "order", mode: "edit", key: order.num,
          form: {
            arts: order.arts, date: toIsoDate(order.date), delivery: toIsoDate(order.delivery),
            address: order.address, fio: order.fio, code: order.code, status: order.status,
          },
        });
      } else if (action.dataset.action === "delete-order") {
        await api().delete_order(order.num);
        reloadOrders();
      }
    });
  }

  window.PywebviewBridge.onPywebviewReady(async () => {
    await reloadProducts();
    await reloadOrders();
    state.loading = false;
    renderProducts();
  });
})();
