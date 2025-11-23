// ===========================================================================
// KONFIGURASI UMUM
// ===========================================================================
const API_BASE_URL = 'http://127.0.0.1:8000/api';
let authToken = localStorage.getItem('authToken') || null;
let currentPage = 1; // Digunakan untuk Pagination di halaman Toko

// CATATAN: Jika Anda perlu menguji tanpa login, uncomment baris di bawah ini
// authToken = 'bbe3ab7330cf1ae7c30d31c7258979b1e273cde3'; 
// localStorage.setItem('authToken', authToken); 
// ===========================================================================


// ====================== FUNGSI HELPER & KEAMANAN ======================

// Tampilkan Alert (untuk Admin Dashboard)
function showAlert(message, isSuccess = true) {
    const alertEl = document.getElementById('alertMessage') || document.getElementById('error') || document.getElementById('errorAlert');
    if (alertEl) {
        alertEl.textContent = message;
        alertEl.className = `alert ${isSuccess ? 'alert-success' : 'alert-danger'} show`;
        setTimeout(() => alertEl.classList.add('d-none'), 7000);
    }
}

// Tampilkan Loading
function showLoading(elId = 'loading') {
    const loadingEl = document.getElementById(elId);
    if (loadingEl) loadingEl.classList.remove('d-none');
}

// Sembunyikan Loading
function hideLoading(elId = 'loading') {
    const loadingEl = document.getElementById(elId);
    if (loadingEl) loadingEl.classList.add('d-none');
}

// Cek Autentikasi Admin (Redirect jika tidak ada token)
function checkAuth() {
    if (!authToken) {
        if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('register.html')) {
            window.location.href = 'login.html';
        }
    }
}

// Logout Admin
function logout() {
    localStorage.removeItem('authToken');
    authToken = null;
    window.location.href = 'login.html';
}


// ====================== FUNGSI LOGIN & REGISTRASI ======================
async function loginAdmin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch(`${API_BASE_URL}/auth/token/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) throw new Error('Username atau password salah!');
        const data = await response.json();
        
        authToken = data.token;
        localStorage.setItem('authToken', authToken);
        window.location.href = 'dashboard.html'; // Redirect ke dashboard barang
    } catch (error) {
        showAlert(error.message, false);
    }
}

async function registerAdmin() {
    const username = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const password_confirm = document.getElementById('regPasswordConfirm').value;

    if (password !== password_confirm) {
        showAlert("Password dan konfirmasi password harus sama.", false);
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/register/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password, password_confirm })
        });

        if (!response.ok) {
            const errorData = await response.json();
            const msg = errorData.password ? errorData.password[0] : JSON.stringify(errorData);
            throw new Error(msg || `Gagal registrasi (Status: ${response.status})`);
        }
        
        showAlert("Akun Admin berhasil dibuat! Silakan Login di halaman Login.");
        document.getElementById('registerForm').reset();
        setTimeout(() => window.location.href = 'login.html', 2000);

    } catch (error) {
        showAlert(`Registrasi Gagal: ${error.message}`, false);
    }
}

// ====================== FUNGSI TOKO (INDEX.HTML) ======================

async function loadKategori() {
    try {
        const response = await fetch(`${API_BASE_URL}/kategori/`);
        if (!response.ok) throw new Error('Gagal memuat kategori');
        
        const data = await response.json();
        const kategoriSelect = document.getElementById('kategoriFilter');
        
        data.results.forEach(kategori => {
            const option = document.createElement('option');
            option.value = kategori.id;
            option.textContent = kategori.nama;
            kategoriSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Kategori load error:", error.message);
    }
}

async function loadStok(page = 1, search = '', kategoriId = '') {
    currentPage = page;
    showLoading('loading');
    document.getElementById('error').classList.add('d-none');
    
    let url = `${API_BASE_URL}/stok/?`;
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (kategoriId) url += `barang__kategori=${kategoriId}&`;
    url += `page=${page}`;

    try {
        // GET request untuk Stok (READ) diizinkan oleh IsAuthenticatedOrReadOnly
        const response = await fetch(url);
        
        if (!response.ok) throw new Error(`Gagal memuat stok (Status: ${response.status}). Pastikan token jika diperlukan.`);
        
        const data = await response.json();
        const container = document.getElementById('barangContainer');
        container.innerHTML = '';

        data.results.forEach(stok => {
            const card = document.createElement('div');
            card.className = 'col-md-4 mb-4';
            
            card.innerHTML = `
                <div class="card h-100 shadow-sm">
                    <img src="${stok.barang.gambar_url || 'https://via.placeholder.com/300x200?text=No+Image'}" 
                         class="card-img-top" alt="${stok.barang.nama}">
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title text-primary">${stok.barang_nama}</h5>
                        <p class="card-text mb-1"><small class="text-muted">SKU: ${stok.barang_sku} | Kategori: ${stok.barang.kategori_nama}</small></p>
                        
                        <p class="card-text fs-4 fw-bold text-success mt-auto">
                            Stok: ${stok.jumlah} ${stok.barang_satuan}
                        </p>
                        <p class="card-text">Lokasi: ${stok.gudang_nama}</p>
                        ${stok.jumlah <= stok.level_reorder ? `<span class="badge bg-warning text-dark">PERLU REORDER!</span>` : ''}
                    </div>
                </div>
            `;
            container.appendChild(card);
        });

        if (data.results.length === 0) {
            container.innerHTML = '<div class="col-12"><p class="text-center alert alert-warning">Tidak ada barang yang tersedia atau cocok dengan filter.</p></div>';
        }
        
        renderPagination(data.count, page, search, kategoriId);
    } catch (error) {
        document.getElementById('error').textContent = `Kesalahan saat mengambil data: ${error.message}`;
        document.getElementById('error').classList.remove('d-none');
        container.innerHTML = '';
    } finally {
        hideLoading('loading');
    }
}

// Render Pagination (untuk Halaman Toko)
function renderPagination(totalItems, currentPage, search, kategoriId) {
    const itemsPerPage = 10; 
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const paginationEl = document.getElementById('pagination');
    const navEl = document.getElementById('paginationNav');
    
    if (totalPages <= 1) {
        navEl.classList.add('d-none');
        return;
    }
    navEl.classList.remove('d-none');
    paginationEl.innerHTML = '';

    if (currentPage > 1) {
        paginationEl.innerHTML += `<li class="page-item"><button class="page-link" onclick="loadStok(${currentPage - 1}, '${search}', '${kategoriId}')">Previous</button></li>`;
    }

    for (let i = 1; i <= totalPages; i++) {
        const activeClass = i === currentPage ? 'active' : '';
        paginationEl.innerHTML += `
            <li class="page-item ${activeClass}">
                <button class="page-link" onclick="loadStok(${i}, '${search}', '${kategoriId}')">${i}</button>
            </li>
        `;
    }

    if (currentPage < totalPages) {
        paginationEl.innerHTML += `<li class="page-item"><button class="page-link" onclick="loadStok(${currentPage + 1}, '${search}', '${kategoriId}')">Next</button></li>`;
    }
}


// ====================== FUNGSI ADMIN (CRUD) ======================

// --- UTILITY: LOAD DROPDOWN UNTUK FORM ADMIN ---
async function loadKategori() {
    try {
        const response = await fetch(`${API_BASE_URL}/kategori/`);
        if (!response.ok) throw new Error('Gagal memuat kategori');
        const data = await response.json();
        
        const kategoriSelect = document.getElementById('kategori');
        if (!kategoriSelect) return; // Hentikan jika elemen tidak ada (misal di halaman toko)

        kategoriSelect.innerHTML = '<option value="">Pilih Kategori</option>';
        data.results.forEach(kategori => {
            const option = document.createElement('option');
            option.value = kategori.id;
            option.textContent = kategori.nama;
            kategoriSelect.appendChild(option);
        });
    } catch (error) {
        showAlert(error.message, false);
    }
}

async function loadSupplier() {
    try {
        const response = await fetch(`${API_BASE_URL}/supplier/`, {
            headers: { 'Authorization': `Token ${authToken}` }
        });
        
        if (!response.ok) throw new Error('Gagal memuat supplier');
        const data = await response.json();
        
        const supplierSelect = document.getElementById('supplier');
        if (!supplierSelect) return;

        supplierSelect.innerHTML = '<option value="">Pilih Supplier</option>';
        data.results.forEach(supplier => {
            const option = document.createElement('option');
            option.value = supplier.id;
            option.textContent = supplier.nama;
            supplierSelect.appendChild(option);
        });
    } catch (error) {
        showAlert(error.message, false);
    }
}

// --- BARANG (CRUD) ---
async function loadBarang() {
    showLoading('loadingTable');
    try {
        const response = await fetch(`${API_BASE_URL}/barang/`, {
            headers: { 'Authorization': `Token ${authToken}` }
        });
        
        if (!response.ok) throw new Error(`Gagal memuat barang (Status: ${response.status})`);
        const data = await response.json();
        
        const tableBody = document.getElementById('barangTableBody');
        tableBody.innerHTML = '';

        data.results.forEach(barang => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${barang.sku}</td>
                <td>${barang.nama}</td>
                <td>${barang.kategori_nama}</td>
                <td>${barang.supplier_nama || '-'}</td>
                <td>${barang.satuan}</td>
                <td>
                    <button onclick="setFormForEdit(${barang.id})" class="btn btn-sm btn-warning me-1">Edit</button>
                    <button onclick="deleteBarang(${barang.id})" class="btn btn-sm btn-danger">Hapus</button>
                </td>
            `;
            tableBody.appendChild(row);
        });

        if (data.results.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Tidak ada barang terdaftar.</td></tr>';
        }
    } catch (error) {
        showAlert(error.message, false);
    } finally {
        hideLoading('loadingTable');
    }
}

async function setFormForEdit(barangId) {
    try {
        const response = await fetch(`\({API_BASE_URL}/barang/\){barangId}/`, {
            headers: { 'Authorization': `Token ${authToken}` }
        });
        
        if (!response.ok) throw new Error('Gagal memuat data barang');
        const barang = await response.json();

        document.getElementById('formTitle').textContent = 'Ubah Barang';
        document.getElementById('barangId').value = barang.id;
        document.getElementById('sku').value = barang.sku;
        document.getElementById('nama').value = barang.nama;
        document.getElementById('deskripsi').value = barang.deskripsi || '';
        document.getElementById('kategori').value = barang.kategori;
        document.getElementById('supplier').value = barang.supplier || '';
        document.getElementById('satuan').value = barang.satuan;
        document.getElementById('gambar_url').value = barang.gambar_url || '';
        document.getElementById('barangForm').scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        showAlert(error.message, false);
    }
}

async function addOrUpdateBarang() {
    const barangId = document.getElementById('barangId').value;
    const newBarang = {
        sku: document.getElementById('sku').value,
        nama: document.getElementById('nama').value,
        deskripsi: document.getElementById('deskripsi').value || '',
        kategori: parseInt(document.getElementById('kategori').value),
        supplier: document.getElementById('supplier').value ? parseInt(document.getElementById('supplier').value) : null,
        satuan: document.getElementById('satuan').value,
        gambar_url: document.getElementById('gambar_url').value || null
    };

    const method = barangId ? 'PUT' : 'POST';
    const url = barangId ? `\({API_BASE_URL}/barang/\){barangId}/` : `${API_BASE_URL}/barang/`;

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${authToken}`
            },
            body: JSON.stringify(newBarang)
        });

        if (!response.ok) throw new Error(`Gagal menyimpan barang (Status: ${response.status})`);
        
        showAlert(barangId ? 'Barang berhasil diubah!' : 'Barang berhasil ditambahkan!');
        resetForm();
        loadBarang();
    } catch (error) {
        showAlert(error.message, false);
    }
}

async function deleteBarang(barangId) {
    if (!confirm('Apakah Anda yakin ingin menghapus barang ini?')) return;

    try {
        const response = await fetch(`\({API_BASE_URL}/barang/\){barangId}/`, {
            method: 'DELETE',
            headers: { 'Authorization': `Token ${authToken}` }
        });

        if (!response.ok) throw new Error(`Gagal menghapus barang (Status: ${response.status})`);
        
        showAlert('Barang berhasil dihapus!');
        loadBarang();
    } catch (error) {
        showAlert(error.message, false);
    }
}

function resetForm() {
    document.getElementById('formTitle').textContent = 'Tambah Barang Baru';
    document.getElementById('barangForm').reset();
    document.getElementById('barangId').value = '';
}


// --- KATEGORI (CRUD) ---
async function loadKategoriTable() {
    showLoading('loadingTable');
    try {
        const response = await fetch(`${API_BASE_URL}/kategori/`, { headers: { 'Authorization': `Token ${authToken}` } });
        if (!response.ok) throw new Error(`Gagal memuat kategori (Status: ${response.status})`);
        const data = await response.json();
        
        const tableBody = document.getElementById('kategoriTableBody');
        tableBody.innerHTML = '';

        data.results.forEach(kategori => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${kategori.nama}</td>
                <td>${kategori.deskripsi || '-'}</td>
                <td>${new Date(kategori.dibuat_pada).toLocaleDateString('id-ID')}</td>
                <td>
                    <button onclick="setKategoriForEdit(${kategori.id})" class="btn btn-sm btn-warning me-1">Edit</button>
                    <button onclick="deleteKategori(${kategori.id})" class="btn btn-sm btn-danger">Hapus</button>
                </td>
            `;
            tableBody.appendChild(row);
        });

        if (data.results.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center">Tidak ada kategori terdaftar.</td></tr>';
        }
    } catch (error) {
        showAlert(error.message, false);
    } finally {
        hideLoading('loadingTable');
    }
}
async function setKategoriForEdit(kategoriId) { /* ... (Implementasi sebelumnya) ... */ }
async function addOrUpdateKategori() { /* ... (Implementasi sebelumnya) ... */ }
async function deleteKategori(kategoriId) { /* ... (Implementasi sebelumnya) ... */ }
function resetKategoriForm() { 
    document.getElementById('formTitle').textContent = 'Tambah Kategori Baru';
    document.getElementById('kategoriForm').reset();
    document.getElementById('kategoriId').value = '';
}

// --- SUPPLIER (CRUD) ---
async function loadSupplierTable() {
    showLoading('loadingTable');
    try {
        const response = await fetch(`${API_BASE_URL}/supplier/`, { headers: { 'Authorization': `Token ${authToken}` } });
        if (!response.ok) throw new Error(`Gagal memuat supplier (Status: ${response.status})`);
        const data = await response.json();
        
        const tableBody = document.getElementById('supplierTableBody');
        tableBody.innerHTML = '';

        data.results.forEach(supplier => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${supplier.nama}</td>
                <td>${supplier.kontak || '-'}</td>
                <td>${supplier.telepon || '-'}</td>
                <td>${supplier.email || '-'}</td>
                <td>
                    <button onclick="setSupplierForEdit(${supplier.id})" class="btn btn-sm btn-warning me-1">Edit</button>
                    <button onclick="deleteSupplier(${supplier.id})" class="btn btn-sm btn-danger">Hapus</button>
                </td>
            `;
            tableBody.appendChild(row);
        });

        if (data.results.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center">Tidak ada supplier terdaftar.</td></tr>';
        }
    } catch (error) {
        showAlert(error.message, false);
    } finally {
        hideLoading('loadingTable');
    }
}
async function setSupplierForEdit(supplierId) { /* ... (Implementasi sebelumnya) ... */ }
async function addOrUpdateSupplier() { /* ... (Implementasi sebelumnya) ... */ }
async function deleteSupplier(supplierId) { /* ... (Implementasi sebelumnya) ... */ }
function resetSupplierForm() { 
    document.getElementById('formTitle').textContent = 'Tambah Supplier Baru';
    document.getElementById('supplierForm').reset();
    document.getElementById('supplierId').value = '';
}

// --- STOK (CRUD) ---
async function loadBarangForStok() {
    try {
        const response = await fetch(`${API_BASE_URL}/barang/`, { headers: { 'Authorization': `Token ${authToken}` } });
        if (!response.ok) throw new Error('Gagal memuat barang');
        const data = await response.json();
        
        const barangSelect = document.getElementById('barangStok');
        if (!barangSelect) return;

        barangSelect.innerHTML = '<option value="">Pilih Barang</option>';
        data.results.forEach(barang => {
            const option = document.createElement('option');
            option.value = barang.id;
            option.textContent = `${barang.nama} (${barang.sku})`;
            barangSelect.appendChild(option);
        });
    } catch (error) {
        showAlert(error.message, false);
    }
}

async function loadGudangForStok() {
    try {
        const response = await fetch(`${API_BASE_URL}/gudang/`, { headers: { 'Authorization': `Token ${authToken}` } });
        if (!response.ok) throw new Error('Gagal memuat gudang');
        const data = await response.json();
        
        const gudangSelect = document.getElementById('gudangStok');
        if (!gudangSelect) return;

        gudangSelect.innerHTML = '<option value="">Pilih Gudang</option>';
        data.results.forEach(gudang => {
            const option = document.createElement('option');
            option.value = gudang.id;
            option.textContent = `${gudang.nama} - ${gudang.lokasi}`;
            gudangSelect.appendChild(option);
        });
    } catch (error) {
        showAlert(error.message, false);
    }
}

async function loadStokTable() {
    showLoading('loadingTable');
    const searchQuery = document.getElementById('searchInput')?.value || '';
    const kategoriId = document.getElementById('kategoriFilter')?.value || '';
    
    let url = `${API_BASE_URL}/stok/?`;
    if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}&`;
    if (kategoriId) url += `barang__kategori=${kategoriId}&`;
    url += `page=${currentPage}`;

    try {
        const response = await fetch(url, { headers: { 'Authorization': `Token ${authToken}` } });
        if (!response.ok) throw new Error(`Gagal memuat stok (Status: ${response.status})`);
        const data = await response.json();
        
        const tableBody = document.getElementById('stokTableBody');
        tableBody.innerHTML = '';

        data.results.forEach(stok => {
            const row = document.createElement('tr');
            if (stok.jumlah <= stok.level_reorder) row.classList.add('table-warning');
            
            row.innerHTML = `
                <td>${stok.barang_nama} (${stok.barang_sku})</td>
                <td>${stok.gudang_nama}</td>
                <td>${stok.jumlah} ${stok.barang_satuan}</td>
                <td>${stok.level_reorder}</td>
                <td>${new Date(stok.diperbarui_pada).toLocaleString('id-ID')}</td>
                <td>
                    <button onclick="setStokForEdit(${stok.id})" class="btn btn-sm btn-warning me-1">Edit</button>
                    <button onclick="deleteStok(${stok.id})" class="btn btn-sm btn-danger">Hapus</button>
                </td>
            `;
            tableBody.appendChild(row);
        });

        if (data.results.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Tidak ada stok terdaftar.</td></tr>';
        }
        renderPagination(data.count, currentPage, searchQuery, kategoriId, 'stok'); // Render pagination admin
    } catch (error) {
        showAlert(error.message, false);
    } finally {
        hideLoading('loadingTable');
    }
}
async function setStokForEdit(stokId) { /* ... (Implementasi sebelumnya) ... */ }
async function addOrUpdateStok() { /* ... (Implementasi sebelumnya) ... */ }
async function deleteStok(stokId) { /* ... (Implementasi sebelumnya) ... */ }
function resetStokForm() { /* ... (Implementasi sebelumnya) ... */ }

// ====================== INISIALISASI UMUM ======================
document.addEventListener('DOMContentLoaded', () => {
    
    // --- INISIALISASI HALAMAN TOKO (INDEX.HTML) ---
    if (document.getElementById('barangContainer')) {
        loadKategori(); 
        loadStok();
        document.querySelector('.btn-primary:not([onclick="logout()"])')?.addEventListener('click', () => {
            const search = document.getElementById('searchInput').value;
            const kategori = document.getElementById('kategoriFilter').value;
            loadStok(1, search, kategori);
        });
    }

    // --- INISIALISASI HALAMAN ADMIN ---
    if (document.getElementById('loginForm')) {
        document.getElementById('loginForm').addEventListener('submit', (e) => { e.preventDefault(); loginAdmin(); });
    }
    
    if (document.getElementById('registerForm')) {
        document.getElementById('registerForm').addEventListener('submit', (e) => { e.preventDefault(); registerAdmin(); });
    }

    if (document.getElementById('barangForm')) {
        checkAuth();
        loadKategori(); 
        loadSupplier(); 
        loadBarang();
        document.getElementById('barangForm').addEventListener('submit', (e) => { e.preventDefault(); addOrUpdateBarang(); });
    }
    
    if (document.getElementById('kategoriForm')) {
        checkAuth();
        loadKategoriTable();
        document.getElementById('kategoriForm').addEventListener('submit', (e) => { e.preventDefault(); addOrUpdateKategori(); });
    }
    
    if (document.getElementById('supplierForm')) {
        checkAuth();
        loadSupplierTable();
        document.getElementById('supplierForm').addEventListener('submit', (e) => { e.preventDefault(); addOrUpdateSupplier(); });
    }
    
    if (document.getElementById('stokForm')) {
        checkAuth();
        loadBarangForStok();
        loadGudangForStok();
        loadStokTable();
        document.getElementById('stokForm').addEventListener('submit', (e) => { e.preventDefault(); addOrUpdateStok(); });
    }
});
// Duplicate finalization block removed — configuration already declared above
// (kept comments but avoid redeclaration errors)
authToken = authToken || localStorage.getItem('authToken') || null;
currentPage = currentPage || 1;

// ... (Fungsi showAlert, showLoading, hideLoading, checkAuth, logout, loginAdmin, registerAdmin, loadKategori, loadBarang, dll. TETAP SAMA) ...

// ====================== FUNGSI TOKO (INDEX.HTML) ======================

// Load Kategori untuk Filter di Halaman Toko (Sudah Ada, Tapi Dibuat Robust)
async function loadKategori() {
    try {
        const response = await fetch(`${API_BASE_URL}/kategori/`);
        if (!response.ok) throw new Error('Gagal memuat kategori');
        const data = await response.json();
        
        const kategoriSelect = document.getElementById('kategoriFilter');
        if (!kategoriSelect) return;

        kategoriSelect.innerHTML = '<option value="">Semua Kategori</option>';
        data.results.forEach(kategori => {
            const option = document.createElement('option');
            option.value = kategori.id;
            option.textContent = kategori.nama;
            kategoriSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Kategori load error:", error.message);
    }
}

// Load STOK BARANG (Halaman Toko) - PERBAIKAN UTAMA ADA DI SINI
async function loadStok(page = 1, search = '', kategoriId = '') {
    currentPage = page;
    showLoading('loading');
    document.getElementById('error').classList.add('d-none');
    
    let url = `${API_BASE_URL}/stok/?`;
    
    // 1. Kirim parameter SEARCH
    if (search) url += `search=${encodeURIComponent(search)}&`;
    
    // 2. Kirim parameter FILTER KATEGORI (menggunakan format yang sesuai dengan DRF filterset_fields)
    if (kategoriId) url += `barang__kategori=${kategoriId}&`;
    
    url += `page=${page}`;

    try {
        // GET request TIDAK PERLU TOKEN (IsAuthenticatedOrReadOnly)
        const response = await fetch(url);
        
        if (!response.ok) {
            // Jika status 401/403, ini berarti permission error, yang seharusnya tidak terjadi di endpoint Stok.
            throw new Error(`Gagal memuat stok (Status: ${response.status}). Cek apakah server berjalan.`);
        }
        
        const data = await response.json();
        const container = document.getElementById('barangContainer');
        container.innerHTML = '';

        data.results.forEach(stok => {
            const card = document.createElement('div');
            card.className = 'col-md-4 mb-4';
            
            // Pastikan akses properti aman (menggunakan optional chaining ?.)
            const barangNama = stok.barang_nama || 'Nama Tidak Ditemukan';
            const kategoriNama = stok.barang?.kategori_nama || 'Tak Terkategori';
            const sku = stok.barang_sku || 'N/A';
            
            card.innerHTML = `
                <div class="card h-100 shadow-sm">
                    <img src="${stok.barang?.gambar_url || 'https://via.placeholder.com/300x200?text=No+Image'}" 
                         class="card-img-top" alt="${barangNama}">
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title text-primary">${barangNama}</h5>
                        <p class="card-text mb-1"><small class="text-muted">SKU: ${sku} | Kategori: ${kategoriNama}</small></p>
                        
                        <p class="card-text fs-4 fw-bold text-success mt-auto">
                            Stok: ${stok.jumlah} ${stok.barang_satuan || ''}
                        </p>
                        <p class="card-text">Lokasi: ${stok.gudang_nama}</p>
                        ${stok.jumlah <= stok.level_reorder ? `<span class="badge bg-warning text-dark">PERLU REORDER!</span>` : ''}
                    </div>
                </div>
            `;
            container.appendChild(card);
        });

        if (data.results.length === 0) {
            container.innerHTML = '<div class="col-12"><p class="text-center alert alert-warning">Tidak ada barang yang tersedia atau cocok dengan filter.</p></div>';
        }
        
        renderPagination(data.count, page, search, kategoriId);
    } catch (error) {
        document.getElementById('error').textContent = `Kesalahan: ${error.message}. Pastikan server Django berjalan di port 8000.`;
        document.getElementById('error').classList.remove('d-none');
        container.innerHTML = '';
    } finally {
        hideLoading('loading');
    }
}

// Render Pagination (Fungsi ini tetap sama, namun memastikan kita passing parameter filter)
function renderPagination(totalItems, currentPage, search, kategoriId) {
    const itemsPerPage = 10; 
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const paginationEl = document.getElementById('pagination');
    const navEl = document.getElementById('paginationNav');
    
    if (totalPages <= 1) {
        navEl.classList.add('d-none');
        return;
    }
    navEl.classList.remove('d-none');
    paginationEl.innerHTML = '';

    if (currentPage > 1) {
        paginationEl.innerHTML += `<li class="page-item"><button class="page-link" onclick="loadStok(${currentPage - 1}, '${search}', '${kategoriId}')">Previous</button></li>`;
    }

    for (let i = 1; i <= totalPages; i++) {
        const activeClass = i === currentPage ? 'active' : '';
        paginationEl.innerHTML += `
            <li class="page-item ${activeClass}">
                <button class="page-link" onclick="loadStok(${i}, '${search}', '${kategoriId}')">${i}</button>
            </li>
        `;
    }

    if (currentPage < totalPages) {
        paginationEl.innerHTML += `<li class="page-item"><button class="page-link" onclick="loadStok(${currentPage + 1}, '${search}', '${kategoriId}')">Next</button></li>`;
    }
}

// Listener untuk tombol Filter di index.html
document.querySelector('.btn-primary:not([onclick="logout()"])')?.addEventListener('click', () => {
    const search = document.getElementById('searchInput').value;
    const kategori = document.getElementById('kategoriFilter').value;
    loadStok(1, search, kategori); // Mulai dari page 1 saat ada search/filter baru
});


// ====================== FUNGSI ADMIN (CRUD) ======================
// ... (Semua fungsi CRUD Admin (Barang, Kategori, Supplier, Stok) dan Login tetap sama seperti sebelumnya) ...
// ... (Pastikan fungsi-fungsi ini ada di file app.js Anda) ...