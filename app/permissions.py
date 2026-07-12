"""Единая таблица прав по ролям — зеркало app/static/js/permissions.js.
Добавляйте новые права сюда и там одновременно."""

PERMISSIONS = {
    "FILTER_SORT_SEARCH": ("manager", "admin"),
    "EDIT_PRODUCTS": ("admin",),
    "VIEW_ORDERS": ("manager", "admin"),
    "EDIT_ORDERS": ("admin",),
}


def has_permission(role: str | None, permission_key: str) -> bool:
    if not role or permission_key not in PERMISSIONS:
        return False
    return role in PERMISSIONS[permission_key]
