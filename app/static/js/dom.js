// Минимальный помощник для сборки DOM на ванильном JS.
// Позволяет описывать разметку так же компактно, как раньше в JSX,
// но без React и без компиляции Babel в браузере.

// CSS-свойства, у которых число means не пиксели (как в React).
const UNITLESS = new Set([
  "opacity", "zIndex", "fontWeight", "lineHeight", "flex", "flexGrow",
  "flexShrink", "order", "zoom", "flexOrder",
]);

const SVG_NS = "http://www.w3.org/2000/svg";
const SVG_TAGS = new Set(["svg", "path", "circle", "rect", "g", "line", "polyline", "polygon"]);

// fontSize -> font-size, WebkitBackdropFilter -> -webkit-backdrop-filter
function cssName(key) {
  return key.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
}

function applyStyle(node, style) {
  for (const key in style) {
    const raw = style[key];
    if (raw === null || raw === undefined || raw === false) continue;
    const value = typeof raw === "number" && !UNITLESS.has(key) ? raw + "px" : String(raw);
    node.style.setProperty(cssName(key), value);
  }
}

function appendChildren(node, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false || child === true) continue;
    if (Array.isArray(child)) {
      appendChildren(node, child);
    } else if (child instanceof Node) {
      node.appendChild(child);
    } else {
      node.appendChild(document.createTextNode(String(child)));
    }
  }
}

/**
 * el("div", { style: {...}, onClick: fn, text: "..." }, child1, child2, ...)
 *
 * props:
 *   style    - объект стилей (camelCase, числа -> px)
 *   onClick / onInput / onChange / onKeyDown ... - обработчики событий
 *   text     - текстовое содержимое
 *   остальное - атрибуты (class, id, type, value, disabled, aria-*, ...)
 */
function el(tag, props, ...children) {
  const isSvg = SVG_TAGS.has(tag);
  const node = isSvg ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);

  for (const key in props || {}) {
    const value = props[key];
    if (value === null || value === undefined || value === false) continue;

    if (key === "style") {
      applyStyle(node, value);
    } else if (key === "text") {
      node.textContent = String(value);
    } else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "class") {
      node.setAttribute("class", value);
    } else if (!isSvg && (key === "value" || key === "checked" || key === "disabled")) {
      // Свойства формы задаём напрямую, иначе они не обновляются после ввода.
      node[key] = value;
    } else {
      node.setAttribute(key, value === true ? "" : String(value));
    }
  }

  appendChildren(node, children);
  return node;
}

/** Заменяет всё содержимое узла на переданные элементы. */
function replaceChildren(node, ...children) {
  node.textContent = "";
  appendChildren(node, children);
  return node;
}

/** SVG-иконка из набора путей (замена прежнего компонента Icon). */
function icon(paths, options) {
  const o = options || {};
  const size = o.size || 24;
  return el("svg", {
    width: size, height: size, viewBox: "0 0 24 24",
    fill: o.fill || "none", stroke: o.stroke || "#1c1c1e",
    "stroke-width": o.sw || 1.8, "stroke-linecap": "round", "stroke-linejoin": "round",
    "aria-hidden": "true", style: o.style,
  }, paths.map((d) => el("path", { d })));
}

window.Dom = { el, replaceChildren, icon };
