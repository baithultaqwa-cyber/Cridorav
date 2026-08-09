"""
Declarative role permissions for DRF views.

New features should use these instead of ad-hoc `_require_admin` / `user_type`
checks inside view methods. Compose with `permission_classes = [IsAuthenticated, IsAdmin]`.

Ownership (object-level) checks still belong in the view/service when the resource
is not purely role-gated — use IsAdminOrReadOwn / IsOwnerOrAdmin patterns below.
"""
from rest_framework.permissions import BasePermission, SAFE_METHODS

from users.models import User


class IsAdmin(BasePermission):
    """Cridora platform admin (`user_type == admin`)."""

    message = 'Admin access required.'

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and getattr(u, 'user_type', None) == User.ADMIN)


class IsVendor(BasePermission):
    """Bullion vendor desk."""

    message = 'Vendor access required.'

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and getattr(u, 'user_type', None) == User.VENDOR)


class IsCustomer(BasePermission):
    """Retail customer."""

    message = 'Customer access required.'

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and getattr(u, 'user_type', None) == User.CUSTOMER)


class IsAdminOrVendor(BasePermission):
    message = 'Admin or vendor access required.'

    def has_permission(self, request, view):
        u = request.user
        return bool(
            u and u.is_authenticated
            and getattr(u, 'user_type', None) in (User.ADMIN, User.VENDOR)
        )


class IsOwnerOrAdmin(BasePermission):
    """
    Object-level: allow if the object belongs to the user, or the user is admin.

    Views must set `owner_field` on the view (default `customer`) or override
    `get_owner(obj)`.
    """

    message = 'You do not have access to this resource.'

    def has_object_permission(self, request, view, obj):
        u = request.user
        if not u or not u.is_authenticated:
            return False
        if getattr(u, 'user_type', None) == User.ADMIN:
            return True
        owner_field = getattr(view, 'owner_field', 'customer')
        owner = getattr(obj, owner_field, None)
        if owner is None and hasattr(obj, 'user'):
            owner = obj.user
        owner_id = getattr(owner, 'pk', owner)
        return owner_id == u.pk


class ReadOnly(BasePermission):
    """Allow safe methods only (compose with role permissions)."""

    def has_permission(self, request, view):
        return request.method in SAFE_METHODS
