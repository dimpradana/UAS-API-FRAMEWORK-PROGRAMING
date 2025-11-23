// ===========================================================================
// 1. KONFIGURASI & STATE
// ===========================================================================
const API_BASE_URL = 'http://127.0.0.1:8000/api';
let authToken = localStorage.getItem('authToken') || null;
let currentPage = 1; 

// ===========================================================================
// 2. FUNGSI HELPER (UI & AUTH)
// ===========================================================================


// ====================== FUNGSI HELPER & KEAMANAN ======================

// Tampilkan Alert (untuk Admin Dashboard)
function showAlert(message, isSuccess = true) {
    const alertEl = document.getElementById('alertMessage') || document.getElementById('error') || document.getElementById('errorAlert');
    if (alertEl) {
        alertEl.textContent = message;
        alertEl.className = `alert ${isSuccess ? 'alert-success' : 'alert-danger'} show`;
        alertEl.classList.remove('d-none');
        setTimeout(() => {
            alertEl.classList.add('d-none');
            alertEl.classList.remove('show');
        }, 3000);
    } else {
        if(!isSuccess) alert(message);
    }
}

function showLoading(elId = 'loading') {
    const loadingEl = document.getElementById(elId);
    if (loadingEl) loadingEl.classList.remove('d-none');
}

function hideLoading(elId = 'loading') {
    const loadingEl = document.getElementById(elId);
    if (loadingEl) loadingEl.classList.add('d-none');
}

function checkAuth() {
    const path = window.location.pathname;
    if (path.includes('login.html') || path.includes('register.html') || path.endsWith('index.html') || path === '/') {
        return;
    }
    if (!authToken) {
        window.location.href = 'login.html';
    }
}

function logout() {
    localStorage.removeItem('authToken');
    authToken = null;
    window.location.href = 'login.html';
}

// ===========================================================================
// 3. FUNGSI AUTH (LOGIN & REGISTER)
// ===========================================================================

async function loginAdmin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const btn = document.querySelector('button[type="submit"]');
    
    if(btn) { btn.disabled = true; btn.textContent = "Loading..."; }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/token/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) throw new Error('Username atau Password salah!');
        const data = await response.json();
        
        authToken = data.token;
        localStorage.setItem('authToken', authToken);
        window.location.href = 'dashboard.html'; 
    } catch (error) {
        showAlert(error.message, false);
        if(btn) { btn.disabled = false; btn.textContent = "Login"; }
    }
}

async function registerAdmin() {
    const username = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const password_confirm = document.getElementById('regPasswordConfirm').value;

    if (password !== password_confirm) {
        showAlert("Password tidak sama!", false);
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/register/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password, password_confirm })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(Object.values(err).flat()[0] || "Gagal registrasi");
        }
        
        showAlert("Berhasil! Silakan Login.", true);
        document.getElementById('registerForm').reset();
        setTimeout(() => window.location.href = 'login.html', 1500);
    } catch (error) {
        showAlert(error.message, false);
    }
}

// ===========================================================================
// 4. FUNGSI PUBLIK (HALAMAN TOKO)
// ===========================================================================

async function loadPublicData() {
    showLoading('loading');
    try {
        const [kategoriRes, stokRes] = await Promise.all([
            fetch(`${API_BASE_URL}/kategori/`),
            fetch(`${API_BASE_URL}/stok/`)
        ]);

        const katData = await kategoriRes.json();
        const katSelect = document.getElementById('kategoriFilter');
        if (katSelect) {
            katSelect.innerHTML = '<option value="">Semua Kategori</option>';
            (katData.results || katData).forEach(k => {
                katSelect.innerHTML += `<option value="${k.id}">${k.nama}</option>`;
            });
        }

        if (stokRes.ok) {
            const stokData = await stokRes.json();
            renderPublicStok(stokData);
        }
    } catch (e) { console.error(e); } finally { hideLoading('loading'); }
}

async function loadStokPublic(page = 1, search = '', kategoriId = '') {
    showLoading('loading');
    let url = `${API_BASE_URL}/stok/?page=${page}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (kategoriId) url += `&barang__kategori=${kategoriId}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        renderPublicStok(data);
        currentPage = page;
    } catch (e) { console.error(e); } finally { hideLoading('loading'); }
}

function renderPublicStok(data) {
    const container = document.getElementById('barangContainer');
    container.innerHTML = '';
    const list = data.results || data;
    
    if (list.length === 0) {
        container.innerHTML = '<div class="col-12 alert alert-warning text-center">Produk tidak ditemukan.</div>';
        return;
    }

    list.forEach(stok => {
        const img = getFullImageUrl(
            stok.barang_detail?.gambar_url || 
            stok.barang?.gambar_url || 
            stok.barang_gambar || 
            stok.barang?.gambar || 
            stok.barang_image
        );
        const nama = stok.barang_nama || 'Produk';
        
        container.innerHTML += `
            <div class="col-md-4 mb-4">
                <div class="card h-100 shadow-sm">
                    <img src="${img}" class="card-img-top" style="height: 200px; object-fit: cover;" alt="${nama}" onerror="this.onerror=null;this.src='https://via.placeholder.com/300x200?text=Image+Error';">
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title text-primary">${nama}</h5>
                        <p class="card-text mb-1 text-muted">Stok: ${stok.jumlah}</p>
                        <p class="card-text small">Lokasi: ${stok.gudang_nama}</p>
                    </div>
                </div>
            </div>`;
    });

    if (data.results) renderPagination(data.count, currentPage, '', '', 'public');
}

// ===========================================================================
// 5. FUNGSI ADMIN (CRUD)
// ===========================================================================

// Helper untuk Load Dropdown
async function loadDropdownData(endpoint, elementId, placeholder) {
    try {
        const res = await fetch(`${API_BASE_URL}/${endpoint}/`, { headers: { 'Authorization': `Token ${authToken}` } });
        const data = await res.json();
        const el = document.getElementById(elementId);
        if (!el) return;

        el.innerHTML = `<option value="">${placeholder}</option>`;
        (data.results || data).forEach(item => {
            let text = item.nama;
            if (elementId === 'barangStok') text += ` (${item.sku})`;
            el.innerHTML += `<option value="${item.id}">${text}</option>`;
        });
    } catch (e) { console.error(e); }
}

// Load list barang khusus untuk form stok
async function loadBarangForStok() {
    try {
        const res = await fetch(`${API_BASE_URL}/barang/`, { headers: { 'Authorization': `Token ${authToken}` } });
        const data = await res.json();
        const el = document.getElementById('barangStok');
        if (!el) return;

        el.innerHTML = '<option value="">Pilih Barang</option>';
        (data.results || data).forEach(b => {
            el.innerHTML += `<option value="${b.id}">${b.nama} (${b.sku || 'N/A'})</option>`;
        });
    } catch (e) { console.error('loadBarangForStok error:', e); }
}

// Load list gudang khusus untuk form stok
async function loadGudangForStok() {
    try {
        const res = await fetch(`${API_BASE_URL}/gudang/`, { headers: { 'Authorization': `Token ${authToken}` } });
        const data = await res.json();
        const el = document.getElementById('gudangStok');
        if (!el) return;

        el.innerHTML = '<option value="">Pilih Gudang</option>';
        (data.results || data).forEach(g => {
            el.innerHTML += `<option value="${g.id}">${g.nama}</option>`;
        });
    } catch (e) { console.error('loadGudangForStok error:', e); }
}

// --- A. ADMIN KATEGORI (FIXED) ---
async function loadKategoriTable() {
    showLoading('loadingTable');
    try {
        const res = await fetch(`${API_BASE_URL}/kategori/`, { headers: { 'Authorization': `Token ${authToken}` }});
        const data = await res.json();
        const tbody = document.getElementById('kategoriTableBody');
        tbody.innerHTML = '';
        
        const items = data.results || data;
        const isAdmin = window.isAdmin === true;
        items.forEach(k => {
            const actions = `
                <button onclick="setKategoriEdit(${k.id})" class="btn btn-sm btn-warning">Edit</button>` +
                (isAdmin ? ` <button onclick="deleteItem('kategori', ${k.id}, loadKategoriTable)" class="btn btn-sm btn-danger">Hapus</button>` : '');

            tbody.innerHTML += `
                <tr>
                    <td>${k.nama}</td>
                    <td>${k.deskripsi || '-'}</td>
                    <td>${new Date(k.dibuat_pada || Date.now()).toLocaleDateString()}</td>
                    <td>${actions}</td>
                </tr>`;
        });
    } catch (e) { showAlert(e.message, false); } finally { hideLoading('loadingTable'); }
}

async function addOrUpdateKategori() {
    const id = document.getElementById('kategoriId').value;
    const payload = {
        nama: document.getElementById('nama').value,
        deskripsi: document.getElementById('deskripsi').value
    };
    await submitData('kategori', id, payload, loadKategoriTable, () => {
        document.getElementById('kategoriForm').reset();
        document.getElementById('kategoriId').value = '';
        document.getElementById('formTitle').textContent = 'Tambah Kategori Baru';
    });
}

async function setKategoriEdit(id) {
    const res = await fetch(`${API_BASE_URL}/kategori/${id}/`, { headers: { 'Authorization': `Token ${authToken}` }});
    const data = await res.json();
    document.getElementById('formTitle').textContent = 'Edit Kategori';
    document.getElementById('kategoriId').value = data.id;
    document.getElementById('nama').value = data.nama;
    document.getElementById('deskripsi').value = data.deskripsi || '';
}

// --- B. ADMIN SUPPLIER (FIXED) ---
async function loadSupplierTable() {
    showLoading('loadingTable');
    try {
        const res = await fetch(`${API_BASE_URL}/supplier/`, { headers: { 'Authorization': `Token ${authToken}` }});
        const data = await res.json();
        const tbody = document.getElementById('supplierTableBody');
        tbody.innerHTML = '';
        
        const items = data.results || data;
        const isAdmin = window.isAdmin === true;
        items.forEach(s => {
            const actions = `
                <button onclick="setSupplierEdit(${s.id})" class="btn btn-sm btn-warning">Edit</button>` +
                (isAdmin ? ` <button onclick="deleteItem('supplier', ${s.id}, loadSupplierTable)" class="btn btn-sm btn-danger">Hapus</button>` : '');

            tbody.innerHTML += `
                <tr>
                    <td>${s.nama}</td>
                    <td>${s.kontak || '-'}</td>
                    <td>${s.telepon || '-'}</td>
                    <td>${s.email || '-'}</td>
                    <td>${actions}</td>
                </tr>`;
        });
        // Update supplier count badge if exists
        const countEl = document.getElementById('supplierCount');
        if (countEl) countEl.textContent = `${data.count || items.length} Data`;
    } catch (e) { showAlert(e.message, false); } finally { hideLoading('loadingTable'); }
}

async function addOrUpdateSupplier() {
    const id = document.getElementById('supplierId').value;
    const payload = {
        nama: document.getElementById('namaSupplier').value,
        kontak: document.getElementById('kontakSupplier').value,
        telepon: document.getElementById('teleponSupplier').value,
        email: document.getElementById('emailSupplier').value,
        alamat: document.getElementById('alamatSupplier') ? document.getElementById('alamatSupplier').value : ''
    };
    await submitData('supplier', id, payload, loadSupplierTable, () => {
        resetSupplierForm();
    });
}

async function setSupplierEdit(id) {
    const res = await fetch(`${API_BASE_URL}/supplier/${id}/`, { headers: { 'Authorization': `Token ${authToken}` }});
    const data = await res.json();
    document.getElementById('formTitle').textContent = 'Edit Supplier';
    document.getElementById('supplierId').value = data.id;
    document.getElementById('namaSupplier').value = data.nama || '';
    document.getElementById('kontakSupplier').value = data.kontak || '';
    document.getElementById('teleponSupplier').value = data.telepon || '';
    document.getElementById('emailSupplier').value = data.email || '';
    if (document.getElementById('alamatSupplier')) document.getElementById('alamatSupplier').value = data.alamat || '';
}

function resetSupplierForm() {
    const form = document.getElementById('supplierForm');
    if (form) form.reset();
    const idEl = document.getElementById('supplierId');
    if (idEl) idEl.value = '';
    const title = document.getElementById('formTitle');
    if (title) title.textContent = 'Tambah Supplier Baru';
}

// --- C. ADMIN BARANG ---
async function loadBarangTable() {
    showLoading('loadingTable');
    try {
        const res = await fetch(`${API_BASE_URL}/barang/`, { headers: { 'Authorization': `Token ${authToken}` }});
        const data = await res.json();
        const tbody = document.getElementById('barangTableBody');
        tbody.innerHTML = '';
        const isAdmin = window.isAdmin === true;
        (data.results || data).forEach(b => {
            const actions = `
                <button onclick="setBarangEdit(${b.id})" class="btn btn-sm btn-warning">Edit</button>` +
                (isAdmin ? ` <button onclick="deleteItem('barang', ${b.id}, loadBarangTable)" class="btn btn-sm btn-danger">Hapus</button>` : '');

            tbody.innerHTML += `
                <tr>
                    <td>${b.sku}</td>
                    <td>${b.nama}</td>
                    <td>${b.kategori_nama || '-'}</td>
                    <td>${b.satuan}</td>
                    <td>${actions}</td>
                </tr>`;
        });
    } catch (e) { console.error(e); } finally { hideLoading('loadingTable'); }
}

async function addOrUpdateBarang() {
    const id = document.getElementById('barangId').value;
    const payload = {
        sku: document.getElementById('sku').value,
        nama: document.getElementById('nama').value,
        kategori: document.getElementById('kategori').value,
        supplier: document.getElementById('supplier').value || null,
        satuan: document.getElementById('satuan').value,
        gambar_url: document.getElementById('gambar_url').value
    };
    await submitData('barang', id, payload, loadBarangTable, () => {
        document.getElementById('barangForm').reset();
        document.getElementById('barangId').value = '';
        document.getElementById('formTitle').textContent = 'Tambah Barang';
    });
}

async function setBarangEdit(id) {
    const res = await fetch(`${API_BASE_URL}/barang/${id}/`, { headers: { 'Authorization': `Token ${authToken}` }});
    const data = await res.json();
    document.getElementById('barangId').value = data.id;
    document.getElementById('sku').value = data.sku;
    document.getElementById('nama').value = data.nama;
    document.getElementById('kategori').value = data.kategori;
    document.getElementById('supplier').value = data.supplier || '';
    document.getElementById('satuan').value = data.satuan;
    document.getElementById('gambar_url').value = data.gambar_url || '';
}

// --- D. ADMIN STOK ---
async function loadStokTable(page = 1) {
    const search = document.getElementById('searchInput')?.value || '';
    const kat = document.getElementById('kategoriFilter')?.value || '';
    let url = `${API_BASE_URL}/stok/?page=${page}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (kat) url += `&barang__kategori=${kat}`;

    try {
        const res = await fetch(url, { headers: { 'Authorization': `Token ${authToken}` }});
        const data = await res.json();
        const tbody = document.getElementById('stokTableBody');
        tbody.innerHTML = '';

        // Update stok count badge if exists
        const stokCountEl = document.getElementById('stokCount');
        if (stokCountEl) stokCountEl.textContent = `${data.count !== undefined ? data.count : (data.results || data).length} Items`;

        const list = data.results || data;
        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Data Kosong</td></tr>';
            return;
        }

        list.forEach(stok => {
            const row = `
                <tr class="${stok.jumlah <= stok.level_reorder ? 'table-warning' : ''}">
                    <td>${stok.barang_nama || stok.barang_detail?.nama} <br><small>${stok.barang_sku || ''}</small></td>
                    <td>${stok.gudang_nama || stok.gudang_detail?.nama}</td>
                    <td class="text-center"><strong>${stok.jumlah}</strong></td>
                    <td class="text-center">${stok.level_reorder}</td>
                    <td>${new Date(stok.diperbarui_pada).toLocaleDateString('id-ID')}</td>
                    <td>
                        <button onclick="openStockOutModal(${stok.id}, ${stok.jumlah})" class="btn btn-sm btn-danger me-1">Keluar</button>
                        <button onclick="setStokEdit(${stok.id})" class="btn btn-sm btn-warning">Edit</button>
                    </td>
                </tr>`;
            tbody.innerHTML += row;
        });
        
        if(data.results) renderPagination(data.count, page, search, kat, 'admin');

    } catch (e) { showAlert("Gagal load stok", false); }
}

async function addOrUpdateStok() {
    const id = document.getElementById('stokId').value;
    const payload = {
        barang: document.getElementById('barangStok').value,
        gudang: document.getElementById('gudangStok').value,
        jumlah: Number(document.getElementById('jumlahStok').value) || 0,
        level_reorder: Number(document.getElementById('levelReorder').value) || 0
    };
    await submitData('stok', id, payload, () => loadStokTable(currentPage), resetStokForm);
}

async function setStokEdit(id) {
    const res = await fetch(`${API_BASE_URL}/stok/${id}/`, { headers: { 'Authorization': `Token ${authToken}` }});
    const data = await res.json();
    document.getElementById('stokId').value = data.id;
    document.getElementById('barangStok').value = data.barang;
    document.getElementById('gudangStok').value = data.gudang;
    document.getElementById('jumlahStok').value = data.jumlah;
    document.getElementById('levelReorder').value = data.level_reorder;
    document.getElementById('stokForm').scrollIntoView({behavior: 'smooth'});
}

function resetStokForm() {
    document.getElementById('stokForm').reset();
    document.getElementById('stokId').value = '';
}

// ----------------- Stock-Out (Keluar Stok) -----------------
function openStockOutModal(stokId, currentJumlah) {
    const modalEl = document.getElementById('stockOutModal');
    if (!modalEl) {
        alert('Modal stok keluar tidak ditemukan.');
        return;
    }
    document.getElementById('modalStokId').value = stokId;
    document.getElementById('modalJumlahKeluar').value = '';
    document.getElementById('modalCatatan').value = '';
    document.getElementById('modalKeperluan').value = 'Penjualan';
    document.getElementById('modalStokInfo').textContent = `Stok saat ini: ${currentJumlah}`;

    // Show bootstrap modal
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

async function processStockOut() {
    const stokId = document.getElementById('modalStokId').value;
    const jumlahKeluar = Number(document.getElementById('modalJumlahKeluar').value) || 0;
    const keperluan = document.getElementById('modalKeperluan').value;
    const catatan = document.getElementById('modalCatatan').value || '';

    if (!stokId || jumlahKeluar <= 0) { showAlert('Masukkan jumlah keluar yang valid', false); return; }

    try {
        // Ambil data stok saat ini untuk memastikan jumlah valid
        const res = await fetch(`${API_BASE_URL}/stok/${stokId}/`, { headers: { 'Authorization': `Token ${authToken}` } });
        if (!res.ok) throw new Error('Gagal mengambil data stok');
        const stok = await res.json();

        if (jumlahKeluar > stok.jumlah) { showAlert('Jumlah keluar melebihi stok tersedia', false); return; }

        const newJumlah = stok.jumlah - jumlahKeluar;

        // Update stok (PUT)
        const payload = { barang: stok.barang, gudang: stok.gudang, jumlah: newJumlah, level_reorder: stok.level_reorder };
        const updateRes = await fetch(`${API_BASE_URL}/stok/${stokId}/`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${authToken}` },
            body: JSON.stringify(payload)
        });
        if (!updateRes.ok) {
            const err = await updateRes.json().catch(() => ({}));
            throw new Error(err.detail || JSON.stringify(err));
        }

        // Create riwayat stok (log)
        try {
            await fetch(`${API_BASE_URL}/riwayat-stok/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${authToken}` },
                body: JSON.stringify({ stok: stokId, tipe: 'OUT', jumlah: jumlahKeluar, catatan: `${keperluan}${catatan ? ' - ' + catatan : ''}` })
            });
        } catch (e) {
            // Jika gagal buat riwayat (permission), tetap lanjut
            console.warn('Gagal membuat riwayat stok:', e);
        }

        // Tutup modal
        const modalEl = document.getElementById('stockOutModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        showAlert('Stok berhasil dikeluarkan', true);
        loadStokTable(currentPage);
    } catch (e) {
        console.error('processStockOut error', e);
        showAlert('Gagal memproses stok keluar: ' + (e.message || e), false);
    }
}

// --- HELPER UTILS ---
async function submitData(endpoint, id, payload, reloadCb, resetCb) {
    const url = id ? `${API_BASE_URL}/${endpoint}/${id}/` : `${API_BASE_URL}/${endpoint}/`;
    const method = id ? 'PUT' : 'POST';
    
    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${authToken}` },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(JSON.stringify(err));
        }

        showAlert("Data berhasil disimpan!", true);
        resetCb();
        reloadCb();
    } catch (e) { showAlert("Gagal: " + e.message, false); }
}

async function deleteItem(endpoint, id, reloadCb) {
    if (!window.isAdmin) { showAlert('Hanya admin yang dapat menghapus data.', false); return; }
    if (!confirm("Yakin hapus?")) return;
    try {
        const res = await fetch(`${API_BASE_URL}/${endpoint}/${id}/`, {
            method: 'DELETE',
            headers: { 'Authorization': `Token ${authToken}` }
        });
        if (res.ok) { showAlert("Terhapus!", true); reloadCb(); }
    } catch (e) { showAlert("Gagal hapus", false); }
}

function renderPagination(total, page, search, kat, type) {
    const el = document.getElementById('pagination');
    const nav = document.getElementById('paginationNav');
    if (!el || !nav) return;
    
    const pages = Math.ceil(total / 10);
    if (pages <= 1) { nav.classList.add('d-none'); return; }
    
    nav.classList.remove('d-none');
    el.innerHTML = '';
    const func = type === 'public' ? 'loadStokPublic' : 'loadStokTable';

    for (let i = 1; i <= pages; i++) {
        el.innerHTML += `<li class="page-item ${i === page ? 'active' : ''}">
            <button class="page-link" onclick="${func}(${i}, '${search}', '${kat}')">${i}</button>
        </li>`;
    }
}

// ===========================================================================
// 6. INISIALISASI (EVENT LISTENER)
// ===========================================================================
document.addEventListener('DOMContentLoaded', async () => {
    // fetch current user (to determine admin privileges) before rendering admin pages
    await fetchCurrentUser();
    
    // 1. Halaman Auth
    if (document.getElementById('loginForm')) {
        document.getElementById('loginForm').addEventListener('submit', (e) => { e.preventDefault(); loginAdmin(); });
        return; 
    }
    
    if (document.getElementById('registerForm')) {
        document.getElementById('registerForm').addEventListener('submit', (e) => { e.preventDefault(); registerAdmin(); });
        return;
    }

    // 2. Halaman Publik
    if (document.getElementById('barangContainer')) {
        loadPublicData();
        document.getElementById('btnSearch')?.addEventListener('click', () => {
            loadStokPublic(1, document.getElementById('searchInput').value, document.getElementById('kategoriFilter').value);
        });
        return;
    }

    // 3. Halaman Admin
    checkAuth();

    // Admin Kategori
    if (document.getElementById('kategoriForm')) {
        checkAuth();
        loadKategoriTable();
        document.getElementById('kategoriForm').addEventListener('submit', (e) => { e.preventDefault(); addOrUpdateKategori(); });
    }

    // Admin Supplier
    if (document.getElementById('supplierForm')) {
        checkAuth();
        loadSupplierTable();
        document.getElementById('supplierForm').addEventListener('submit', (e) => { e.preventDefault(); addOrUpdateSupplier(); });
    }

    // Admin Barang
    if (document.getElementById('barangForm')) {
        Promise.all([
            loadDropdownData('kategori', 'kategori', 'Pilih Kategori'),
            loadDropdownData('supplier', 'supplier', 'Pilih Supplier'),
            loadBarangTable()
        ]);
        document.getElementById('barangForm').addEventListener('submit', (e) => { e.preventDefault(); addOrUpdateBarang(); });
    }

    // Admin Stok
    if (document.getElementById('stokForm')) {
        checkAuth();
        loadBarangForStok();
        loadGudangForStok();
        loadStokTable();
        document.getElementById('stokForm').addEventListener('submit', (e) => { e.preventDefault(); addOrUpdateStok(); });
        // Attach download button if present
        const dlBtn = document.getElementById('downloadStockBtn');
        if (dlBtn) dlBtn.addEventListener('click', handleDownloadStock);
        // Attach stock-out modal confirm button
        const confirmBtn = document.getElementById('modalConfirmOut');
        if (confirmBtn) confirmBtn.addEventListener('click', processStockOut);
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
    const errEl = document.getElementById('error');
    if (errEl) errEl.classList.add('d-none');
    
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
        if (!container) return;
        container.innerHTML = '';

        const items = data.results || data;
        if (!items || items.length === 0) {
            container.innerHTML = '<div class="col-12 alert alert-warning text-center">Produk tidak ditemukan.</div>';
            if (data.results) renderPagination(data.count, currentPage, '', '', 'public');
            return;
        }

        // Build DOM nodes per item so we can lazily fetch barang detail if image missing
        items.forEach(stok => {
            const barangNama = stok.barang_nama || stok.barang?.nama || 'Nama Tidak Ditemukan';
            const kategoriNama = stok.barang?.kategori_nama || stok.barang?.kategori || 'Tak Terkategori';
            const sku = stok.barang_sku || stok.barang?.sku || 'N/A';
            const satuan = stok.barang_satuan || stok.barang?.satuan || '';

            const imgCandidate = stok.barang_detail?.gambar_url || stok.barang?.gambar_url || stok.barang_gambar || stok.barang?.gambar || stok.barang_image;
            const imgUrl = getFullImageUrl(imgCandidate);

            const col = document.createElement('div');
            col.className = 'col-md-4 mb-4';

            const card = document.createElement('div');
            card.className = 'card h-100 shadow-sm';

            const imgWrap = document.createElement('div');
            imgWrap.style.cssText = 'height: 200px; overflow: hidden; background: #f8f9fa;';

            const imgEl = document.createElement('img');
            imgEl.className = 'card-img-top h-100 w-100';
            imgEl.style.objectFit = 'cover';
            imgEl.alt = barangNama;
            imgEl.src = imgUrl;
            imgEl.onerror = function() { this.onerror = null; this.src = 'https://via.placeholder.com/300x200?text=Image+Error'; };

            imgWrap.appendChild(imgEl);
            card.appendChild(imgWrap);

            const body = document.createElement('div');
            body.className = 'card-body d-flex flex-column';
            body.innerHTML = `
                <h5 class="card-title text-primary">${barangNama}</h5>
                <p class="card-text mb-1"><small class="text-muted">SKU: ${sku} | Kategori: ${kategoriNama}</small></p>
                <p class="card-text fs-4 fw-bold text-success mt-auto">Stok: ${stok.jumlah} ${satuan}</p>
                <p class="card-text">Lokasi: ${stok.gudang_nama || stok.gudang?.nama || '-'}</p>
                ${stok.jumlah <= stok.level_reorder ? `<span class="badge bg-warning text-dark">PERLU REORDER!</span>` : ''}
            `;

            card.appendChild(body);
            col.appendChild(card);
            container.appendChild(col);

            // Jika image tidak ada pada stok object, coba ambil dari endpoint barang detail
            const isPlaceholder = imgCandidate === undefined || imgCandidate === null || String(imgCandidate).trim() === '';
            if (isPlaceholder && stok.barang) {
                fetch(`${API_BASE_URL}/barang/${stok.barang}/`).then(r => {
                    if (!r.ok) return null;
                    return r.json();
                }).then(bdata => {
                    if (bdata && (bdata.gambar_url || bdata.gambar)) {
                        imgEl.src = getFullImageUrl(bdata.gambar_url || bdata.gambar);
                    }
                }).catch(() => {});
            }
        });

        if (data.count !== undefined) renderPagination(data.count, currentPage, '', '', 'public');

    } catch (error) {
        console.error('loadStok error:', error);
        showAlert(error.message || 'Gagal memuat stok', false);
        if (errEl) errEl.classList.remove('d-none');
    } finally {
        hideLoading('loading');
    }
}

// Normalisasi URL gambar: dukung absolute, protocol-relative, dan path relatif
function getFullImageUrl(url) {
    const placeholder = 'https://via.placeholder.com/300x200?text=No+Image';
    if (!url) return placeholder;
    try {
        // new URL handles absolute and relative URLs when base provided
        const full = new URL(url, window.location.origin);
        return full.href;
    } catch (e) {
        return placeholder;
    }
}

// Fetch all stok items by following pagination `next` links
async function fetchAllStoks() {
    let url = `${API_BASE_URL}/stok/`;
    let all = [];
    try {
        while (url) {
            const res = await fetch(url, { headers: { 'Authorization': `Token ${authToken}` } });
            if (!res.ok) throw new Error('Gagal mengambil data stok');
            const data = await res.json();
            const items = data.results || data;
            all = all.concat(items);
            url = data.next || null;
        }
    } catch (e) {
        console.error('fetchAllStoks error', e);
        throw e;
    }
    return all;
}

// Fetch all riwayat-stok entries with tipe=OUT
async function fetchAllRiwayatOuts() {
    let url = `${API_BASE_URL}/riwayat-stok/?tipe=OUT`;
    let all = [];
    try {
        while (url) {
            const res = await fetch(url, { headers: { 'Authorization': `Token ${authToken}` } });
            if (!res.ok) throw new Error('Gagal mengambil data riwayat stok');
            const data = await res.json();
            const items = data.results || data;
            all = all.concat(items);
            url = data.next || null;
        }
    } catch (e) {
        console.error('fetchAllRiwayatOuts error', e);
        throw e;
    }
    return all;
}

// Export stok data to CSV and trigger download (Excel-compatible)
function exportStoksToCSV(items) {
    if (!items || items.length === 0) {
        showAlert('Tidak ada data stok untuk di-download', false);
        return;
    }

    const headers = ['ID','Barang','SKU','Kategori','Gudang','Jumlah','Level Reorder','Satuan','Diperbarui Pada'];
    const rows = items.map(s => {
        const nama = s.barang_nama || s.barang?.nama || '';
        const sku = s.barang_sku || s.barang?.sku || '';
        const kategori = s.barang?.kategori_nama || s.barang?.kategori || '';
        const gudang = s.gudang_nama || s.gudang_detail?.nama || '';
        const jumlah = s.jumlah ?? '';
        const level = s.level_reorder ?? '';
        const satuan = s.barang_satuan || s.barang?.satuan || '';
        const updated = s.diperbarui_pada || s.updated_at || '';
        return [s.id, nama, sku, kategori, gudang, jumlah, level, satuan, updated];
    });

    // Build CSV content (escape quotes)
    const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const now = new Date().toISOString().slice(0,10);
    a.href = url;
    a.download = `stok_export_${now}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

// Export combined data to XLSX with two sheets: 'Stok' and 'Stok Keluar'
async function exportStoksToXLSX(stokItems, riwayatItems) {
    // If SheetJS not available, fallback to CSV of stok only
    if (typeof XLSX === 'undefined') {
        showAlert('SheetJS tidak tersedia, men-download CSV stok saja', false);
        exportStoksToCSV(stokItems);
        return;
    }

    // Prepare stok sheet
    const stokRows = (stokItems || []).map(s => ({
        ID: s.id,
        Barang: s.barang_nama || (s.barang && s.barang.nama) || '',
        SKU: s.barang_sku || (s.barang && s.barang.sku) || '',
        Kategori: (s.barang && (s.barang.kategori_nama || s.barang.kategori)) || '',
        Gudang: s.gudang_nama || (s.gudang_detail && s.gudang_detail.nama) || '',
        Jumlah: s.jumlah ?? '',
        LevelReorder: s.level_reorder ?? '',
        Satuan: s.barang_satuan || (s.barang && s.barang.satuan) || '',
        DiperbaruiPada: s.diperbarui_pada || s.updated_at || ''
    }));

    // Prepare riwayat keluar sheet
    const riwayatRows = (riwayatItems || []).map(r => ({
        ID: r.id,
        StokID: r.stok || '',
        Barang: r.stok_barang || r.stok_nama || r.barang_nama || '',
        Tipe: r.tipe || '',
        Jumlah: r.jumlah ?? '',
        Catatan: r.catatan || '',
        DibuatPada: r.dibuat_pada || r.created_at || '' ,
        DibuatOleh: r.dibuat_oleh_nama || r.dibuat_oleh || ''
    }));

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(stokRows);
    XLSX.utils.book_append_sheet(wb, ws1, 'Stok');
    const ws2 = XLSX.utils.json_to_sheet(riwayatRows);
    XLSX.utils.book_append_sheet(wb, ws2, 'Stok Keluar');

    const now = new Date().toISOString().slice(0,10);
    XLSX.writeFile(wb, `laporan_stok_${now}.xlsx`);
}

// Handler to run when user clicks download
async function handleDownloadStock() {
    try {
        showLoading('loadingTable');
        const [items, riwayat] = await Promise.all([
            fetchAllStoks(),
            fetchAllRiwayatOuts().catch(() => [])
        ]);

        // If XLSX (SheetJS) available, produce a workbook with two sheets
        if (typeof XLSX !== 'undefined') {
            await exportStoksToXLSX(items, riwayat);
        } else {
            // Fallback: CSV of stok only
            exportStoksToCSV(items);
        }
        showAlert('Download dimulai', true);
    } catch (e) {
        showAlert('Gagal download: ' + (e.message || e), false);
    } finally {
        hideLoading('loadingTable');
    }
}

// Fetch current user info (to know if user is admin)
async function fetchCurrentUser() {
    window.isAdmin = false;
    window.currentUserName = '';
    if (!authToken) return;
    try {
        const res = await fetch(`${API_BASE_URL}/me/`, { headers: { 'Authorization': `Token ${authToken}` } });
        if (!res.ok) return;
        const data = await res.json();
        window.isAdmin = !!data.is_staff;
        window.currentUserName = data.username || data.nama || data.email || '';

        // Update role display in navbar if present
        const el = document.getElementById('userRoleDisplay');
        if (el) {
            const roleLabel = window.isAdmin ? 'Admin' : 'Staf';
            const name = window.currentUserName ? ` — ${window.currentUserName}` : '';
            el.textContent = `Anda sebagai ${roleLabel}${name}`;
            el.classList.remove('d-none');
        }
    } catch (e) { console.warn('Could not fetch current user', e); }
}