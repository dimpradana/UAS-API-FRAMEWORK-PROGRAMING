from django.contrib import admin
from .models import Kategori, Supplier, Barang, Gudang, Stok, RiwayatStok

# Custom Admin untuk Barang
class BarangAdmin(admin.ModelAdmin):
    list_display = ('sku', 'nama', 'kategori', 'supplier', 'satuan', 'dibuat_pada')
    search_fields = ('sku', 'nama', 'kategori__nama', 'supplier__nama')
    list_filter = ('kategori', 'supplier')

# Custom Admin untuk Stok
class StokAdmin(admin.ModelAdmin):
    list_display = ('barang', 'gudang', 'jumlah', 'level_reorder', 'diperbarui_pada')
    list_filter = ('gudang', 'barang__kategori')
    search_fields = ('barang__sku', 'barang__nama', 'gudang__nama')

# Custom Admin untuk RiwayatStok
class RiwayatStokAdmin(admin.ModelAdmin):
    list_display = ('stok', 'tipe', 'jumlah', 'dibuat_oleh', 'dibuat_pada')
    list_filter = ('tipe', 'dibuat_pada', 'dibuat_oleh')
    search_fields = ('stok__barang__nama', 'catatan')

# Daftarkan semua model ke admin
admin.site.register(Kategori)
admin.site.register(Supplier)
admin.site.register(Barang, BarangAdmin)
admin.site.register(Gudang)
admin.site.register(Stok, StokAdmin)
admin.site.register(RiwayatStok, RiwayatStokAdmin)