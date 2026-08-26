class Permissions {
  static TABLE = {
    FILTER_SORT_SEARCH: ["manager", "admin"],
    EDIT_PRODUCTS: ["admin"],
    VIEW_ORDERS: ["manager", "admin"],
    EDIT_ORDERS: ["admin"],
  };

  static has(role, permissionKey) {
    const allowed = Permissions.TABLE[permissionKey];
    if (!role || !allowed) return false;
    return allowed.includes(role);
  }
}

window.Permissions = Permissions;
