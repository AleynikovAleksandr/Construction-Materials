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

  static get api() {
    return window.pywebview && window.pywebview.api;
  }
}

window.PywebviewBridge = PywebviewBridge;
