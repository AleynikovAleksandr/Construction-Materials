// Обычный скрипт (не ES-модуль): main.js выполняется в pywebview через Babel-in-browser
// без сборщика, поэтому import/export здесь работать не будут — используем window.

const PERMISSIONS = {
  FILTER_SORT_SEARCH: ["manager", "admin"],
  EDIT_PRODUCTS: ["admin"],
  VIEW_ORDERS: ["manager", "admin"],
  EDIT_ORDERS: ["admin"],
  // Добавляйте новые права сюда
};

function hasPermission(role, permissionKey) {
  if (!role || !PERMISSIONS[permissionKey]) return false;
  return PERMISSIONS[permissionKey].includes(role);
}

window.Permissions = { PERMISSIONS, hasPermission };
