from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from django.contrib.auth.models import User
from .models import Kategori, Supplier, Barang, Gudang, Stok, RiwayatStok


class InventoryAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('tester', 't@example.com', 'password')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        # create base objects
        self.kategori = Kategori.objects.create(nama='TestCat')
        self.supplier = Supplier.objects.create(nama='TestSup')
        self.gudang = Gudang.objects.create(nama='G1', lokasi='L1')

    def test_create_barang_and_sanitize_gambar(self):
        url = reverse('barang-list')
        payload = {
            'sku': 'T-001',
            'nama': 'Barang Test',
            'deskripsi': 'desc',
            'kategori': self.kategori.id,
            'supplier': self.supplier.id,
            'satuan': 'pcs',
            'gambar_url': 'https://example.com/image.jpg?utm_source=foo&fbclid=ABC&keep=1'
        }
        r = self.client.post(url, payload, format='json')
        self.assertIn(r.status_code, (200, 201))
        data = r.json()
        self.assertEqual(data['sku'], 'T-001')
        # Ensure tracking params removed
        self.assertNotIn('utm_source', data['gambar_url'])
        self.assertNotIn('fbclid', data['gambar_url'])

    def test_stok_transaction_in_and_out(self):
        # create barang and initial stok
        barang = Barang.objects.create(sku='S-001', nama='B1', kategori=self.kategori, satuan='pcs')
        stok = Stok.objects.create(barang=barang, gudang=self.gudang, jumlah=10)

        url = reverse('stok-transaction')

        # IN +5
        r = self.client.post(url, {'stok': stok.id, 'tipe': 'IN', 'jumlah': 5}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['stok']['jumlah'], 15)

        # OUT 8 (valid)
        r2 = self.client.post(url, {'stok': stok.id, 'tipe': 'OUT', 'jumlah': 8}, format='json')
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r2.json()['stok']['jumlah'], 7)

        # OUT too many -> should 400
        r3 = self.client.post(url, {'stok': stok.id, 'tipe': 'OUT', 'jumlah': 100}, format='json')
        self.assertEqual(r3.status_code, 400)
