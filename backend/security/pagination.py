"""
Standard list pagination for new API endpoints.

Do NOT set this as DRF DEFAULT_PAGINATION_CLASS globally — existing list
endpoints return bare arrays and the SPA expects that shape. Opt in per view:

    class MyListView(APIView):
        pagination_class = StandardPagination

Or for generics:

    class MyList(ListAPIView):
        pagination_class = StandardPagination
"""
from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


class CompactPagination(PageNumberPagination):
    """Smaller default for dense admin queues."""
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100
