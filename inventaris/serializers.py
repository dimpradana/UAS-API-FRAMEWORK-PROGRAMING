from rest_framework import serializers
from urllib.parse import urlparse, urlunparse, parse_qsl
from .models import Kategori, Supplier, Barang, Gudang, Stok, RiwayatStok

class KategoriSerializer(serializers.ModelSerializer):
    class Meta:
        model = Kategori
        fields = ['id', 'nama', 'deskripsi', 'dibuat_pada']

class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ['id', 'nama', 'kontak', 'telepon', 'email', 'alamat', 'dibuat_pada']

class BarangSerializer(serializers.ModelSerializer):
    kategori_nama = serializers.CharField(source='kategori.nama', read_only=True)
    supplier_nama = serializers.CharField(source='supplier.nama', read_only=True)
    
    class Meta:
        model = Barang
        fields = ['id', 'sku', 'nama', 'deskripsi', 'kategori', 'kategori_nama', 'supplier', 'supplier_nama', 'satuan', 'gambar_url', 'dibuat_pada', 'diperbarui_pada']

    def validate_gambar_url(self, value):
        """Sanitize image URL by removing common tracking query params (utm_*, fbclid, gclid)."""
        if not value:
            return value
        try:
            p = urlparse(value)
            if not p.scheme or not p.netloc:
                return value
            # Filter out tracking params
            q = parse_qsl(p.query, keep_blank_values=True)
            q = [(k, v) for (k, v) in q if not (k.startswith('utm_') or k in ('fbclid', 'gclid'))]
            newq = '&'.join([f"{k}={v}" for k, v in q])
            cleaned = urlunparse((p.scheme, p.netloc, p.path or '', p.params or '', newq, p.fragment or ''))
            return cleaned
        except Exception:
            return value

class GudangSerializer(serializers.ModelSerializer):
    class Meta:
        model = Gudang
        fields = ['id', 'nama', 'lokasi', 'deskripsi', 'dibuat_pada']

class StokSerializer(serializers.ModelSerializer):
    barang_nama = serializers.CharField(source='barang.nama', read_only=True)
    barang_sku = serializers.CharField(source='barang.sku', read_only=True)
    gudang_nama = serializers.CharField(source='gudang.nama', read_only=True)
    barang_satuan = serializers.CharField(source='barang.satuan', read_only=True)
    barang_gambar = serializers.ReadOnlyField(source='barang.gambar_url') 
    
    class Meta:
        model = Stok
        fields = ['id', 'barang', 'barang_nama', 'barang_sku', 'gudang', 'gudang_nama', 'jumlah', 'level_reorder', 'diperbarui_pada', 'barang_satuan','barang_gambar']

class RiwayatStokSerializer(serializers.ModelSerializer):
    stok_barang = serializers.CharField(source='stok.barang.nama', read_only=True)
    stok_gudang = serializers.CharField(source='stok.gudang.nama', read_only=True)
    dibuat_oleh_nama = serializers.CharField(source='dibuat_oleh.username', read_only=True)
    
    class Meta:
        model = RiwayatStok
        fields = ['id', 'stok', 'stok_barang', 'stok_gudang', 'tipe', 'jumlah', 'catatan', 'dibuat_oleh', 'dibuat_oleh_nama', 'dibuat_pada']