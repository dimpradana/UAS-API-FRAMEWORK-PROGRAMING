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

class BarangListView(LoginRequiredMixin, ListView):
    model = Barang
    template_name = 'inventaris/barang_list.html'