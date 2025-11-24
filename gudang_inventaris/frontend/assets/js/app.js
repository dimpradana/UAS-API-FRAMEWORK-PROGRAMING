// ===========================================================================
// 1. KONFIGURASI & STATE
// ===========================================================================
const API_BASE_URL = 'http://127.0.0.1:8000/api';
let authToken = localStorage.getItem('authToken') || null;
let currentPage = 1; 
// In-memory API cache and request controllers to optimize network usage
const apiCache = {}; // simple cache: apiCache[endpoint] = data
let stokListAbortController = null;
let publicStokAbortController = null;

// Utility: debounce to avoid spamming requests
function debounce(fn, wait = 300) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
    };
}

// Build headers with optional Content-Type and conditional Authorization
function authHeaders(extra = {}) {
    const headers = Object.assign({}, extra || {});
    if (authToken) headers['Authorization'] = `Token ${authToken}`;
    return headers;
}

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
    if (!container) return;
    container.innerHTML = '';
    const list = data.results || data || [];
    if (!list || list.length === 0) {
        container.innerHTML = '<div class="col-12 alert alert-warning text-center">Produk tidak ditemukan.</div>';
        if (data.results) renderPagination(data.count, currentPage, '', '', 'public');
        return;
    }

    const frag = document.createDocumentFragment();
    list.forEach(stok => {
        const imgUrl = getFullImageUrl(
            stok.barang_detail?.gambar_url || stok.barang?.gambar_url || stok.barang_gambar || stok.barang?.gambar || stok.barang_image
        );
        const nama = stok.barang_nama || stok.barang?.nama || 'Produk';

        const col = document.createElement('div');
        col.className = 'col-md-4 mb-4';

        const card = document.createElement('div');
        card.className = 'card h-100 shadow-sm';

        const img = document.createElement('img');
        img.className = 'card-img-top';
        img.style.height = '200px';
        img.style.objectFit = 'cover';
        img.loading = 'lazy';
        img.alt = nama;
        img.src = imgUrl;
        img.onerror = function() { this.onerror=null; this.src='https://via.placeholder.com/300x200?text=Image+Error'; };

        const body = document.createElement('div');
        body.className = 'card-body d-flex flex-column';
        const title = document.createElement('h5');
        title.className = 'card-title text-primary';
        title.textContent = nama;
        const stokText = document.createElement('p');
        stokText.className = 'card-text mb-1 text-muted';
        stokText.textContent = `Stok: ${stok.jumlah}`;
        const lokasiText = document.createElement('p');
        lokasiText.className = 'card-text small';
        lokasiText.textContent = `Lokasi: ${stok.gudang_nama || '-'}`;

        body.appendChild(title);
        body.appendChild(stokText);
        body.appendChild(lokasiText);

        card.appendChild(img);
        card.appendChild(body);
        col.appendChild(card);
        frag.appendChild(col);

        // If image missing, lazy fetch barang detail but don't block render
        const isPlaceholder = !stok.barang_detail?.gambar_url && !stok.barang?.gambar_url && !stok.barang_gambar && !stok.barang?.gambar && !stok.barang_image;
        if (isPlaceholder && stok.barang) {
            fetch(`${API_BASE_URL}/barang/${stok.barang}/`).then(r => r.ok ? r.json() : null).then(bdata => {
                if (bdata && (bdata.gambar_url || bdata.gambar)) img.src = getFullImageUrl(bdata.gambar_url || bdata.gambar);
            }).catch(() => {});
        }
    });

    container.appendChild(frag);
    if (data.results) renderPagination(data.count, currentPage, '', '', 'public');
}

// ===========================================================================
// 5. FUNGSI ADMIN (CRUD)
// ===========================================================================

// Helper untuk Load Dropdown
async function loadDropdownData(endpoint, elementId, placeholder) {
    try {
        // Use cached dropdown if available
        if (apiCache[endpoint]) {
            const data = apiCache[endpoint];
            const el = document.getElementById(elementId);
            if (!el) return;
            el.innerHTML = `<option value="">${placeholder}</option>`;
            (data.results || data).forEach(item => {
                let text = item.nama;
                if (elementId === 'barangStok') text += ` (${item.sku})`;
                el.innerHTML += `<option value="${item.id}">${text}</option>`;
            });
            return;
        }

        const res = await fetch(`${API_BASE_URL}/${endpoint}/`, { headers: authHeaders() });
        const data = await res.json();
        // cache for future
        apiCache[endpoint] = data;
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
        const el = document.getElementById('barangStok');
        if (!el) return;
        // Use cache if available
        const data = apiCache['barang'] ? apiCache['barang'] : await (async () => { const r = await fetch(`${API_BASE_URL}/barang/`, { headers: authHeaders() }); const j = await r.json(); apiCache['barang'] = j; return j; })();

        el.innerHTML = '<option value="">Pilih Barang</option>';
        (data.results || data || []).forEach(b => {
            el.innerHTML += `<option value="${b.id}">${b.nama} (${b.sku || 'N/A'})</option>`;
        });
    } catch (e) { console.error('loadBarangForStok error:', e); }
}

// Load list gudang khusus untuk form stok
async function loadGudangForStok() {
    try {
        const el = document.getElementById('gudangStok');
        if (!el) return;
        const data = apiCache['gudang'] ? apiCache['gudang'] : await (async () => { const r = await fetch(`${API_BASE_URL}/gudang/`, { headers: authHeaders() }); const j = await r.json(); apiCache['gudang'] = j; return j; })();

        el.innerHTML = '<option value="">Pilih Gudang</option>';
        (data.results || data || []).forEach(g => {
            el.innerHTML += `<option value="${g.id}">${g.nama}</option>`;
        });
    } catch (e) { console.error('loadGudangForStok error:', e); }
}

// --- A. ADMIN KATEGORI (FIXED) ---
async function loadKategoriTable() {
    showLoading('loadingTable');
    try {
        const res = await fetch(`${API_BASE_URL}/kategori/`, { headers: authHeaders() });
        const data = await res.json();
        const tbody = document.getElementById('kategoriTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        const items = data.results || data || [];
        const isAdmin = window.isAdmin === true;
        const frag = document.createDocumentFragment();
        items.forEach(k => {
            const tr = document.createElement('tr');
            const tdNama = document.createElement('td'); tdNama.textContent = k.nama;
            const tdDesc = document.createElement('td'); tdDesc.textContent = k.deskripsi || '-';
            const tdDate = document.createElement('td'); tdDate.textContent = new Date(k.dibuat_pada || Date.now()).toLocaleDateString();
            const tdAction = document.createElement('td');
            const editBtn = document.createElement('button'); editBtn.className='btn btn-sm btn-warning'; editBtn.textContent='Edit'; editBtn.onclick = () => setKategoriEdit(k.id);
            tdAction.appendChild(editBtn);
            if (isAdmin) { const delBtn = document.createElement('button'); delBtn.className='btn btn-sm btn-danger ms-1'; delBtn.textContent='Hapus'; delBtn.onclick = () => deleteItem('kategori', k.id, loadKategoriTable); tdAction.appendChild(delBtn); }
            tr.appendChild(tdNama); tr.appendChild(tdDesc); tr.appendChild(tdDate); tr.appendChild(tdAction);
            frag.appendChild(tr);
        });
        tbody.appendChild(frag);
    } catch (e) { showAlert(e.message, false); } finally { hideLoading('loadingTable'); }
}

async function addOrUpdateKategori() {
    const id = document.getElementById('kategoriId').value;
    // Read admin form fields (IDs in kategori.html)
    const nama = (document.getElementById('namaKategori').value || '').trim();
    const deskripsi = (document.getElementById('deskripsiKategori').value || '').trim();

    if (!nama) { showAlert('Nama Kategori harus diisi', false); showResultModal(false, 'Gagal', 'Nama Kategori harus diisi'); return; }

    const payload = { nama, deskripsi };
    await submitData('kategori', id, payload, loadKategoriTable, () => {
        resetKategoriForm();
    });
}

async function setKategoriEdit(id) {
    const res = await fetch(`${API_BASE_URL}/kategori/${id}/`, { headers: authHeaders() });
    const data = await res.json();
    document.getElementById('formTitle').textContent = 'Edit Kategori';
    document.getElementById('kategoriId').value = data.id;
    const namaEl = document.getElementById('namaKategori');
    const descEl = document.getElementById('deskripsiKategori');
    if (namaEl) namaEl.value = data.nama || '';
    if (descEl) descEl.value = data.deskripsi || '';
}

function resetKategoriForm() {
    const form = document.getElementById('kategoriForm'); if (form) form.reset();
    const idEl = document.getElementById('kategoriId'); if (idEl) idEl.value = '';
    const title = document.getElementById('formTitle'); if (title) title.textContent = 'Tambah Kategori Baru';
}

// --- B. ADMIN SUPPLIER (FIXED) ---
async function loadSupplierTable() {
    showLoading('loadingTable');
    try {
        const res = await fetch(`${API_BASE_URL}/supplier/`, { headers: authHeaders() });
        const data = await res.json();
        const tbody = document.getElementById('supplierTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const items = data.results || data || [];
        const isAdmin = window.isAdmin === true;
        const frag = document.createDocumentFragment();
        items.forEach(s => {
            const tr = document.createElement('tr');
            const tdNama = document.createElement('td'); tdNama.textContent = s.nama;
            const tdKontak = document.createElement('td'); tdKontak.textContent = s.kontak || '-';
            const tdTel = document.createElement('td'); tdTel.textContent = s.telepon || '-';
            const tdEmail = document.createElement('td'); tdEmail.textContent = s.email || '-';
            const tdAction = document.createElement('td');

            const editBtn = document.createElement('button'); editBtn.className='btn btn-sm btn-warning'; editBtn.textContent='Edit'; editBtn.onclick = () => setSupplierEdit(s.id);
            tdAction.appendChild(editBtn);
            if (isAdmin) {
                const delBtn = document.createElement('button'); delBtn.className='btn btn-sm btn-danger ms-1'; delBtn.textContent='Hapus'; delBtn.onclick = () => deleteItem('supplier', s.id, loadSupplierTable);
                tdAction.appendChild(delBtn);
            }

            tr.appendChild(tdNama); tr.appendChild(tdKontak); tr.appendChild(tdTel); tr.appendChild(tdEmail); tr.appendChild(tdAction);
            frag.appendChild(tr);
        });
        tbody.appendChild(frag);
        // Update supplier count badge if exists
        const countEl = document.getElementById('supplierCount');
        if (countEl) countEl.textContent = `${data.count || items.length} Data`;
    } catch (e) { showAlert(e.message, false); } finally { hideLoading('loadingTable'); }
}

async function addOrUpdateSupplier() {
    const id = document.getElementById('supplierId').value;
    // Read and normalize inputs
    const nama = (document.getElementById('namaSupplier').value || '').trim();
    const kontak = (document.getElementById('kontakSupplier').value || '').trim();
    const telepon = (document.getElementById('teleponSupplier').value || '').trim();
    const email = (document.getElementById('emailSupplier').value || '').trim();
    const alamat = document.getElementById('alamatSupplier') ? (document.getElementById('alamatSupplier').value || '').trim() : '';

    // Basic validation
    if (!nama) { showAlert('Nama supplier harus diisi', false); showResultModal(false, 'Gagal', 'Nama supplier harus diisi'); return; }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) { showAlert('Format email tidak valid', false); showResultModal(false, 'Gagal', 'Format email tidak valid'); return; }

    const payload = { nama, kontak, telepon, email, alamat };
    await submitData('supplier', id, payload, loadSupplierTable, () => {
        resetSupplierForm();
    });
}

async function setSupplierEdit(id) {
    const res = await fetch(`${API_BASE_URL}/supplier/${id}/`, { headers: authHeaders() });
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
        const res = await fetch(`${API_BASE_URL}/barang/`, { headers: authHeaders() });
        const data = await res.json();
        const tbody = document.getElementById('barangTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        const isAdmin = window.isAdmin === true;
        const items = data.results || data || [];
        const frag = document.createDocumentFragment();
        items.forEach(b => {
            const tr = document.createElement('tr');
            const tdSku = document.createElement('td'); tdSku.textContent = b.sku;
            const tdNama = document.createElement('td'); tdNama.textContent = b.nama;
            const tdKat = document.createElement('td'); tdKat.textContent = b.kategori_nama || '-';
            const tdSatuan = document.createElement('td'); tdSatuan.textContent = b.satuan;
            const tdAction = document.createElement('td');
            const editBtn = document.createElement('button'); editBtn.className='btn btn-sm btn-warning'; editBtn.textContent='Edit'; editBtn.onclick = () => setBarangEdit(b.id);
            tdAction.appendChild(editBtn);
            if (isAdmin) { const delBtn = document.createElement('button'); delBtn.className='btn btn-sm btn-danger ms-1'; delBtn.textContent='Hapus'; delBtn.onclick = () => deleteItem('barang', b.id, loadBarangTable); tdAction.appendChild(delBtn); }
            tr.appendChild(tdSku); tr.appendChild(tdNama); tr.appendChild(tdKat); tr.appendChild(tdSatuan); tr.appendChild(tdAction);
            frag.appendChild(tr);
        });
        tbody.appendChild(frag);
    } catch (e) { console.error(e); } finally { hideLoading('loadingTable'); }
}

async function addOrUpdateBarang() {
    const id = document.getElementById('barangId').value;
    // Read and normalize form values
    const sku = (document.getElementById('sku').value || '').trim();
    const nama = (document.getElementById('nama').value || '').trim();
    const kategoriVal = document.getElementById('kategori').value;
    const supplierVal = document.getElementById('supplier').value;
    const satuan = (document.getElementById('satuan').value || '').trim();
    const gambar_url = (document.getElementById('gambar_url').value || '').trim();

    // Client-side validation for required fields
    if (!sku) { showAlert('SKU harus diisi', false); return; }
    if (!nama) { showAlert('Nama barang harus diisi', false); return; }
    if (!kategoriVal || String(kategoriVal).trim() === '') { showAlert('Pilih kategori', false); return; }
    if (!satuan) { showAlert('Satuan harus diisi', false); return; }

    // Convert FK fields to integers (or null)
    const kategori = kategoriVal ? Number(kategoriVal) : null;
    const supplier = (supplierVal && String(supplierVal).trim() !== '') ? Number(supplierVal) : null;

    const payload = { sku, nama, kategori, supplier, satuan, gambar_url };

    await submitData('barang', id, payload, loadBarangTable, () => {
        document.getElementById('barangForm').reset();
        document.getElementById('barangId').value = '';
        document.getElementById('formTitle').textContent = 'Tambah Barang';
    });
}

async function setBarangEdit(id) {
    const res = await fetch(`${API_BASE_URL}/barang/${id}/`, { headers: authHeaders() });
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
        // Cancel previous fetch if any
        if (stokListAbortController) stokListAbortController.abort();
        stokListAbortController = new AbortController();
        const res = await fetch(url, { headers: authHeaders(), signal: stokListAbortController.signal });
        const data = await res.json();
        const tbody = document.getElementById('stokTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        // Update stok count badge if exists
        const stokCountEl = document.getElementById('stokCount');
        if (stokCountEl) stokCountEl.textContent = `${data.count !== undefined ? data.count : (data.results || data).length} Items`;

        const list = data.results || data || [];
        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Data Kosong</td></tr>';
            return;
        }

        const frag = document.createDocumentFragment();
        list.forEach(stok => {
            const tr = document.createElement('tr');
            if (stok.jumlah <= stok.level_reorder) tr.classList.add('table-warning');

            const tdBarang = document.createElement('td'); tdBarang.innerHTML = `${stok.barang_nama || (stok.barang_detail && stok.barang_detail.nama) || ''} <br><small>${stok.barang_sku || ''}</small>`;
            const tdGudang = document.createElement('td'); tdGudang.textContent = stok.gudang_nama || (stok.gudang_detail && stok.gudang_detail.nama) || '';
            const tdJumlah = document.createElement('td'); tdJumlah.className='text-center'; tdJumlah.innerHTML = `<strong>${stok.jumlah}</strong>`;
            const tdLevel = document.createElement('td'); tdLevel.className='text-center'; tdLevel.textContent = stok.level_reorder;
            const tdUpdated = document.createElement('td'); tdUpdated.textContent = new Date(stok.diperbarui_pada).toLocaleDateString('id-ID');
            const tdAction = document.createElement('td');

            const outBtn = document.createElement('button'); outBtn.className='btn btn-sm btn-danger me-1'; outBtn.textContent='Keluar'; outBtn.onclick = () => openStockOutModal(stok.id, stok.jumlah);
            const editBtn = document.createElement('button'); editBtn.className='btn btn-sm btn-warning'; editBtn.textContent='Edit'; editBtn.onclick = () => setStokEdit(stok.id);
            tdAction.appendChild(outBtn); tdAction.appendChild(editBtn);

            tr.appendChild(tdBarang); tr.appendChild(tdGudang); tr.appendChild(tdJumlah); tr.appendChild(tdLevel); tr.appendChild(tdUpdated); tr.appendChild(tdAction);
            frag.appendChild(tr);
        });
        tbody.appendChild(frag);

        if(data.results) renderPagination(data.count, page, search, kat, 'admin');

    } catch (e) {
        if (e.name === 'AbortError') return; // expected when cancelled
        showAlert("Gagal load stok", false);
    }
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
    const res = await fetch(`${API_BASE_URL}/stok/${id}/`, { headers: authHeaders() });
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
        const res = await fetch(`${API_BASE_URL}/stok/${stokId}/`, { headers: authHeaders() });
        if (!res.ok) throw new Error('Gagal mengambil data stok');
        const stok = await res.json();

        if (jumlahKeluar > stok.jumlah) { showAlert('Jumlah keluar melebihi stok tersedia', false); return; }

        const newJumlah = stok.jumlah - jumlahKeluar;

        // Perform transactional stok OUT in one request to avoid race conditions
        const txPayload = { stok: stokId, tipe: 'OUT', jumlah: jumlahKeluar, catatan: `${keperluan}${catatan ? ' - ' + catatan : ''}` };
        const txRes = await fetch(`${API_BASE_URL}/stok/transaction/`, {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(txPayload)
        });
        if (!txRes.ok) {
            const err = await txRes.json().catch(() => ({}));
            throw new Error(err.detail || JSON.stringify(err));
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
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            if (res.status === 401) {
                // Authentication required
                const msg = 'Autentikasi diperlukan. Silakan login untuk melakukan aksi ini.';
                showAlert(msg, false);
                showResultModal(false, 'Autentikasi Diperlukan', msg + '<br><br><a href="login.html" class="btn btn-primary">Login</a>');
                return;
            }
            // Try parse validation errors and present a friendly message
            let errBody = null;
            try { errBody = await res.json(); } catch (e) { /* ignore */ }
            if (errBody) {
                // If it's a dict of field errors, flatten messages
                if (typeof errBody === 'object') {
                    const parts = [];
                    for (const k of Object.keys(errBody)) {
                        const v = errBody[k];
                        if (Array.isArray(v)) parts.push(`${k}: ${v.join(', ')}`);
                        else if (typeof v === 'object') parts.push(`${k}: ${JSON.stringify(v)}`);
                        else parts.push(`${k}: ${v}`);
                    }
                    const html = parts.join('<br>');
                    showAlert('Gagal: ' + parts.join(' | '), false);
                    showResultModal(false, 'Gagal menyimpan data', html);
                } else {
                    showAlert('Gagal: ' + String(errBody), false);
                    showResultModal(false, 'Gagal menyimpan data', String(errBody));
                }
            } else {
                const msg = 'Gagal menyimpan data (status ' + res.status + ')';
                showAlert(msg, false);
                showResultModal(false, 'Gagal menyimpan data', msg);
            }
            return;
        }

        const successMsg = "Data berhasil disimpan!";
        showAlert(successMsg, true);
        showResultModal(true, 'Berhasil', successMsg);
        if (typeof resetCb === 'function') resetCb();
        if (typeof reloadCb === 'function') reloadCb();
    } catch (e) { showAlert("Gagal: " + e.message, false); }
}

// ---------------- Result Modal ----------------
function ensureResultModal() {
    if (document.getElementById('resultModal')) return;
    const div = document.createElement('div');
    div.innerHTML = `
    <div class="modal fade" id="resultModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="resultModalTitle"></h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body" id="resultModalBody"></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Tutup</button>
          </div>
        </div>
      </div>
    </div>`;
    document.body.appendChild(div);
}

function showResultModal(success, title, htmlContent) {
    try {
        ensureResultModal();
        const titleEl = document.getElementById('resultModalTitle');
        const bodyEl = document.getElementById('resultModalBody');
        titleEl.textContent = title || (success ? 'Berhasil' : 'Gagal');
        bodyEl.innerHTML = htmlContent || '';
        const modalEl = document.getElementById('resultModal');
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    } catch (e) { console.error('showResultModal error', e); }
}

async function deleteItem(endpoint, id, reloadCb) {
    if (!window.isAdmin) { showAlert('Hanya admin yang dapat menghapus data.', false); return; }
    if (!confirm("Yakin hapus?")) return;
    try {
        const res = await fetch(`${API_BASE_URL}/${endpoint}/${id}/`, {
            method: 'DELETE',
            headers: authHeaders()
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
        const btnSearch = document.getElementById('btnSearch');
        const searchInput = document.getElementById('searchInput');
        const debouncedSearch = debounce(() => loadStokPublic(1, searchInput?.value || '', document.getElementById('kategoriFilter')?.value || ''), 300);
        btnSearch?.addEventListener('click', () => debouncedSearch());
        // also trigger on typing (debounced)
        searchInput?.addEventListener('input', debouncedSearch);
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

        // Support both public filter (`#kategoriFilter`) and admin select (`#kategori`)
        const kategoriFilter = document.getElementById('kategoriFilter');
        const kategoriAdmin = document.getElementById('kategori');

        if (kategoriFilter) {
            kategoriFilter.innerHTML = '<option value="">Semua Kategori</option>';
            (data.results || data || []).forEach(kategori => {
                const option = document.createElement('option');
                option.value = kategori.id;
                option.textContent = kategori.nama;
                kategoriFilter.appendChild(option);
            });
        }

        if (kategoriAdmin) {
            kategoriAdmin.innerHTML = '<option value="">Pilih Kategori...</option>';
            (data.results || data || []).forEach(kategori => {
                const option = document.createElement('option');
                option.value = kategori.id;
                option.textContent = kategori.nama;
                kategoriAdmin.appendChild(option);
            });
        }
    } catch (error) {
        console.error("Kategori load error:", error.message);
    }
}

// Admin wrapper to load supplier dropdown and supplier table if present
async function loadSupplier() {
    try {
        if (typeof loadDropdownData === 'function') await loadDropdownData('supplier', 'supplier', '-- Pilih Supplier --');
        if (typeof loadSupplierTable === 'function') await loadSupplierTable();
    } catch (e) { console.error('loadSupplier wrapper error', e); }
}

// Admin wrapper to load barang table (and optionally dropdowns for stok form)
async function loadBarang() {
    try {
        if (typeof loadBarangTable === 'function') await loadBarangTable();
        // also ensure barang dropdowns for stok form are ready
        if (typeof loadDropdownData === 'function') {
            // populate barangStok if exists
            const el = document.getElementById('barangStok');
            if (el) await loadDropdownData('barang', 'barangStok', 'Pilih Barang');
        }
    } catch (e) { console.error('loadBarang wrapper error', e); }
}

// Generic reset for barang form used on dashboard
function resetForm() {
    const form = document.getElementById('barangForm');
    if (form) form.reset();
    const idEl = document.getElementById('barangId'); if (idEl) idEl.value = '';
    const title = document.getElementById('formTitle'); if (title) title.textContent = 'Tambah Barang';
}

// Load STOK BARANG (Halaman Toko) - PERBAIKAN UTAMA ADA DI SINI
async function loadStok(page = 1, search = '', kategoriId = '') {
    currentPage = page;
    showLoading('loading');
    const errEl = document.getElementById('error');
    if (errEl) errEl.classList.add('d-none');
    
    let url = `${API_BASE_URL}/stok/?`;
    
    // 1. Determine search & kategoriId from inputs if not provided
    const searchInputEl = document.getElementById('searchInput');
    const kategoriSelectEl = document.getElementById('kategoriFilter');
    const activeCategoryLabelEl = document.getElementById('activeCategoryLabel');
    const searchVal = (search || (searchInputEl && searchInputEl.value) || '').trim();
    const kategoriVal = (kategoriId || (kategoriSelectEl && kategoriSelectEl.value) || '').trim();

    // show active category label in header (only show name, not id)
    if (activeCategoryLabelEl) {
        const selectedText = kategoriSelectEl ? (kategoriSelectEl.options[kategoriSelectEl.selectedIndex]?.text || '') : '';
        activeCategoryLabelEl.textContent = kategoriVal ? `— ${selectedText}` : '';
    }

    // 2. Kirim parameter SEARCH
    if (searchVal) url += `search=${encodeURIComponent(searchVal)}&`;

    // 3. Kirim parameter FILTER KATEGORI (menggunakan format yang sesuai dengan DRF filterset_fields)
    if (kategoriVal) url += `barang__kategori=${kategoriVal}&`;
    
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

        const items = data.results || data || [];
        if (!items || items.length === 0) {
            container.innerHTML = '<div class="col-12 alert alert-warning text-center">Produk tidak ditemukan.</div>';
            if (data.results) renderPagination(data.count, currentPage, '', '', 'public');
            return;
        }
        // Build DOM nodes per item so we can lazily fetch barang detail if image missing
        const frag = document.createDocumentFragment();
        const activeCategorySelected = kategoriVal && kategoriVal !== '';
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
            imgEl.loading = 'lazy';
            imgEl.onerror = function() { this.onerror = null; this.src = 'https://via.placeholder.com/300x200?text=Image+Error'; };

            imgWrap.appendChild(imgEl);
            card.appendChild(imgWrap);

            const body = document.createElement('div');
            body.className = 'card-body d-flex flex-column';

            const titleEl = document.createElement('h5'); titleEl.className = 'card-title text-primary'; titleEl.textContent = barangNama;
            const metaEl = document.createElement('p'); metaEl.className = 'card-text mb-1';
            // If a category is actively selected, show only the category name; otherwise show SKU and category
            if (activeCategorySelected) {
                metaEl.innerHTML = `<small class="text-muted">${kategoriNama}</small>`;
            } else {
                metaEl.innerHTML = `<small class="text-muted">SKU: ${sku} | Kategori: ${kategoriNama}</small>`;
            }

            const stokEl = document.createElement('p'); stokEl.className = 'card-text fs-4 fw-bold text-success mt-auto'; stokEl.textContent = `Stok: ${stok.jumlah} ${satuan}`;
            const lokasiEl = document.createElement('p'); lokasiEl.className = 'card-text'; lokasiEl.textContent = stok.gudang_nama || stok.gudang?.nama || '-';
            if (stok.jumlah <= stok.level_reorder) {
                const badge = document.createElement('span'); badge.className = 'badge bg-warning text-dark'; badge.textContent = 'PERLU REORDER!';
                lokasiEl.appendChild(document.createTextNode(' ')); lokasiEl.appendChild(badge);
            }

            body.appendChild(titleEl);
            body.appendChild(metaEl);
            body.appendChild(stokEl);
            body.appendChild(lokasiEl);

            card.appendChild(body);
            col.appendChild(card);
            frag.appendChild(col);

            // If image missing, lazy fetch barang detail but don't block render
            const isPlaceholder = imgCandidate === undefined || imgCandidate === null || String(imgCandidate).trim() === '';
            if (isPlaceholder && stok.barang) {
                fetch(`${API_BASE_URL}/barang/${stok.barang}/`).then(r => r.ok ? r.json() : null).then(bdata => {
                    if (bdata && (bdata.gambar_url || bdata.gambar)) imgEl.src = getFullImageUrl(bdata.gambar_url || bdata.gambar);
                }).catch(() => {});
            }
        });

        container.appendChild(frag);

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
            const res = await fetch(url, { headers: authHeaders() });
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
            const res = await fetch(url, { headers: authHeaders() });
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
        const res = await fetch(`${API_BASE_URL}/me/`, { headers: authHeaders() });
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