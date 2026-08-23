// Обычный скрипт (не ES-модуль): страницы выполняются в pywebview без сборщика,
// поэтому import/export здесь работать не будут — используем window.

class Permissions {
  static TABLE = {
    FILTER_SORT_SEARCH: ["manager", "admin"],
    EDIT_PRODUCTS: ["admin"],
    VIEW_ORDERS: ["manager", "admin"],
    EDIT_ORDERS: ["admin"],
    // Добавляйте новые права сюда
  };

  static has(role, permissionKey) {
    const allowed = Permissions.TABLE[permissionKey];
    if (!role || !allowed) return false;
    return allowed.includes(role);
  }
}

window.Permissions = Permissions;
