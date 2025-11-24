# Impor untuk Django CBV (Web Views)
from django.shortcuts import render
from django.urls import reverse_lazy
from django.views.generic import ListView, CreateView, UpdateView, DeleteView
from django.contrib.auth.mixins import LoginRequiredMixin

# Impor untuk DRF API Views
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly, IsAdminUser
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.permissions import BasePermission, SAFE_METHODS
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework import status
from django.db import transaction
from django.shortcuts import get_object_or_404


# Custom permission: allow safe methods to everyone; require authentication for write;
# require staff/admin for DELETE specifically
class IsAuthenticatedOrAdminDelete(BasePermission):
    def has_permission(self, request, view):
        # Allow GET, HEAD, OPTIONS for everyone
        if request.method in SAFE_METHODS:
            return True
        # DELETE requires admin/staff
        if request.method == 'DELETE':
            return bool(request.user and request.user.is_authenticated and request.user.is_staff)
        # Other unsafe methods require authenticated user
        return bool(request.user and request.user.is_authenticated)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    user = request.user
    return Response({
        'id': user.id,
        'username': user.username,
        'is_staff': user.is_staff,
        'is_superuser': user.is_superuser,
    })

# Impor Model dan Serializer
from .models import Kategori, Supplier, Barang, Gudang, Stok, RiwayatStok
from .serializers import (
    KategoriSerializer, SupplierSerializer, BarangSerializer,
    GudangSerializer, StokSerializer, RiwayatStokSerializer
)

# ====================== WEB VIEWS (CBV) ======================
class BarangListView(LoginRequiredMixin, ListView):
    model = Barang
    template_name = 'inventaris/barang_list.html'
    context_object_name = 'barang_list'
    paginate_by = 10

class BarangCreateView(LoginRequiredMixin, CreateView):
    model = Barang
    fields = ['sku', 'nama', 'deskripsi', 'kategori', 'supplier', 'satuan', 'gambar_url']
    template_name = 'inventaris/barang_form.html'
    success_url = reverse_lazy('barang-list')

class BarangUpdateView(LoginRequiredMixin, UpdateView):
    model = Barang
    fields = ['sku', 'nama', 'deskripsi', 'kategori', 'supplier', 'satuan', 'gambar_url']
    template_name = 'inventaris/barang_form.html'
    success_url = reverse_lazy('barang-list')

class BarangDeleteView(LoginRequiredMixin, DeleteView):
    model = Barang
    template_name = 'inventaris/barang_confirm_delete.html'
    success_url = reverse_lazy('barang-list')

# ====================== API VIEWS (DRF ViewSet) ======================
class KategoriViewSet(viewsets.ModelViewSet):
    queryset = Kategori.objects.all().order_by('nama')
    serializer_class = KategoriSerializer
    permission_classes = [IsAuthenticatedOrAdminDelete]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['nama', 'deskripsi']
    ordering_fields = ['nama', 'dibuat_pada']

class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all().order_by('nama')
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticatedOrAdminDelete]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['nama', 'kontak', 'telepon', 'email']
    ordering_fields = ['nama', 'dibuat_pada']

class BarangViewSet(viewsets.ModelViewSet):
    queryset = Barang.objects.all().order_by('-dibuat_pada')
    serializer_class = BarangSerializer
    permission_classes = [IsAuthenticatedOrAdminDelete]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['sku', 'nama', 'kategori__nama', 'supplier__nama']
    filterset_fields = ['kategori', 'supplier']
    ordering_fields = ['nama', 'sku', 'dibuat_pada']

class GudangViewSet(viewsets.ModelViewSet):
    queryset = Gudang.objects.all().order_by('nama')
    serializer_class = GudangSerializer
    permission_classes = [IsAuthenticatedOrAdminDelete]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['nama', 'lokasi']
    ordering_fields = ['nama', 'dibuat_pada']

class StokViewSet(viewsets.ModelViewSet):
    queryset = Stok.objects.filter(jumlah__gt=0).order_by('-diperbarui_pada')
    serializer_class = StokSerializer
    permission_classes = [IsAuthenticatedOrAdminDelete]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['barang__sku', 'barang__nama', 'gudang__nama']
    filterset_fields = ['gudang', 'barang']
    ordering_fields = ['jumlah', 'diperbarui_pada']

    def create(self, request, *args, **kwargs):
        """
        Override create so that if a Stok with the same (barang, gudang) exists,
        we update that record instead of raising a unique-together validation error.
        This makes frontend saves idempotent when admin tries to add stok for
        the same barang+gudang pair.
        """
        barang_id = request.data.get('barang')
        gudang_id = request.data.get('gudang')

        # Only attempt the upsert behavior when both foreign keys are provided
        if barang_id and gudang_id:
            try:
                existing = Stok.objects.filter(barang_id=barang_id, gudang_id=gudang_id).first()
            except Exception:
                existing = None

            if existing:
                # Update existing stok with provided fields (jumlah, level_reorder)
                jumlah = request.data.get('jumlah')
                level = request.data.get('level_reorder')
                updated = False
                if jumlah is not None:
                    try:
                        existing.jumlah = int(jumlah)
                        updated = True
                    except Exception:
                        pass
                if level is not None:
                    try:
                        existing.level_reorder = int(level)
                        updated = True
                    except Exception:
                        pass
                if updated:
                    existing.save()
                serializer = self.get_serializer(existing)
                return Response(serializer.data)

        # Fallback to default behavior (will return validation errors on duplicates)
        return super().create(request, *args, **kwargs)
    
    # ... (queryset dan serializer_class) ...
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    
    # Cari berdasarkan nama/sku barang (SearchFilter)
    search_fields = ['barang__sku', 'barang__nama', 'gudang__nama']
    
    # Filter berdasarkan ID Kategori (Filter Backend)
    # Kita menargetkan relasi: Stok -> Barang -> Kategori
    filterset_fields = {
        'gudang': ['exact'], 
        'barang': ['exact'], # Filter berdasarkan ID Barang
        'barang__kategori': ['exact'], # <--- INI YANG PALING PENTING UNTUK FILTER KATEGORI
    }
    ordering_fields = ['jumlah', 'diperbarui_pada']

class RiwayatStokViewSet(viewsets.ModelViewSet):
    queryset = RiwayatStok.objects.all().order_by('-dibuat_pada')
    serializer_class = RiwayatStokSerializer
    permission_classes = [IsAdminUser]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['stok__barang__nama', 'tipe', 'catatan']
    filterset_fields = ['tipe', 'dibuat_oleh']
    ordering_fields = ['dibuat_pada', 'jumlah']


class StokTransactionAPIView(APIView):
    """Endpoint to perform transactional stok IN/OUT operations in a single request.

    Accepts JSON with either `stok` (id) or `barang` and `gudang` (ids), plus:
      - tipe: 'IN' or 'OUT'
      - jumlah: integer > 0
      - catatan: optional text
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        tipe = (request.data.get('tipe') or '').upper()
        try:
            jumlah = int(request.data.get('jumlah'))
        except Exception:
            return Response({'jumlah': ['Jumlah harus berupa angka']}, status=status.HTTP_400_BAD_REQUEST)

        if tipe not in ('IN', 'OUT'):
            return Response({'tipe': ['Tipe harus IN atau OUT']}, status=status.HTTP_400_BAD_REQUEST)
        if jumlah <= 0:
            return Response({'jumlah': ['Jumlah harus lebih besar dari 0']}, status=status.HTTP_400_BAD_REQUEST)

        stok_id = request.data.get('stok')
        barang_id = request.data.get('barang')
        gudang_id = request.data.get('gudang')
        catatan = request.data.get('catatan', '')

        with transaction.atomic():
            if stok_id:
                stok_qs = Stok.objects.select_for_update().filter(pk=stok_id)
                stok = get_object_or_404(stok_qs)
            else:
                if not (barang_id and gudang_id):
                    return Response({'detail': 'stok id atau barang+gudang harus diberikan'}, status=status.HTTP_400_BAD_REQUEST)
                stok, created = Stok.objects.select_for_update().get_or_create(barang_id=barang_id, gudang_id=gudang_id, defaults={'jumlah': 0, 'level_reorder': 10})

            if tipe == 'OUT':
                if jumlah > stok.jumlah:
                    return Response({'detail': 'Jumlah keluar melebihi stok tersedia'}, status=status.HTTP_400_BAD_REQUEST)
                stok.jumlah -= jumlah
            else:
                stok.jumlah += jumlah

            stok.save()
            riwayat = RiwayatStok.objects.create(stok=stok, tipe=tipe, jumlah=jumlah, catatan=catatan, dibuat_oleh=request.user if request.user.is_authenticated else None)

            stok_data = StokSerializer(stok).data
            riwayat_data = RiwayatStokSerializer(riwayat).data
            return Response({'stok': stok_data, 'riwayat': riwayat_data}, status=status.HTTP_200_OK)

class BarangListView(LoginRequiredMixin, ListView):
    model = Barang
    template_name = 'inventaris/barang_list.html'