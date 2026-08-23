// window.pywebview появляется раньше, чем в нём реально создаются методы
// (window.pywebview.api.<name>) — их добавляет отдельный, более поздний шаг
// моста pywebview, и только после этого стреляет событие "pywebviewready".
// Поэтому проверка "if (window.pywebview)" ловит окно с ещё пустым api и
// падает с "X is not a function". Ждём, пока api реально наполнится.

class PywebviewBridge {
  static isReady() {
    return Boolean(
      window.pywebview && window.pywebview.api && Object.keys(window.pywebview.api).length > 0
    );
  }

  static onReady(callback) {
    if (PywebviewBridge.isReady()) {
      callback();
      return;
    }
    window.addEventListener("pywebviewready", callback, { once: true });
  }

  /** Методы, вызываемые из Python (pywebview.api.*). */
  static get api() {
    return window.pywebview && window.pywebview.api;
  }
}

window.PywebviewBridge = PywebviewBridge;
