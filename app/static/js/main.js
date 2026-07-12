const { useState, useEffect } = React;

const USER = window.__USER__ || { role: "guest", fio: "Гость", roleLabel: "Гость" };
const { hasPermission } = window.Permissions;
const CAN_FILTER_SORT_SEARCH = hasPermission(USER.role, "FILTER_SORT_SEARCH");
const CAN_EDIT_PRODUCTS = hasPermission(USER.role, "EDIT_PRODUCTS");
const CAN_VIEW_ORDERS = hasPermission(USER.role, "VIEW_ORDERS");
const CAN_EDIT_ORDERS = hasPermission(USER.role, "EDIT_ORDERS");
const DISCOUNT_HIGHLIGHT = "#F4A460";

const A1 = "#ffd9a8";   // accentStart
const A2 = "#f5842e";    // accentEnd

const NEUMO_RAISED = "8px 8px 20px rgba(174,174,192,0.35), -8px -8px 20px rgba(255,255,255,0.9)";
const NEUMO_INSET = "inset 3px 3px 8px rgba(174,174,192,0.3), inset -3px -3px 8px rgba(255,255,255,0.7)";

function toIsoDate(ru) {
  if (!ru) return "";
  const [d, m, y] = ru.split(".");
  return d && m && y ? `${y}-${m}-${d}` : ru;
}

function Icon({ paths, size = 24, stroke = "#1c1c1e", sw = 1.8, fill = "none" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke}
         strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

function App() {
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("products");
  const [query, setQuery] = useState("");
  const [maker, setMaker] = useState("all");
  const [sort, setSort] = useState("none");
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(null); // { entity: 'product'|'order', mode: 'add'|'edit', key }
  const [form, setForm] = useState({});
  const [formError, setFormError] = useState("");
  const [orderQuery, setOrderQuery] = useState("");
  const [orderItems, setOrderItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const api = () => window.pywebview && window.pywebview.api;

  const reloadProducts = async () => {
    const a = api();
    if (!a) return;
    const res = await a.get_products();
    setItems(res || []);
  };
  const reloadOrders = async () => {
    const a = api();
    if (!a || !CAN_VIEW_ORDERS) return;
    const res = await a.get_orders();
    setOrderItems(res || []);
  };

  useEffect(() => {
    const boot = async () => {
      await reloadProducts();
      await reloadOrders();
      setLoading(false);
    };
    if (window.pywebview) boot();
    else window.addEventListener("pywebviewready", boot, { once: true });
  }, []);

  const isProducts = tab === "products";

  // Фильтрация/сортировка товаров — только клиентская сторона (как в исходном макете),
  // т.к. pywebview выполняет JS полностью. Для guest/client элементов управления нет,
  // поэтому query/maker/sort остаются в значениях по умолчанию и список не меняется.
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let list = items.filter((r) => {
    if (maker !== "all" && r.maker !== maker) return false;
    if (!words.length) return true;
    const hay = [r.name, r.art, r.cat, r.desc, r.maker].join(" ").toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  if (sort !== "none") {
    const [key, dir] = sort.split("-");
    const mul = dir === "asc" ? 1 : -1;
    list = [...list].sort((x, y) => (Number(x[key]) - Number(y[key])) * mul);
  }
  const makers = [...new Set(items.map((r) => r.maker).filter(Boolean))].sort();

  const oWords = orderQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const orderList = orderItems.filter((o) => {
    if (!oWords.length) return true;
    const hay = [o.num, o.arts, o.date, o.delivery, o.address, o.fio, o.code, o.status].join(" ").toLowerCase();
    return oWords.every((w) => hay.includes(w));
  });

  const productFdefs = [
    { key: "name",  label: "Наименование",  type: "text",   span: "1 / -1" },
    { key: "art",   label: "Артикул",       type: "text",   span: "auto" },
    { key: "cat",   label: "Категория",     type: "text",   span: "auto" },
    { key: "maker", label: "Производитель", type: "text",   span: "auto" },
    { key: "price", label: "Цена, ₽",       type: "number", span: "auto" },
    { key: "disc",  label: "Скидка, %",     type: "number", span: "auto" },
    { key: "stock", label: "Остаток, шт.",  type: "number", span: "auto" },
  ];
  const orderFdefs = [
    { key: "arts",     label: "Артикул заказа (арт, кол-во, арт, кол-во…)", type: "text", span: "1 / -1" },
    { key: "date",     label: "Дата заказа",    type: "date", span: "auto" },
    { key: "delivery", label: "Дата доставки",  type: "date", span: "auto" },
    { key: "address",  label: "Адрес пункта выдачи (№)", type: "number", span: "auto" },
    { key: "code",     label: "Код для получения", type: "text", span: "auto" },
    { key: "fio",       label: "ФИО авторизированного клиента", type: "text", span: "1 / -1" },
  ];

  const openAddProduct = () => {
    setModal({ entity: "product", mode: "add" }); setFormError("");
    setForm({ name: "", art: "", cat: "", maker: "", price: "", disc: "", stock: "", desc: "", photo: "" });
  };
  const openEditProduct = (r) => {
    setModal({ entity: "product", mode: "edit", key: r.art }); setFormError("");
    setForm({ name: r.name, art: r.art, cat: r.cat, maker: r.maker, price: String(r.price), disc: String(r.disc), stock: String(r.stock), desc: r.desc, photo: r.photo || "" });
  };
  const removeProduct = async (r) => {
    await api().delete_product(r.art);
    if (selected === r.art) setSelected(null);
    reloadProducts();
  };

  const openAddOrder = () => {
    setModal({ entity: "order", mode: "add" }); setFormError("");
    setForm({ arts: "", date: "", delivery: "", address: "", fio: "", code: "", status: "Новый" });
  };
  const openEditOrder = (o) => {
    setModal({ entity: "order", mode: "edit", key: o.num }); setFormError("");
    setForm({ arts: o.arts, date: toIsoDate(o.date), delivery: toIsoDate(o.delivery), address: o.address, fio: o.fio, code: o.code, status: o.status });
  };
  const removeOrder = async (o) => {
    await api().delete_order(o.num);
    reloadOrders();
  };

  const onPhoto = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => setForm((f) => ({ ...f, photo: rd.result }));
    rd.readAsDataURL(file);
  };

  const saveForm = async () => {
    const f = form;
    if (modal.entity === "product") {
      if (!f.name || !f.name.trim() || !f.art || !f.art.trim()) {
        setFormError("Заполните наименование и артикул"); return;
      }
      const payload = {
        art: f.art.trim(), name: f.name.trim(), cat: (f.cat || "").trim(), maker: (f.maker || "").trim(),
        price: Math.max(0, Number(f.price) || 0), disc: Math.max(0, Number(f.disc) || 0),
        stock: Math.max(0, Math.round(Number(f.stock) || 0)), desc: (f.desc || "").trim(), photo: f.photo || "",
      };
      const res = modal.mode === "edit"
        ? await api().update_product(modal.key, payload)
        : await api().create_product(payload);
      if (!res || !res.ok) { setFormError((res && res.error) || "Не удалось сохранить товар"); return; }
      await reloadProducts();
    } else {
      if (!f.fio || !f.fio.trim()) { setFormError("Укажите ФИО клиента"); return; }
      const payload = {
        arts: (f.arts || "").trim(), date: f.date || null, delivery: f.delivery || null,
        address: f.address ? Number(f.address) : null, fio: f.fio.trim(), code: (f.code || "").trim(),
        status: f.status || "Новый",
      };
      const res = modal.mode === "edit"
        ? await api().update_order(modal.key, payload)
        : await api().create_order(payload);
      if (!res || !res.ok) { setFormError((res && res.error) || "Не удалось сохранить заказ"); return; }
      await reloadOrders();
    }
    setModal(null); setFormError("");
  };

  const logout = async () => { await api().logout(); };

  const pageStyle = {
    minHeight: "100vh", width: "100%",
    background: "linear-gradient(145deg, #f4f4f7, #ebebee)", color: "#1c1c1e",
    padding: "32px clamp(16px, 3vw, 56px) 56px", display: "flex", flexDirection: "column", gap: 28,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    WebkitFontSmoothing: "antialiased",
  };

  return (
    <div style={pageStyle}>
      {/* Topbar */}
      <div id="topbar" style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", paddingBottom: 22, borderBottom: "1px solid rgba(174,174,192,0.35)" }}>
        <div style={{ justifySelf: "start", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(145deg, #f6f6f9, #e9e9ec)", boxShadow: NEUMO_RAISED, display: "grid", placeItems: "center", flexShrink: 0, padding: 6 }}>
            <img src="img/logo.png" alt="Логотип ООО «СтройМатериалы»" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.3px" }}>ООО «СтройМатериалы»</span>
        </div>

        {CAN_VIEW_ORDERS ? (
          <div id="segmented" role="tablist" style={{ position: "relative", display: "flex", background: "#ececef", borderRadius: 999, boxShadow: NEUMO_INSET, padding: 5, width: 309, height: 42 }}>
            <div style={{ position: "absolute", top: 5, bottom: 5, left: 5, width: "calc(50% - 5px)", borderRadius: 999, background: "linear-gradient(180deg, #ffffff, #f2f2f5)", boxShadow: "0 3px 8px rgba(174,174,192,0.4), 0 1px 2px rgba(174,174,192,0.3)", transform: isProducts ? "translateX(0)" : "translateX(100%)", transition: "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)" }} />
            <button role="tab" aria-selected={isProducts} onClick={() => setTab("products")} style={{ position: "relative", zIndex: 1, flex: 1, border: "none", background: "transparent", fontSize: 17, color: isProducts ? "#1c1c1e" : "#8a8a8e", fontWeight: isProducts ? 600 : 400, borderRadius: 999, cursor: "pointer", transition: "color 0.25s ease", fontFamily: "inherit" }}>Товары</button>
            <button role="tab" aria-selected={!isProducts} onClick={() => setTab("orders")} style={{ position: "relative", zIndex: 1, flex: 1, border: "none", background: "transparent", fontSize: 17, color: !isProducts ? "#1c1c1e" : "#8a8a8e", fontWeight: !isProducts ? 600 : 400, borderRadius: 999, cursor: "pointer", transition: "color 0.25s ease", fontFamily: "inherit" }}>Заказы</button>
          </div>
        ) : <div />}

        <div id="userbox" style={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "linear-gradient(145deg, #f6f6f9, #e9e9ec)", borderRadius: 999, padding: "8px 20px 8px 8px", boxShadow: NEUMO_RAISED }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(90deg, #ffd9a8, #f5842e)", display: "grid", placeItems: "center", fontSize: 16, fontWeight: 700, color: "#fff" }}>{(USER.fio || "Г")[0]}</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{USER.fio || "Гость"}</span>
              <span style={{ fontSize: 13, color: "#8a8a8e" }}>{USER.roleLabel || "Гость"}</span>
            </div>
          </div>
          <button aria-label={USER.role === "guest" ? "Войти" : "Выйти"} title={USER.role === "guest" ? "Войти" : "Выйти"} onClick={logout} style={{ width: 53, height: 53, border: "none", borderRadius: 18, background: "linear-gradient(145deg, #f6f6f9, #e9e9ec)", boxShadow: NEUMO_RAISED, cursor: "pointer", display: "grid", placeItems: "center" }}>
            <Icon paths={["M14 4 H7 a2 2 0 0 0 -2 2 v12 a2 2 0 0 0 2 2 h7", "M11 12 h9", "M17 8.5 L20.5 12 L17 15.5"]} />
          </button>
        </div>
      </div>

      {/* Products view */}
      {isProducts && (
        <>
          <h1 id="catalog-title" style={{ fontSize: 38, fontWeight: 700, letterSpacing: "-0.5px", margin: 0 }}>Товары</h1>

          {CAN_FILTER_SORT_SEARCH && (
            <div id="toolbar" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
              <div style={{ position: "relative", flex: "1 1 320px", minWidth: 240 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8a8a8e" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                  <circle cx="11" cy="11" r="7" /><path d="M20 20 l-3.5 -3.5" />
                </svg>
                <input type="search" placeholder="Поиск по названию, артикулу, описанию…" value={query} onChange={(e) => setQuery(e.target.value)}
                  style={{ width: "100%", height: 48, border: "none", borderRadius: 999, background: "#ececef", boxShadow: NEUMO_INSET, padding: "0 44px 0 48px", fontSize: 15, color: "#1c1c1e", fontFamily: "inherit", outline: "none" }} />
                {query.length > 0 && (
                  <button onClick={() => setQuery("")} aria-label="Очистить поиск" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer", display: "grid", placeItems: "center", padding: 0 }}>
                    <Icon size={15} sw={2.6} paths={["M6 6 L18 18 M18 6 L6 18"]} />
                  </button>
                )}
              </div>

              <select aria-label="Производитель" value={maker} onChange={(e) => setMaker(e.target.value)}
                style={{ height: 48, border: "none", borderRadius: 999, background: "linear-gradient(145deg, #f6f6f9, #e9e9ec)", boxShadow: NEUMO_RAISED, padding: "0 20px", fontSize: 15, color: "#1c1c1e", fontFamily: "inherit", cursor: "pointer", outline: "none", appearance: "none", minWidth: 190 }}>
                <option value="all">Все производители</option>
                {makers.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>

              <select aria-label="Сортировка" value={sort} onChange={(e) => setSort(e.target.value)}
                style={{ height: 48, border: "none", borderRadius: 999, background: "linear-gradient(145deg, #f6f6f9, #e9e9ec)", boxShadow: NEUMO_RAISED, padding: "0 20px", fontSize: 15, color: "#1c1c1e", fontFamily: "inherit", cursor: "pointer", outline: "none", appearance: "none", minWidth: 210 }}>
                <option value="none">Без сортировки</option>
                <option value="stock-asc">Остаток: по возрастанию</option>
                <option value="stock-desc">Остаток: по убыванию</option>
                <option value="price-asc">Цена: по возрастанию</option>
                <option value="price-desc">Цена: по убыванию</option>
                <option value="disc-asc">Скидка: по возрастанию</option>
                <option value="disc-desc">Скидка: по убыванию</option>
              </select>

              {CAN_EDIT_PRODUCTS && (
                <button onClick={openAddProduct} style={{ height: 48, border: "none", borderRadius: 999, background: "linear-gradient(180deg, #f79a4a, #f5842e)", color: "#fff", fontSize: 15, fontWeight: 600, padding: "0 26px", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 8px 20px rgba(245,132,46,0.35), inset 0 1px 0 rgba(255,255,255,0.35)" }}>+ Добавить товар</button>
              )}
            </div>
          )}

          {!loading && list.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "64px 24px", color: "#8a8a8e" }}>
              <span style={{ fontSize: 18, fontWeight: 600, color: "#3a3a3c" }}>Ничего не найдено</span>
              <span style={{ fontSize: 14 }}>Измените запрос или сбросьте фильтры</span>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {list.map((r) => {
              const isSel = r.art === selected;
              const isHighDiscount = Number(r.disc) > 12;
              const select = () => setSelected(selected === r.art ? null : r.art);
              const cardBg = isHighDiscount ? DISCOUNT_HIGHLIGHT : "linear-gradient(145deg, #f6f6f9, #eeeef1)";
              return (
                <div key={r.art} role="button" tabIndex={0} onClick={select}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(); } }}
                  style={{ display: "flex", alignItems: "stretch", gap: 24, width: "100%", background: cardBg, borderRadius: 24, border: isSel ? "2px solid " + A2 : "2px solid transparent", padding: 18, cursor: "pointer",
                    boxShadow: isSel ? NEUMO_RAISED + ", 0 0 0 4px " + A1 + "55" : NEUMO_RAISED, transition: "transform 0.2s ease, box-shadow 0.2s ease" }}>
                  <div style={{ width: 200, minHeight: 140, flexShrink: 0, borderRadius: 16, backgroundColor: "#e3e3e6", backgroundImage: r.photo ? "url(" + r.photo + ")" : "none", backgroundSize: "cover", backgroundPosition: "center", boxShadow: "inset 2px 2px 6px rgba(174,174,192,0.25), inset -2px -2px 6px rgba(255,255,255,0.6)", display: "grid", placeItems: "center" }}>
                    <span style={{ fontSize: 14, color: "#8a8a8e" }}>{r.photo ? "" : "Нет фото"}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.3px", margin: 0 }}>{r.name}</h2>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#8a8a8e", background: "#ececef", borderRadius: 999, padding: "4px 12px", boxShadow: "inset 1px 1px 3px rgba(174,174,192,0.3), inset -1px -1px 3px rgba(255,255,255,0.7)", whiteSpace: "nowrap" }}>{r.cat}</span>
                    </div>
                    <span style={{ fontSize: 13, color: "#8a8a8e" }}>Артикул {r.art} · {r.maker}</span>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, color: "#3a3a3c", maxWidth: 720 }}>{r.desc}</p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center", gap: 6, flexShrink: 0, paddingLeft: 24, borderLeft: "1px solid rgba(174,174,192,0.3)" }}>
                    <b style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{Number(r.price).toLocaleString("ru-RU")} ₽</b>
                    <span style={{ fontSize: 13, color: "#8a8a8e", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>Остаток: {r.stock} шт.</span>
                    <span style={{ fontSize: 13, color: "#8a8a8e", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>Скидка: {r.disc} %</span>
                    {CAN_EDIT_PRODUCTS && (
                      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                        <button aria-label="Редактировать" title="Редактировать" onClick={(e) => { e.stopPropagation(); openEditProduct(r); }} style={{ width: 38, height: 38, border: "none", borderRadius: 12, background: "linear-gradient(145deg, #f6f6f9, #e9e9ec)", boxShadow: "4px 4px 10px rgba(174,174,192,0.35), -4px -4px 10px rgba(255,255,255,0.9)", cursor: "pointer", display: "grid", placeItems: "center" }}>
                          <Icon size={17} paths={["M4 20 h16", "M14.5 4.5 a2.1 2.1 0 0 1 3 3 L8 17 l-4 1 1-4 z"]} />
                        </button>
                        <button aria-label="Удалить" title="Удалить" onClick={(e) => { e.stopPropagation(); removeProduct(r); }} style={{ width: 38, height: 38, border: "none", borderRadius: 12, background: "linear-gradient(145deg, #f6f6f9, #e9e9ec)", boxShadow: "4px 4px 10px rgba(174,174,192,0.35), -4px -4px 10px rgba(255,255,255,0.9)", cursor: "pointer", display: "grid", placeItems: "center" }}>
                          <Icon size={17} stroke="#d0453c" paths={["M4 7 h16", "M9 7 V5 a1 1 0 0 1 1 -1 h4 a1 1 0 0 1 1 1 v2", "M6.5 7 l1 13 a1 1 0 0 0 1 1 h7 a1 1 0 0 0 1 -1 l1 -13", "M10 11 v6 M14 11 v6"]} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Orders view */}
      {!isProducts && CAN_VIEW_ORDERS && (
        <>
          <h1 style={{ fontSize: 38, fontWeight: 700, letterSpacing: "-0.5px", margin: 0, textAlign: "center" }}>Заказы</h1>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 16, width: "100%" }}>
            <div style={{ position: "relative", width: "min(640px, 100%)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8a8a8e" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                <circle cx="11" cy="11" r="7" /><path d="M20 20 l-3.5 -3.5" />
              </svg>
              <input type="search" placeholder="Поиск по заказам…" value={orderQuery} onChange={(e) => setOrderQuery(e.target.value)}
                style={{ width: "100%", height: 48, border: "none", borderRadius: 999, background: "#ececef", boxShadow: NEUMO_INSET, padding: "0 44px 0 48px", fontSize: 15, color: "#1c1c1e", fontFamily: "inherit", outline: "none" }} />
              {orderQuery.length > 0 && (
                <button onClick={() => setOrderQuery("")} aria-label="Очистить поиск" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer", display: "grid", placeItems: "center", padding: 0 }}>
                  <Icon size={15} sw={2.6} paths={["M6 6 L18 18 M18 6 L6 18"]} />
                </button>
              )}
            </div>
            {CAN_EDIT_ORDERS && (
              <button onClick={openAddOrder} style={{ height: 48, border: "none", borderRadius: 999, background: "linear-gradient(180deg, #f79a4a, #f5842e)", color: "#fff", fontSize: 15, fontWeight: 600, padding: "0 26px", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 8px 20px rgba(245,132,46,0.35), inset 0 1px 0 rgba(255,255,255,0.35)" }}>+ Добавить заказ</button>
            )}
          </div>

          <div style={{ width: "100%", overflowX: "auto" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 15, maxWidth: 1360, minWidth: 980, margin: "0 auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: CAN_EDIT_ORDERS ? "0.6fr 1.8fr 1fr 1fr 1fr 1.9fr 1.1fr 1fr 96px" : "0.6fr 1.8fr 1fr 1fr 1fr 1.9fr 1.1fr 1fr", gap: 10, background: "#e7e7ea", borderRadius: 16, padding: "16px 20px", fontWeight: 600, textAlign: "center", alignItems: "center" }}>
                <div>Номер заказа</div><div>Артикул заказа</div><div>Дата заказа</div><div>Дата доставки</div><div>Адрес пункта выдачи</div><div>ФИО авторизированного клиента</div><div>Код для получения</div><div>Статус заказа</div>{CAN_EDIT_ORDERS && <div></div>}
              </div>
              {orderList.map((o) => (
                <div key={o.num} style={{ display: "grid", gridTemplateColumns: CAN_EDIT_ORDERS ? "0.6fr 1.8fr 1fr 1fr 1fr 1.9fr 1.1fr 1fr 96px" : "0.6fr 1.8fr 1fr 1fr 1fr 1.9fr 1.1fr 1fr", gap: 10, background: "#f0f0f3", borderRadius: 16, padding: "15px 20px", textAlign: "center", alignItems: "center" }}>
                  <div style={{ fontVariantNumeric: "tabular-nums" }}>{o.num}</div>
                  <div style={{ fontVariantNumeric: "tabular-nums" }}>{o.arts}</div>
                  <div style={{ fontVariantNumeric: "tabular-nums" }}>{o.date}</div>
                  <div style={{ fontVariantNumeric: "tabular-nums" }}>{o.delivery}</div>
                  <div style={{ fontVariantNumeric: "tabular-nums" }}>{o.address}</div>
                  <div>{o.fio}</div>
                  <div style={{ fontVariantNumeric: "tabular-nums" }}>{o.code}</div>
                  <div><span style={{ display: "inline-block", fontSize: 13, fontWeight: 600, borderRadius: 999, padding: "5px 14px", background: o.status === "Новый" ? "rgba(245,132,46,0.16)" : "rgba(31,138,91,0.13)", color: o.status === "Новый" ? "#c96a1a" : "#1f8a5b" }}>{o.status}</span></div>
                  {CAN_EDIT_ORDERS && (
                    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                      <button aria-label="Редактировать заказ" title="Редактировать заказ" onClick={() => openEditOrder(o)} style={{ width: 38, height: 38, border: "none", borderRadius: 12, background: "linear-gradient(145deg, #f6f6f9, #e9e9ec)", boxShadow: "4px 4px 10px rgba(174,174,192,0.35), -4px -4px 10px rgba(255,255,255,0.9)", cursor: "pointer", display: "grid", placeItems: "center" }}>
                        <Icon size={16} paths={["M4 20 h16", "M14.5 4.5 a2.1 2.1 0 0 1 3 3 L8 17 l-4 1 1-4 z"]} />
                      </button>
                      <button aria-label="Удалить заказ" title="Удалить заказ" onClick={() => removeOrder(o)} style={{ width: 38, height: 38, border: "none", borderRadius: 12, background: "linear-gradient(145deg, #f6f6f9, #e9e9ec)", boxShadow: "4px 4px 10px rgba(174,174,192,0.35), -4px -4px 10px rgba(255,255,255,0.9)", cursor: "pointer", display: "grid", placeItems: "center" }}>
                        <Icon size={16} stroke="#d0453c" paths={["M4 7 h16", "M9 7 V5 a1 1 0 0 1 1 -1 h4 a1 1 0 0 1 1 1 v2", "M6.5 7 l1 13 a1 1 0 0 0 1 1 h7 a1 1 0 0 0 1 -1 l1 -13", "M10 11 v6 M14 11 v6"]} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {orderList.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "64px 24px", color: "#8a8a8e" }}>
              <span style={{ fontSize: 18, fontWeight: 600, color: "#3a3a3c" }}>Заказы не найдены</span>
              <span style={{ fontSize: 14 }}>Измените поисковый запрос</span>
            </div>
          )}
        </>
      )}

      {/* Modal (product or order) */}
      {modal && (
        <div onClick={() => setModal(null)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(40,40,52,0.35)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "overlayIn 0.25s ease" }}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{ width: 540, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", background: "linear-gradient(145deg, #f6f6f9, #eeeef1)", borderRadius: 28, boxShadow: "0 30px 80px rgba(30,30,50,0.35), inset 0 1px 0 rgba(255,255,255,0.9)", padding: 32, display: "flex", flexDirection: "column", gap: 20, animation: "modalIn 0.3s cubic-bezier(0.22, 1, 0.36, 1)" }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: "-0.4px" }}>
              {modal.entity === "product"
                ? (modal.mode === "edit" ? "Редактировать товар" : "Новый товар")
                : (modal.mode === "edit" ? "Редактировать заказ" : "Новый заказ")}
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {(modal.entity === "product" ? productFdefs : orderFdefs).map((f) => (
                <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: f.span }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#8a8a8e", paddingLeft: 4 }}>{f.label}</label>
                  <input type={f.type} value={form[f.key] ?? ""} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                    style={{ height: 44, border: "none", borderRadius: 14, background: "#ececef", boxShadow: "inset 2px 2px 6px rgba(174,174,192,0.3), inset -2px -2px 6px rgba(255,255,255,0.7)", padding: "0 16px", fontSize: 15, color: "#1c1c1e", fontFamily: "inherit", outline: "none" }} />
                </div>
              ))}

              {modal.entity === "order" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "auto" }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#8a8a8e", paddingLeft: 4 }}>Статус заказа</label>
                  <select value={form.status ?? "Новый"} onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}
                    style={{ height: 44, border: "none", borderRadius: 14, background: "#ececef", boxShadow: "inset 2px 2px 6px rgba(174,174,192,0.3), inset -2px -2px 6px rgba(255,255,255,0.7)", padding: "0 16px", fontSize: 15, color: "#1c1c1e", fontFamily: "inherit", outline: "none" }}>
                    <option value="Новый">Новый</option>
                    <option value="Завершен">Завершен</option>
                  </select>
                </div>
              )}

              {modal.entity === "product" && (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#8a8a8e", paddingLeft: 4 }}>Описание</label>
                    <textarea value={form.desc ?? ""} onChange={(e) => setForm((s) => ({ ...s, desc: e.target.value }))} rows={3}
                      style={{ border: "none", borderRadius: 14, background: "#ececef", boxShadow: "inset 2px 2px 6px rgba(174,174,192,0.3), inset -2px -2px 6px rgba(255,255,255,0.7)", padding: "12px 16px", fontSize: 15, color: "#1c1c1e", fontFamily: "inherit", outline: "none", resize: "vertical" }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, gridColumn: "1 / -1" }}>
                    <div style={{ width: 96, height: 68, flexShrink: 0, borderRadius: 14, backgroundColor: "#e3e3e6", backgroundImage: form.photo ? "url(" + form.photo + ")" : "none", backgroundSize: "cover", backgroundPosition: "center", boxShadow: "inset 2px 2px 6px rgba(174,174,192,0.3), inset -2px -2px 6px rgba(255,255,255,0.7)", display: "grid", placeItems: "center" }}>
                      <span style={{ fontSize: 12, color: "#8a8a8e" }}>{form.photo ? "" : "Нет фото"}</span>
                    </div>
                    <label style={{ height: 42, display: "inline-flex", alignItems: "center", borderRadius: 999, background: "linear-gradient(145deg, #f6f6f9, #e9e9ec)", boxShadow: "4px 4px 12px rgba(174,174,192,0.35), -4px -4px 12px rgba(255,255,255,0.9)", padding: "0 22px", fontSize: 14, fontWeight: 600, color: "#3a3a3c", cursor: "pointer" }}>
                      Выбрать фото
                      <input type="file" accept="image/*" onChange={onPhoto} style={{ display: "none" }} />
                    </label>
                    {!!form.photo && (
                      <button onClick={() => setForm((s) => ({ ...s, photo: "" }))} style={{ height: 42, border: "none", borderRadius: 999, background: "transparent", padding: "0 14px", fontSize: 14, fontWeight: 600, color: "#d0453c", cursor: "pointer", fontFamily: "inherit" }}>Убрать фото</button>
                    )}
                  </div>
                </>
              )}
            </div>

            {!!formError && <p style={{ margin: 0, fontSize: 14, color: "#d0453c" }}>{formError}</p>}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 4 }}>
              <button onClick={() => setModal(null)} style={{ height: 46, border: "none", borderRadius: 999, background: "linear-gradient(145deg, #f6f6f9, #e9e9ec)", boxShadow: "4px 4px 12px rgba(174,174,192,0.35), -4px -4px 12px rgba(255,255,255,0.9)", padding: "0 26px", fontSize: 15, fontWeight: 600, color: "#3a3a3c", cursor: "pointer", fontFamily: "inherit" }}>Отмена</button>
              <button onClick={saveForm} style={{ height: 46, border: "none", borderRadius: 999, background: "linear-gradient(180deg, #f79a4a, #f5842e)", color: "#fff", padding: "0 30px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 8px 20px rgba(245,132,46,0.35), inset 0 1px 0 rgba(255,255,255,0.35)" }}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
