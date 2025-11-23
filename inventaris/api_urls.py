from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    KategoriViewSet, SupplierViewSet, BarangViewSet,
    GudangViewSet, StokViewSet, RiwayatStokViewSet
)
from .views import current_user

# Inisialisasi Router DRF
router = DefaultRouter()
router.register(r'kategori', KategoriViewSet, basename='kategori')
router.register(r'supplier', SupplierViewSet, basename='supplier')
router.register(r'barang', BarangViewSet, basename='barang')
router.register(r'gudang', GudangViewSet, basename='gudang')
router.register(r'stok', StokViewSet, basename='stok')
router.register(r'riwayat-stok', RiwayatStokViewSet, basename='riwayat-stok')

# URL API otomatis di-generate oleh Router
urlpatterns = [
    path('', include(router.urls)),
    path('me/', current_user, name='current-user'),
]