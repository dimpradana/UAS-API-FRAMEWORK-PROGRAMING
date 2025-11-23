from django.db import models
from django.contrib.auth.models import User

# Model Kategori Barang
class Kategori(models.Model):
    nama = models.CharField(max_length=100, unique=True, verbose_name="Nama Kategori")
    deskripsi = models.TextField(blank=True, verbose_name="Deskripsi Kategori")
    dibuat_pada = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.nama

# Model Supplier (Pemasok Barang)
class Supplier(models.Model):
    nama = models.CharField(max_length=150, verbose_name="Nama Supplier")
    kontak = models.CharField(max_length=100, blank=True, verbose_name="Nama Kontak")
    telepon = models.CharField(max_length=20, blank=True, verbose_name="Nomor Telepon")
    email = models.EmailField(blank=True, verbose_name="Email")
    alamat = models.TextField(blank=True, verbose_name="Alamat")
    dibuat_pada = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.nama

# Model Barang (Produk di Gudang)
class Barang(models.Model):
    sku = models.CharField(max_length=50, unique=True, verbose_name="Kode SKU")
    nama = models.CharField(max_length=200, verbose_name="Nama Barang")
    deskripsi = models.TextField(blank=True, verbose_name="Deskripsi Barang")
    kategori = models.ForeignKey(Kategori, on_delete=models.CASCADE, related_name="barang", verbose_name="Kategori")
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name="barang", verbose_name="Supplier")
    satuan = models.CharField(max_length=20, verbose_name="Satuan (pcs/kg/liter)")
    gambar_url = models.URLField(blank=True, verbose_name="URL Gambar Barang")
    dibuat_pada = models.DateTimeField(auto_now_add=True)
    diperbarui_pada = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.sku} - {self.nama}"

# Model Gudang (Lokasi Penyimpanan)
class Gudang(models.Model):
    nama = models.CharField(max_length=100, verbose_name="Nama Gudang")
    lokasi = models.CharField(max_length=200, verbose_name="Lokasi Gudang")
    deskripsi = models.TextField(blank=True, verbose_name="Deskripsi Gudang")
    dibuat_pada = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.nama

# Model Stok (Jumlah Barang per Gudang)
class Stok(models.Model):
    barang = models.ForeignKey(Barang, on_delete=models.CASCADE, related_name="stok", verbose_name="Barang")
    gudang = models.ForeignKey(Gudang, on_delete=models.CASCADE, related_name="stok", verbose_name="Gudang")
    jumlah = models.PositiveIntegerField(verbose_name="Jumlah Stok")
    level_reorder = models.PositiveIntegerField(default=10, verbose_name="Level Reorder (Minimal Stok)")
    diperbarui_pada = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('barang', 'gudang')  # Tidak duplikat stok barang di gudang yang sama

    def __str__(self):
        return f"{self.barang.nama} - {self.gudang.nama}: {self.jumlah} {self.barang.satuan}"

# Model Riwayat Pergerakan Stok (Log Masuk/Keluar)
class RiwayatStok(models.Model):
    TIPE_PERGERAKAN = [
        ('IN', 'Masuk'),
        ('OUT', 'Keluar'),
    ]
    stok = models.ForeignKey(Stok, on_delete=models.CASCADE, related_name="riwayat", verbose_name="Stok Barang")
    tipe = models.CharField(max_length=3, choices=TIPE_PERGERAKAN, verbose_name="Tipe Pergerakan")
    jumlah = models.PositiveIntegerField(verbose_name="Jumlah Barang")
    catatan = models.TextField(blank=True, verbose_name="Catatan Pergerakan")
    dibuat_oleh = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, verbose_name="Petugas")
    dibuat_pada = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.tipe} - {self.stok.barang.nama} ({self.jumlah})"