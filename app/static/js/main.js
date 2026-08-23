(function () {
  const { el, replaceChildren, icon } = window.Dom;

  const USER = window.__USER__ || { role: "guest", fio: "Гость", roleLabel: "Гость" };
  const { hasPermission } = window.Permissions;
  const CAN_FILTER_SORT_SEARCH = hasPermission(USER.role, "FILTER_SORT_SEARCH");
  const CAN_EDIT_PRODUCTS = hasPermission(USER.role, "EDIT_PRODUCTS");
  const CAN_VIEW_ORDERS = hasPermission(USER.role, "VIEW_ORDERS");
  const CAN_EDIT_ORDERS = hasPermission(USER.role, "EDIT_ORDERS");
  const DISCOUNT_HIGHLIGHT = "#F4A460";
  const COMPANY_NAME = "ООО «СтройМатериалы»";
  const PLACEHOLDER_PHOTO = "img/placeholder.png";

  const A1 = "#ffd9a8";   // accentStart
  const A2 = "#f5842e";    // accentEnd

  const NEUMO_RAISED = "8px 8px 20px rgba(174,174,192,0.35), -8px -8px 20px rgba(255,255,255,0.9)";
  const NEUMO_INSET = "inset 3px 3px 8px rgba(174,174,192,0.3), inset -3px -3px 8px rgba(255,255,255,0.7)";

  const ORDER_COLUMNS = CAN_EDIT_ORDERS
    ? "0.6fr 1.8fr 1fr 1fr 1fr 1.9fr 1.1fr 1fr 96px"
    : "0.6fr 1.8fr 1fr 1fr 1fr 1.9fr 1.1fr 1fr";

  const ICON_EDIT = ["M4 20 h16", "M14.5 4.5 a2.1 2.1 0 0 1 3 3 L8 17 l-4 1 1-4 z"];
  const ICON_DELETE = [
    "M4 7 h16", "M9 7 V5 a1 1 0 0 1 1 -1 h4 a1 1 0 0 1 1 1 v2",
    "M6.5 7 l1 13 a1 1 0 0 0 1 1 h7 a1 1 0 0 0 1 -1 l1 -13", "M10 11 v6 M14 11 v6",
  ];

  const iconButtonStyle = {
    width: 38, height: 38, border: "none", borderRadius: 12,
    background: "linear-gradient(145deg, #f6f6f9, #e9e9ec)",
    boxShadow: "4px 4px 10px rgba(174,174,192,0.35), -4px -4px 10px rgba(255,255,255,0.9)",
    cursor: "pointer", display: "grid", placeItems: "center",
  };
  const accentButtonStyle = {
    height: 48, border: "none", borderRadius: 999,
    background: "linear-gradient(180deg, #f79a4a, #f5842e)", color: "#fff",
    fontSize: 15, fontWeight: 600, padding: "0 26px", cursor: "pointer", fontFamily: "inherit",
    boxShadow: "0 8px 20px rgba(245,132,46,0.35), inset 0 1px 0 rgba(255,255,255,0.35)",
  };
  const searchInputStyle = {
    width: "100%", height: 48, border: "none", borderRadius: 999, background: "#ececef",
    boxShadow: NEUMO_INSET, padding: "0 44px 0 48px", fontSize: 15, color: "#1c1c1e",
    fontFamily: "inherit", outline: "none",
  };
  const selectStyle = {
    height: 48, border: "none", borderRadius: 999,
    background: "linear-gradient(145deg, #f6f6f9, #e9e9ec)", boxShadow: NEUMO_RAISED,
    padding: "0 20px", fontSize: 15, color: "#1c1c1e", fontFamily: "inherit",
    cursor: "pointer", outline: "none", appearance: "none",
  };
  const modalFieldStyle = {
    height: 44, border: "none", borderRadius: 14, background: "#ececef",
    boxShadow: "inset 2px 2px 6px rgba(174,174,192,0.3), inset -2px -2px 6px rgba(255,255,255,0.7)",
    padding: "0 16px", fontSize: 15, color: "#1c1c1e", fontFamily: "inherit", outline: "none",
  };
  const modalLabelStyle = { fontSize: 13, fontWeight: 600, color: "#8a8a8e", paddingLeft: 4 };
  const emptyStateStyle = {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
    padding: "64px 24px", color: "#8a8a8e",
  };

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

  const reloadProducts = async () => {
    const a = api();
    if (!a) return;
    state.items = (await a.get_products()) || [];
    renderMakerOptions();
    renderProducts();
  };
  const reloadOrders = async () => {
    const a = api();
    if (!a || !CAN_VIEW_ORDERS) return;
    state.orderItems = (await a.get_orders()) || [];
    renderOrders();
  };

  // ------------------------------------------------------------ фильтрация
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

  // -------------------------------------------------------------- топбар
  const tabIndicator = el("div", {
    style: {
      position: "absolute", top: 5, bottom: 5, left: 5, width: "calc(50% - 5px)", borderRadius: 999,
      background: "linear-gradient(180deg, #ffffff, #f2f2f5)",
      boxShadow: "0 3px 8px rgba(174,174,192,0.4), 0 1px 2px rgba(174,174,192,0.3)",
      transform: "translateX(0)", transition: "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
    },
  });

  const tabButtonStyle = (active) => ({
    position: "relative", zIndex: 1, flex: 1, border: "none", background: "transparent",
    fontSize: 17, color: active ? "#1c1c1e" : "#8a8a8e", fontWeight: active ? 600 : 400,
    borderRadius: 999, cursor: "pointer", transition: "color 0.25s ease", fontFamily: "inherit",
  });

  const productsTab = el("button", {
    role: "tab", "aria-selected": "true", onClick: () => setTab("products"),
    style: tabButtonStyle(true), text: "Товары",
  });
  const ordersTab = el("button", {
    role: "tab", "aria-selected": "false", onClick: () => setTab("orders"),
    style: tabButtonStyle(false), text: "Заказы",
  });

  const segmented = CAN_VIEW_ORDERS
    ? el("div", {
        id: "segmented", role: "tablist",
        style: {
          position: "relative", display: "flex", background: "#ececef", borderRadius: 999,
          boxShadow: NEUMO_INSET, padding: 5, width: 309, height: 42,
        },
      }, tabIndicator, productsTab, ordersTab)
    : el("div", {});

  const topbar = el("div", {
    id: "topbar",
    style: {
      display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center",
      paddingBottom: 22, borderBottom: "1px solid rgba(174,174,192,0.35)",
    },
  },
    el("div", { style: { justifySelf: "start", display: "flex", alignItems: "center", gap: 14 } },
      el("div", {
        style: {
          width: 48, height: 48, borderRadius: 14, background: "linear-gradient(145deg, #f6f6f9, #e9e9ec)",
          boxShadow: NEUMO_RAISED, display: "grid", placeItems: "center", flexShrink: 0, padding: 6,
        },
      },
        el("img", {
          src: "img/logo.png", alt: `Логотип ${COMPANY_NAME}`,
          style: { maxWidth: "100%", maxHeight: "100%", objectFit: "contain" },
        }),
      ),
      el("span", { style: { fontSize: 16, fontWeight: 700, letterSpacing: "-0.3px" }, text: COMPANY_NAME }),
    ),

    segmented,

    el("div", { id: "userbox", style: { justifySelf: "end", display: "flex", alignItems: "center", gap: 16 } },
      el("div", {
        style: {
          display: "flex", alignItems: "center", gap: 12,
          background: "linear-gradient(145deg, #f6f6f9, #e9e9ec)", borderRadius: 999,
          padding: "8px 20px 8px 8px", boxShadow: NEUMO_RAISED,
        },
      },
        el("div", {
          style: {
            width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(90deg, #ffd9a8, #f5842e)",
            display: "grid", placeItems: "center", fontSize: 16, fontWeight: 700, color: "#fff",
          },
          text: (USER.fio || "Г")[0],
        }),
        el("div", { style: { display: "flex", flexDirection: "column" } },
          el("span", { style: { fontSize: 15, fontWeight: 600 }, text: USER.fio || "Гость" }),
          el("span", { style: { fontSize: 13, color: "#8a8a8e" }, text: USER.roleLabel || "Гость" }),
        ),
      ),
      el("button", {
        "aria-label": USER.role === "guest" ? "Войти" : "Выйти",
        title: USER.role === "guest" ? "Войти" : "Выйти",
        onClick: async () => { await api().logout(); },
        style: {
          width: 53, height: 53, border: "none", borderRadius: 18,
          background: "linear-gradient(145deg, #f6f6f9, #e9e9ec)", boxShadow: NEUMO_RAISED,
          cursor: "pointer", display: "grid", placeItems: "center",
        },
      }, icon(["M14 4 H7 a2 2 0 0 0 -2 2 v12 a2 2 0 0 0 2 2 h7", "M11 12 h9", "M17 8.5 L20.5 12 L17 15.5"])),
    ),
  );

  function setTab(tab) {
    state.tab = tab;
    const isProducts = tab === "products";
    tabIndicator.style.transform = isProducts ? "translateX(0)" : "translateX(100%)";
    productsTab.setAttribute("aria-selected", String(isProducts));
    ordersTab.setAttribute("aria-selected", String(!isProducts));
    productsTab.style.color = isProducts ? "#1c1c1e" : "#8a8a8e";
    productsTab.style.fontWeight = isProducts ? 600 : 400;
    ordersTab.style.color = !isProducts ? "#1c1c1e" : "#8a8a8e";
    ordersTab.style.fontWeight = !isProducts ? 600 : 400;
    productsView.style.display = isProducts ? "contents" : "none";
    ordersView.style.display = !isProducts ? "contents" : "none";
  }

  // -------------------------------------------------------- поиск товаров
  const searchIcon = () => el("svg", {
    width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "#8a8a8e",
    "stroke-width": 2, "stroke-linecap": "round", "aria-hidden": "true",
    style: { position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" },
  }, el("circle", { cx: 11, cy: 11, r: 7 }), el("path", { d: "M20 20 l-3.5 -3.5" }));

  const clearButtonStyle = {
    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
    width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer",
    display: "grid", placeItems: "center", padding: 0,
  };

  const productSearch = el("input", {
    type: "search", placeholder: "Поиск по названию, артикулу, описанию…",
    onInput: (e) => {
      state.query = e.target.value;
      productSearchClear.style.display = state.query.length > 0 ? "grid" : "none";
      renderProducts();
    },
    style: searchInputStyle,
  });

  const productSearchClear = el("button", {
    "aria-label": "Очистить поиск",
    onClick: () => {
      state.query = "";
      productSearch.value = "";
      productSearchClear.style.display = "none";
      renderProducts();
    },
    style: Object.assign({}, clearButtonStyle, { display: "none" }),
  }, icon(["M6 6 L18 18 M18 6 L6 18"], { size: 15, sw: 2.6 }));

  const makerSelect = el("select", {
    "aria-label": "Производитель",
    onChange: (e) => { state.maker = e.target.value; renderProducts(); },
    style: Object.assign({}, selectStyle, { minWidth: 190 }),
  });

  function renderMakerOptions() {
    const makers = [...new Set(state.items.map((r) => r.maker).filter(Boolean))].sort();
    const current = state.maker;
    replaceChildren(makerSelect,
      el("option", { value: "all", text: "Все производители" }),
      makers.map((m) => el("option", { value: m, text: m })),
    );
    makerSelect.value = makers.includes(current) || current === "all" ? current : "all";
    state.maker = makerSelect.value;
  }

  const sortSelect = el("select", {
    "aria-label": "Сортировка",
    onChange: (e) => { state.sort = e.target.value; renderProducts(); },
    style: Object.assign({}, selectStyle, { minWidth: 210 }),
  },
    el("option", { value: "none", text: "Без сортировки" }),
    el("option", { value: "stock-asc", text: "Остаток: по возрастанию" }),
    el("option", { value: "stock-desc", text: "Остаток: по убыванию" }),
    el("option", { value: "price-asc", text: "Цена: по возрастанию" }),
    el("option", { value: "price-desc", text: "Цена: по убыванию" }),
    el("option", { value: "disc-asc", text: "Скидка: по возрастанию" }),
    el("option", { value: "disc-desc", text: "Скидка: по убыванию" }),
  );

  const toolbar = CAN_FILTER_SORT_SEARCH
    ? el("div", { id: "toolbar", style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 } },
        el("div", { style: { position: "relative", flex: "1 1 320px", minWidth: 240 } },
          searchIcon(), productSearch, productSearchClear,
        ),
        makerSelect,
        sortSelect,
        CAN_EDIT_PRODUCTS
          ? el("button", { onClick: openAddProduct, style: accentButtonStyle, text: "+ Добавить товар" })
          : null,
      )
    : null;

  // ------------------------------------------------------- список товаров
  const productListBox = el("div", { style: { display: "flex", flexDirection: "column", gap: 20 } });
  const productEmptyBox = el("div", { style: Object.assign({}, emptyStateStyle, { display: "none" }) },
    el("span", { style: { fontSize: 18, fontWeight: 600, color: "#3a3a3c" }, text: "Ничего не найдено" }),
    el("span", { style: { fontSize: 14 }, text: "Измените запрос или сбросьте фильтры" }),
  );

  function productCard(r) {
    const isSel = r.art === state.selected;
    const isHighDiscount = Number(r.disc) > 12;
    const select = () => {
      state.selected = state.selected === r.art ? null : r.art;
      renderProducts();
    };

    return el("div", {
      role: "button", tabindex: 0, onClick: select,
      onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(); } },
      style: {
        display: "flex", alignItems: "stretch", gap: 24, width: "100%",
        background: isHighDiscount ? DISCOUNT_HIGHLIGHT : "linear-gradient(145deg, #f6f6f9, #eeeef1)",
        borderRadius: 24, border: isSel ? "2px solid " + A2 : "2px solid transparent", padding: 18, cursor: "pointer",
        boxShadow: isSel ? NEUMO_RAISED + ", 0 0 0 4px " + A1 + "55" : NEUMO_RAISED,
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
      },
    },
      el("div", {
        style: {
          width: 200, minHeight: 140, flexShrink: 0, borderRadius: 16, backgroundColor: "#e3e3e6",
          backgroundImage: "url(" + (r.photo || PLACEHOLDER_PHOTO) + ")",
          backgroundSize: "cover", backgroundPosition: "center",
          boxShadow: "inset 2px 2px 6px rgba(174,174,192,0.25), inset -2px -2px 6px rgba(255,255,255,0.6)",
        },
      }),
      el("div", { style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 } },
        el("div", { style: { display: "flex", alignItems: "center", gap: 12 } },
          el("h2", { style: { fontSize: 20, fontWeight: 700, letterSpacing: "-0.3px", margin: 0 }, text: r.name }),
          el("span", {
            style: {
              fontSize: 12, fontWeight: 600, color: "#8a8a8e", background: "#ececef", borderRadius: 999,
              padding: "4px 12px",
              boxShadow: "inset 1px 1px 3px rgba(174,174,192,0.3), inset -1px -1px 3px rgba(255,255,255,0.7)",
              whiteSpace: "nowrap",
            },
            text: r.cat,
          }),
        ),
        el("span", { style: { fontSize: 13, color: "#8a8a8e" }, text: `Артикул ${r.art} · ${r.maker}` }),
        el("p", { style: { margin: 0, fontSize: 14, lineHeight: 1.45, color: "#3a3a3c", maxWidth: 720 }, text: r.desc }),
      ),
      el("div", {
        style: {
          display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center",
          gap: 6, flexShrink: 0, paddingLeft: 24, borderLeft: "1px solid rgba(174,174,192,0.3)",
        },
      },
        el("b", {
          style: { fontSize: 24, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },
          text: `${Number(r.price).toLocaleString("ru-RU")} ₽`,
        }),
        el("span", {
          style: { fontSize: 13, color: "#8a8a8e", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },
          text: `Остаток: ${r.stock} шт.`,
        }),
        el("span", {
          style: { fontSize: 13, color: "#8a8a8e", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },
          text: `Скидка: ${r.disc} %`,
        }),
        CAN_EDIT_PRODUCTS
          ? el("div", { style: { display: "flex", gap: 10, marginTop: 8 } },
              el("button", {
                "aria-label": "Редактировать", title: "Редактировать",
                onClick: (e) => { e.stopPropagation(); openEditProduct(r); },
                style: iconButtonStyle,
              }, icon(ICON_EDIT, { size: 17 })),
              el("button", {
                "aria-label": "Удалить", title: "Удалить",
                onClick: async (e) => {
                  e.stopPropagation();
                  await api().delete_product(r.art);
                  if (state.selected === r.art) state.selected = null;
                  reloadProducts();
                },
                style: iconButtonStyle,
              }, icon(ICON_DELETE, { size: 17, stroke: "#d0453c" })),
            )
          : null,
      ),
    );
  }

  function renderProducts() {
    const list = visibleProducts();
    productEmptyBox.style.display = !state.loading && list.length === 0 ? "flex" : "none";
    replaceChildren(productListBox, list.map(productCard));
  }

  // -------------------------------------------------------- поиск заказов
  const orderSearch = el("input", {
    type: "search", placeholder: "Поиск по заказам…",
    onInput: (e) => {
      state.orderQuery = e.target.value;
      orderSearchClear.style.display = state.orderQuery.length > 0 ? "grid" : "none";
      renderOrders();
    },
    style: searchInputStyle,
  });

  const orderSearchClear = el("button", {
    "aria-label": "Очистить поиск",
    onClick: () => {
      state.orderQuery = "";
      orderSearch.value = "";
      orderSearchClear.style.display = "none";
      renderOrders();
    },
    style: Object.assign({}, clearButtonStyle, { display: "none" }),
  }, icon(["M6 6 L18 18 M18 6 L6 18"], { size: 15, sw: 2.6 }));

  // -------------------------------------------------------- таблица заказов
  const orderRowsBox = el("div", {
    style: { display: "flex", flexDirection: "column", gap: 8, fontSize: 15, maxWidth: 1360, minWidth: 980, margin: "0 auto" },
  });
  const orderEmptyBox = el("div", { style: Object.assign({}, emptyStateStyle, { display: "none" }) },
    el("span", { style: { fontSize: 18, fontWeight: 600, color: "#3a3a3c" }, text: "Заказы не найдены" }),
    el("span", { style: { fontSize: 14 }, text: "Измените поисковый запрос" }),
  );

  const orderHeader = () => el("div", {
    style: {
      display: "grid", gridTemplateColumns: ORDER_COLUMNS, gap: 10, background: "#e7e7ea",
      borderRadius: 16, padding: "16px 20px", fontWeight: 600, textAlign: "center", alignItems: "center",
    },
  },
    el("div", { text: "Номер заказа" }), el("div", { text: "Артикул заказа" }),
    el("div", { text: "Дата заказа" }), el("div", { text: "Дата доставки" }),
    el("div", { text: "Адрес пункта выдачи" }), el("div", { text: "ФИО авторизированного клиента" }),
    el("div", { text: "Код для получения" }), el("div", { text: "Статус заказа" }),
    CAN_EDIT_ORDERS ? el("div", {}) : null,
  );

  function orderRow(o) {
    const num = { fontVariantNumeric: "tabular-nums" };
    return el("div", {
      style: {
        display: "grid", gridTemplateColumns: ORDER_COLUMNS, gap: 10, background: "#f0f0f3",
        borderRadius: 16, padding: "15px 20px", textAlign: "center", alignItems: "center",
      },
    },
      el("div", { style: num, text: o.num }),
      el("div", { style: num, text: o.arts }),
      el("div", { style: num, text: o.date }),
      el("div", { style: num, text: o.delivery }),
      el("div", { style: num, text: o.address }),
      el("div", { text: o.fio }),
      el("div", { style: num, text: o.code }),
      el("div", {},
        el("span", {
          style: {
            display: "inline-block", fontSize: 13, fontWeight: 600, borderRadius: 999, padding: "5px 14px",
            background: o.status === "Новый" ? "rgba(245,132,46,0.16)" : "rgba(31,138,91,0.13)",
            color: o.status === "Новый" ? "#c96a1a" : "#1f8a5b",
          },
          text: o.status,
        }),
      ),
      CAN_EDIT_ORDERS
        ? el("div", { style: { display: "flex", gap: 8, justifyContent: "center" } },
            el("button", {
              "aria-label": "Редактировать заказ", title: "Редактировать заказ",
              onClick: () => openEditOrder(o), style: iconButtonStyle,
            }, icon(ICON_EDIT, { size: 16 })),
            el("button", {
              "aria-label": "Удалить заказ", title: "Удалить заказ",
              onClick: async () => { await api().delete_order(o.num); reloadOrders(); },
              style: iconButtonStyle,
            }, icon(ICON_DELETE, { size: 16, stroke: "#d0453c" })),
          )
        : null,
    );
  }

  function renderOrders() {
    const list = visibleOrders();
    orderEmptyBox.style.display = list.length === 0 ? "flex" : "none";
    replaceChildren(orderRowsBox, orderHeader(), list.map(orderRow));
  }

  // -------------------------------------------------------------- модалка
  const PRODUCT_FIELDS = [
    { key: "name",  label: "Наименование",  type: "text",   span: "1 / -1" },
    { key: "art",   label: "Артикул",       type: "text",   span: "auto" },
    { key: "cat",   label: "Категория",     type: "text",   span: "auto" },
    { key: "maker", label: "Производитель", type: "text",   span: "auto" },
    { key: "price", label: "Цена, ₽",       type: "number", span: "auto" },
    { key: "disc",  label: "Скидка, %",     type: "number", span: "auto" },
    { key: "stock", label: "Остаток, шт.",  type: "number", span: "auto" },
  ];
  const ORDER_FIELDS = [
    { key: "arts",     label: "Артикул заказа (арт, кол-во, арт, кол-во…)", type: "text", span: "1 / -1" },
    { key: "date",     label: "Дата заказа",    type: "date", span: "auto" },
    { key: "delivery", label: "Дата доставки",  type: "date", span: "auto" },
    { key: "address",  label: "Адрес пункта выдачи (№)", type: "number", span: "auto" },
    { key: "code",     label: "Код для получения", type: "text", span: "auto" },
    { key: "fio",      label: "ФИО авторизированного клиента", type: "text", span: "1 / -1" },
  ];

  let modal = null; // { entity, mode, key, form, close() }

  function openAddProduct() {
    openModal({
      entity: "product", mode: "add",
      form: { name: "", art: "", cat: "", maker: "", price: "", disc: "", stock: "", desc: "", photo: "" },
    });
  }

  function openEditProduct(r) {
    openModal({
      entity: "product", mode: "edit", key: r.art,
      form: {
        name: r.name, art: r.art, cat: r.cat, maker: r.maker, price: String(r.price),
        disc: String(r.disc), stock: String(r.stock), desc: r.desc, photo: r.photo || "",
      },
    });
  }

  function openAddOrder() {
    openModal({
      entity: "order", mode: "add",
      form: { arts: "", date: "", delivery: "", address: "", fio: "", code: "", status: "Новый" },
    });
  }

  function openEditOrder(o) {
    openModal({
      entity: "order", mode: "edit", key: o.num,
      form: {
        arts: o.arts, date: toIsoDate(o.date), delivery: toIsoDate(o.delivery),
        address: o.address, fio: o.fio, code: o.code, status: o.status,
      },
    });
  }

  function closeModal() {
    if (!modal) return;
    modal.overlay.remove();
    modal = null;
  }

  function openModal(config) {
    closeModal();

    const form = config.form;
    const fields = config.entity === "product" ? PRODUCT_FIELDS : ORDER_FIELDS;

    const errorText = el("p", { style: { margin: 0, fontSize: 14, color: "#d0453c", display: "none" } });
    const setFormError = (message) => {
      errorText.textContent = message || "";
      errorText.style.display = message ? "block" : "none";
    };

    const fieldNodes = fields.map((f) => el("div", {
      style: { display: "flex", flexDirection: "column", gap: 6, gridColumn: f.span },
    },
      el("label", { style: modalLabelStyle, text: f.label }),
      el("input", {
        type: f.type, value: form[f.key] ?? "",
        onInput: (e) => { form[f.key] = e.target.value; },
        style: modalFieldStyle,
      }),
    ));

    const extraNodes = [];

    if (config.entity === "order") {
      const statusSelect = el("select", {
        onChange: (e) => { form.status = e.target.value; },
        style: modalFieldStyle,
      },
        el("option", { value: "Новый", text: "Новый" }),
        el("option", { value: "Завершен", text: "Завершен" }),
      );
      statusSelect.value = form.status ?? "Новый";
      extraNodes.push(el("div", { style: { display: "flex", flexDirection: "column", gap: 6, gridColumn: "auto" } },
        el("label", { style: modalLabelStyle, text: "Статус заказа" }),
        statusSelect,
      ));
    }

    if (config.entity === "product") {
      extraNodes.push(el("div", { style: { display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" } },
        el("label", { style: modalLabelStyle, text: "Описание" }),
        el("textarea", {
          rows: 3, onInput: (e) => { form.desc = e.target.value; },
          style: {
            border: "none", borderRadius: 14, background: "#ececef",
            boxShadow: "inset 2px 2px 6px rgba(174,174,192,0.3), inset -2px -2px 6px rgba(255,255,255,0.7)",
            padding: "12px 16px", fontSize: 15, color: "#1c1c1e", fontFamily: "inherit",
            outline: "none", resize: "vertical",
          },
          text: form.desc ?? "",
        }),
      ));

      const preview = el("div", {
        style: {
          width: 96, height: 68, flexShrink: 0, borderRadius: 14, backgroundColor: "#e3e3e6",
          backgroundImage: "url(" + (form.photo || PLACEHOLDER_PHOTO) + ")",
          backgroundSize: "cover", backgroundPosition: "center",
          boxShadow: "inset 2px 2px 6px rgba(174,174,192,0.3), inset -2px -2px 6px rgba(255,255,255,0.7)",
        },
      });

      const clearPhotoButton = el("button", {
        onClick: () => {
          form.photo = "";
          preview.style.backgroundImage = "url(" + PLACEHOLDER_PHOTO + ")";
          clearPhotoButton.style.display = "none";
        },
        style: {
          height: 42, border: "none", borderRadius: 999, background: "transparent", padding: "0 14px",
          fontSize: 14, fontWeight: 600, color: "#d0453c", cursor: "pointer", fontFamily: "inherit",
          display: form.photo ? "inline-block" : "none",
        },
        text: "Убрать фото",
      });

      extraNodes.push(el("div", { style: { display: "flex", alignItems: "center", gap: 14, gridColumn: "1 / -1" } },
        preview,
        el("label", {
          style: {
            height: 42, display: "inline-flex", alignItems: "center", borderRadius: 999,
            background: "linear-gradient(145deg, #f6f6f9, #e9e9ec)",
            boxShadow: "4px 4px 12px rgba(174,174,192,0.35), -4px -4px 12px rgba(255,255,255,0.9)",
            padding: "0 22px", fontSize: 14, fontWeight: 600, color: "#3a3a3c", cursor: "pointer",
          },
        },
          "Выбрать фото",
          el("input", {
            type: "file", accept: "image/*", style: { display: "none" },
            onChange: (e) => {
              const file = e.target.files && e.target.files[0];
              if (!file) return;
              const rd = new FileReader();
              rd.onload = () => {
                form.photo = rd.result;
                preview.style.backgroundImage = "url(" + rd.result + ")";
                clearPhotoButton.style.display = "inline-block";
              };
              rd.readAsDataURL(file);
            },
          }),
        ),
        clearPhotoButton,
      ));
    }

    const save = async () => {
      if (config.entity === "product") {
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
    };

    const title = config.entity === "product"
      ? (config.mode === "edit" ? "Редактировать товар" : "Новый товар")
      : (config.mode === "edit" ? "Редактировать заказ" : "Новый заказ");

    const dialog = el("div", {
      onClick: (e) => e.stopPropagation(), role: "dialog", "aria-modal": "true",
      style: {
        width: 540, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto",
        background: "linear-gradient(145deg, #f6f6f9, #eeeef1)", borderRadius: 28,
        boxShadow: "0 30px 80px rgba(30,30,50,0.35), inset 0 1px 0 rgba(255,255,255,0.9)",
        padding: 32, display: "flex", flexDirection: "column", gap: 20,
        animation: "modalIn 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
      el("h2", { style: { margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: "-0.4px" }, text: title }),
      el("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 } }, fieldNodes, extraNodes),
      errorText,
      el("div", { style: { display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 4 } },
        el("button", {
          onClick: closeModal,
          style: {
            height: 46, border: "none", borderRadius: 999,
            background: "linear-gradient(145deg, #f6f6f9, #e9e9ec)",
            boxShadow: "4px 4px 12px rgba(174,174,192,0.35), -4px -4px 12px rgba(255,255,255,0.9)",
            padding: "0 26px", fontSize: 15, fontWeight: 600, color: "#3a3a3c",
            cursor: "pointer", fontFamily: "inherit",
          },
          text: "Отмена",
        }),
        el("button", {
          onClick: save,
          style: {
            height: 46, border: "none", borderRadius: 999,
            background: "linear-gradient(180deg, #f79a4a, #f5842e)", color: "#fff",
            padding: "0 30px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            boxShadow: "0 8px 20px rgba(245,132,46,0.35), inset 0 1px 0 rgba(255,255,255,0.35)",
          },
          text: "Сохранить",
        }),
      ),
    );

    const overlay = el("div", {
      onClick: closeModal,
      style: {
        position: "fixed", inset: 0, zIndex: 100, background: "rgba(40,40,52,0.35)",
        backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        animation: "overlayIn 0.25s ease",
      },
    }, dialog);

    modal = { overlay };
    document.body.appendChild(overlay);
  }

  // ---------------------------------------------------------------- сборка
  const productsView = el("div", { style: { display: "contents" } },
    el("h1", { id: "catalog-title", style: { fontSize: 38, fontWeight: 700, letterSpacing: "-0.5px", margin: 0 }, text: "Товары" }),
    toolbar,
    productEmptyBox,
    productListBox,
  );

  const ordersView = CAN_VIEW_ORDERS
    ? el("div", { style: { display: "none" } },
        el("h1", { style: { fontSize: 38, fontWeight: 700, letterSpacing: "-0.5px", margin: 0, textAlign: "center" }, text: "Заказы" }),
        el("div", {
          style: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 16, width: "100%" },
        },
          el("div", { style: { position: "relative", width: "min(640px, 100%)" } },
            searchIcon(), orderSearch, orderSearchClear,
          ),
          CAN_EDIT_ORDERS
            ? el("button", { onClick: openAddOrder, style: accentButtonStyle, text: "+ Добавить заказ" })
            : null,
        ),
        el("div", { style: { width: "100%", overflowX: "auto" } }, orderRowsBox),
        orderEmptyBox,
      )
    : el("div", { style: { display: "none" } });

  const page = el("div", {
    style: {
      minHeight: "100vh", width: "100%",
      background: "linear-gradient(145deg, #f4f4f7, #ebebee)", color: "#1c1c1e",
      padding: "32px clamp(16px, 3vw, 56px) 56px", display: "flex", flexDirection: "column", gap: 28,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      WebkitFontSmoothing: "antialiased",
    },
  }, topbar, productsView, ordersView);

  document.getElementById("root").appendChild(page);

  window.PywebviewBridge.onPywebviewReady(async () => {
    await reloadProducts();
    await reloadOrders();
    state.loading = false;
    renderProducts();
  });
})();
