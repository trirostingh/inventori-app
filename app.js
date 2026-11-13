import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { 
  getDatabase, 
  ref, 
  push, 
  onValue, 
  remove, 
  update,
  get,
  child
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

// -----------------------------------------------------------
// 1. Konfigurasi & Inisialisasi Firebase
// -----------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyA8ET8nTMVarJz3yx8WO42UISeXXXYsU6I",
  authDomain: "inventori-barang-xyz.firebaseapp.com",
  databaseURL: "https://inventori-barang-xyz-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "inventori-barang-xyz",
  storageBucket: "inventori-barang-xyz.firebasestorage.app",
  messagingSenderId: "36592895613",
  appId: "1:36592895613:web:c7c97275cd8ca16e6b5314"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Paksa logout setiap kali halaman dimuat ulang
signOut(auth).catch(() => {});

const itemsRef = ref(db, 'inventory');
const transRef = ref(db, 'transactions');
const logsRef = ref(db, 'inventory_logs');
const usersRef = ref(db, 'users');

// -----------------------------------------------------------
// Helper Tanggal & Key
// -----------------------------------------------------------
function getCurrentDate() {
  const today = new Date();
  return today.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getDateTime() {
  const now = new Date();
  return now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) + 
         ', ' + now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDateDisplay(rawDate) {
  if (!rawDate || rawDate === '-') return '-';
  if (!isNaN(rawDate)) {
    const d = new Date(Number(rawDate));
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  const d = new Date(rawDate);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  return rawDate;
}

function emailToKey(email) {
  return email.toLowerCase().replace(/[@.]/g, '_at_');
}

// -----------------------------------------------------------
// 2. Elemen DOM
// -----------------------------------------------------------
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const authError = document.getElementById('auth-error');
const userEmailDisplay = document.getElementById('user-email-display');
const btnLogout = document.getElementById('btn-logout');

// Inventori
const inventoryForm = document.getElementById('inventory-form');
const itemGroupSelect = document.getElementById('item-group');
const itemIdInput = document.getElementById('item-id');
const itemCodeInput = document.getElementById('item-code');
const nameInput = document.getElementById('item-name');
const categoryInput = document.getElementById('item-category');
const priceInput = document.getElementById('item-price');
const stockInput = document.getElementById('item-stock');
const submitBtn = document.getElementById('btn-submit');
const cancelBtn = document.getElementById('btn-cancel');
const inventoryList = document.getElementById('inventory-list');
const actionHeader = document.getElementById('action-header');

// Permintaan Cabang
const branchForm = document.getElementById('branch-form');
const branchSelectGroup = document.getElementById('branch-select-group');
const branchDisplayGroup = document.getElementById('branch-display-group');
const branchDisplayName = document.getElementById('branch-display-name');
const branchSelect = document.getElementById('branch-select');
const itemSelect = document.getElementById('item-select');
const requestQty = document.getElementById('request-qty');
const displayPrice = document.getElementById('display-price');
const displayTotal = document.getElementById('display-total');
const transactionList = document.getElementById('transaction-list');

// Filter Transaksi
const filterBranch = document.getElementById('filter-branch');
const filterSearch = document.getElementById('filter-search');
const filterStartDate = document.getElementById('filter-start-date');
const filterEndDate = document.getElementById('filter-end-date');
const btnResetFilter = document.getElementById('btn-reset-filter');

// Log & User
const logList = document.getElementById('log-list');
const userList = document.getElementById('user-list');
const btnOpenUserModal = document.getElementById('btn-open-user-modal');
const btnCloseUserModal = document.getElementById('btn-close-user-modal');
const userModal = document.getElementById('user-modal');
const createUserForm = document.getElementById('create-user-form');

// Dashboard
const rptTotalItems = document.getElementById('rpt-total-items');
const rptTotalSold = document.getElementById('rpt-total-sold');
const rptTotalRevenue = document.getElementById('rpt-total-revenue');

const MIN_STOCK = 5;
let inventoryData = {};
let allTransactionsData = [];
let usersData = {};
let USER_BRANCH_MAP = {
  'cabang1@inventori.com': 'Cabang 1',
  'cabang2@inventori.com': 'Cabang 2',
  'cabang3@inventori.com': 'Cabang 3',
  'cabang4@inventori.com': 'Cabang 4'
};

function checkIsAdmin(user) {
  if (!user || !user.email) return false;
  return user.email.startsWith('admin') || user.email === 'admin1@inventori.com' || user.email === 'admin2@inventori.com';
}

// -----------------------------------------------------------
// 3. Navigasi Tab
// -----------------------------------------------------------
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// -----------------------------------------------------------
// 4. Proses Login
// -----------------------------------------------------------
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;
  
  authError.style.color = '#026685';
  authError.innerText = 'Memproses login...';
  const uKey = emailToKey(email);

  try {
    await signInWithEmailAndPassword(auth, email, password);

    try {
      const snapshot = await get(child(ref(db), `users/${uKey}`));
      if (snapshot.exists()) {
        const userRecord = snapshot.val();
        
        if (userRecord.isLocked) {
          await signOut(auth);
          authError.style.color = '#e53e3e';
          authError.innerText = "Akun terkunci, silahkan hubungi Admin";
          return;
        }
        
        if (userRecord.status === 'nonaktif') {
          await signOut(auth);
          authError.style.color = '#e53e3e';
          authError.innerText = "Akun Anda telah dinonaktifkan/dihapus. Silahkan hubungi Admin.";
          return;
        }

        await update(ref(db, `users/${uKey}`), { failedAttempts: 0 });
      } else {
        const isAdmin = checkIsAdmin({ email: email });
        const defaultBranch = USER_BRANCH_MAP[email] || (isAdmin ? 'Pusat' : 'Cabang');
        await update(ref(db, `users/${uKey}`), {
          email: email,
          branch: defaultBranch,
          role: isAdmin ? 'Admin Pusat' : defaultBranch,
          status: 'aktif',
          failedAttempts: 0,
          isLocked: false
        });
      }
    } catch (dbErr) {
      console.warn("Pengecekan database user dilewati:", dbErr.message);
    }

    loginForm.reset();
    authError.innerText = '';

  } catch (error) {
    console.error("Login Error:", error.code, error.message);
    authError.style.color = '#e53e3e';

    if (error.code === 'auth/too-many-requests') {
      authError.innerText = "Terlalu banyak percobaan gagal. Tunggu 1-2 menit atau reset password di Firebase.";
      return;
    }

    try {
      const snapshot = await get(child(ref(db), `users/${uKey}`));
      if (snapshot.exists()) {
        const userRecord = snapshot.val();
        let currentAttempts = (userRecord.failedAttempts || 0) + 1;
        
        if (currentAttempts >= 3) {
          await update(ref(db, `users/${uKey}`), { failedAttempts: currentAttempts, isLocked: true });
          authError.innerText = "Akun terkunci, silahkan hubungi Admin";
        } else {
          await update(ref(db, `users/${uKey}`), { failedAttempts: currentAttempts });
          authError.innerText = "User atau Password Salah";
        }
      } else {
        authError.innerText = "User atau Password Salah";
      }
    } catch {
      authError.innerText = "User atau Password Salah";
    }
  }
});

btnLogout.addEventListener('click', () => {
  signOut(auth).catch((error) => console.error(error));
});

// -----------------------------------------------------------
// 5. Listener Status Auth & Inisialisasi Data Setelah Login
// -----------------------------------------------------------
onAuthStateChanged(auth, (user) => {
  if (user) {
    authContainer.style.setProperty('display', 'none', 'important');
    appContainer.style.display = 'block';
    userEmailDisplay.innerText = user.email;

    branchForm.reset();
    itemSelect.value = "";
    requestQty.value = 1;
    displayPrice.value = "Rp 0";
    displayTotal.value = "Rp 0";

    const isAdmin = checkIsAdmin(user);
    const userBranch = USER_BRANCH_MAP[user.email];

    const lblRptSold = document.getElementById('lbl-rpt-sold');
    const lblRptRevenue = document.getElementById('lbl-rpt-revenue');
    const transactionsTitle = document.getElementById('transactions-title');
    const filterBranchGroup = document.getElementById('filter-branch-group');

    if (isAdmin) {
      if (lblRptSold) lblRptSold.innerText = 'Total Barang Terjual/Terkirim (Semua Cabang)';
      if (lblRptRevenue) lblRptRevenue.innerText = 'Total Nilai Transaksi Pusat';
      if (transactionsTitle) transactionsTitle.innerText = 'Laporan Transaksi Ke Semua Cabang';
      if (filterBranchGroup) filterBranchGroup.style.display = 'block';

      if (branchSelectGroup) branchSelectGroup.style.display = 'block';
      if (branchDisplayGroup) branchDisplayGroup.style.display = 'none';
      branchSelect.value = "";

      inventoryForm.style.display = 'grid'; 
      actionHeader.style.display = 'table-cell';
      document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'inline-block');
      filterBranch.disabled = false;
      filterBranch.value = "ALL";
      
      loadLogsData();
      loadUsersData();
    } else {
      const branchLabel = userBranch || 'Cabang';
      if (lblRptSold) lblRptSold.innerText = `Total Barang Diminta (${branchLabel})`;
      if (lblRptRevenue) lblRptRevenue.innerText = `Total Nilai Transaksi (${branchLabel})`;
      if (transactionsTitle) transactionsTitle.innerText = `Riwayat Permintaan Barang - ${branchLabel}`;
      
      if (filterBranchGroup) filterBranchGroup.style.display = 'none';
      if (branchSelectGroup) branchSelectGroup.style.display = 'none';
      if (branchDisplayGroup) branchDisplayGroup.style.display = 'block';
      
      if (branchDisplayName) branchDisplayName.value = branchLabel;
      branchSelect.value = branchLabel;

      inventoryForm.style.display = 'none'; 
      actionHeader.style.display = 'none';
      document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');

      if (userBranch) {
        filterBranch.value = userBranch;
      }

      const activeTab = document.querySelector('.tab-btn.active');
      if (activeTab && (activeTab.dataset.tab === 'tab-logs' || activeTab.dataset.tab === 'tab-users')) {
        document.querySelector('[data-tab="tab-inventory"]').click();
      }
    }

    loadDatabaseData(); 

  } else {
    branchForm.reset();
    requestQty.value = 1;
    displayPrice.value = "Rp 0";
    displayTotal.value = "Rp 0";

    authContainer.style.setProperty('display', 'flex', 'important');
    appContainer.style.display = 'none';
    userEmailDisplay.innerText = '';
  }
});

// -----------------------------------------------------------
// 6. Memuat Data Inventori & Transaksi
// -----------------------------------------------------------
function loadDatabaseData() {
  onValue(itemsRef, (snapshot) => {
    inventoryList.innerHTML = ''; 
    itemSelect.innerHTML = '<option value="">-- Pilih Barang --</option>'; 
    inventoryData = {};
    let totalItems = 0;

    if (snapshot.exists()) {
      const data = snapshot.val();
      inventoryData = data; 

      for (const key in data) {
        const item = data[key];
        totalItems++;

        const tr = document.createElement('tr');
        const currentUser = auth.currentUser;
        const isAdmin = checkIsAdmin(currentUser);
        
        let actionButtons = '';
        if (isAdmin) {
          actionButtons = `
            <td>
              <button class="btn-action btn-edit" data-id="${key}">Edit</button>
              <button class="btn-action btn-delete" data-id="${key}">Hapus</button>
            </td>`;
        }

        const stockDisplay = item.stock <= MIN_STOCK 
          ? `<span class="badge-low">${item.stock}</span>` 
          : item.stock;

        const rawDate = item.lastEdited || item.entrydate || item.entryDate || item.dateAdded || item.timestamp || item.created_at;
        const displayDate = formatDateDisplay(rawDate);

        tr.innerHTML = `
          <td>${item.code || '-'}</td>
          <td>${item.name || '-'}</td>
          <td>${item.category || '-'}</td>
          <td>Rp ${parseInt(item.price || 0).toLocaleString('id-ID')}</td>
          <td>${stockDisplay}</td>
          <td>${displayDate}</td>
          ${actionButtons}
        `;
        inventoryList.appendChild(tr);

        if (item.stock > 0) {
          const option = document.createElement('option');
          option.value = key; 
          option.textContent = `${item.code} - ${item.name} (Stok: ${item.stock})`;
          itemSelect.appendChild(option);
        }
      }
    } else {
      inventoryList.innerHTML = '<tr><td colspan="7" style="text-align:center;">Tidak ada data barang.</td></tr>';
    }
    
    rptTotalItems.innerText = totalItems;
  });

  onValue(transRef, (snapshot) => {
    allTransactionsData = [];
    if (snapshot.exists()) {
      const data = snapshot.val();
      for (const key in data) {
        allTransactionsData.push({ id: key, ...data[key] });
      }
      allTransactionsData.reverse();
    }
    renderFilteredTransactions();
  });
}

// -----------------------------------------------------------
// Filter & Render Riwayat Transaksi (Urut Murni Cabang)
// -----------------------------------------------------------
function renderFilteredTransactions() {
  transactionList.innerHTML = '';
  
  const currentUser = auth.currentUser;
  const userBranch = currentUser ? USER_BRANCH_MAP[currentUser.email] : null;
  const isAdmin = checkIsAdmin(currentUser);

  const selectedBranch = isAdmin ? filterBranch.value : userBranch;
  const searchText = filterSearch.value.trim().toLowerCase();
  const startDate = filterStartDate.value;
  const endDate = filterEndDate.value;

  let totalSold = 0;
  let totalRevenue = 0;

  const filteredList = allTransactionsData.filter(trans => {
    const transBranch = trans.branch || '';
    const itemName = (trans.itemName || '').toLowerCase();
    const itemCode = (trans.itemCode || trans.itemId || '').toLowerCase();
    const rawTransDate = trans.date || trans.transDate || trans.tgl || trans.timestamp || trans.created_at;

    if (!isAdmin && userBranch && transBranch !== userBranch) return false;
    if (isAdmin && selectedBranch !== 'ALL' && transBranch !== selectedBranch) return false;
    if (searchText && !itemName.includes(searchText) && !itemCode.includes(searchText)) return false;

    if (startDate || endDate) {
      let transDateObj = new Date(rawTransDate);
      if (isNaN(transDateObj.getTime()) && rawTransDate) {
        const parts = rawTransDate.split('/');
        if (parts.length === 3) transDateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      }

      if (!isNaN(transDateObj.getTime())) {
        if (startDate && transDateObj < new Date(startDate)) return false;
        if (endDate) {
          const endDateTime = new Date(endDate);
          endDateTime.setHours(23, 59, 59);
          if (transDateObj > endDateTime) return false;
        }
      }
    }

    return true;
  });

  filteredList.sort((a, b) => {
    const branchA = (a.branch || '').toLowerCase();
    const branchB = (b.branch || '').toLowerCase();
    return branchA.localeCompare(branchB, 'id', { numeric: true });
  });

  filteredList.forEach(trans => {
    const transBranch = trans.branch || '-';
    const rawTransDate = trans.date || trans.transDate || trans.tgl || trans.timestamp || trans.created_at;
    const formattedDate = formatDateDisplay(rawTransDate);

    totalSold += parseInt(trans.qty || 0);
    totalRevenue += parseInt(trans.totalPrice || 0);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formattedDate}</td>
      <td>${transBranch}</td>
      <td>${trans.itemName || '-'}</td>
      <td>${trans.qty || 0}</td>
      <td>Rp ${parseInt(trans.price || 0).toLocaleString('id-ID')}</td>
      <td>Rp ${parseInt(trans.totalPrice || 0).toLocaleString('id-ID')}</td>
    `;
    transactionList.appendChild(tr);
  });

  if (filteredList.length === 0) {
    transactionList.innerHTML = '<tr><td colspan="6" style="text-align:center;">Tidak ada transaksi yang sesuai filter.</td></tr>';
  }

  rptTotalSold.innerText = `${totalSold} Unit`;
  rptTotalRevenue.innerText = `Rp ${totalRevenue.toLocaleString('id-ID')}`;
}

filterBranch.addEventListener('change', renderFilteredTransactions);
filterSearch.addEventListener('input', renderFilteredTransactions);
filterStartDate.addEventListener('change', renderFilteredTransactions);
filterEndDate.addEventListener('change', renderFilteredTransactions);

btnResetFilter.addEventListener('click', () => {
  const currentUser = auth.currentUser;
  const isAdmin = checkIsAdmin(currentUser);
  if (isAdmin) filterBranch.value = 'ALL';
  filterSearch.value = '';
  filterStartDate.value = '';
  filterEndDate.value = '';
  renderFilteredTransactions();
});

// -----------------------------------------------------------
// 7. Form Inventori Pusat & Log Audit
// -----------------------------------------------------------
itemGroupSelect.addEventListener('change', (e) => {
  const val = e.target.value;
  if (val) {
    const parts = val.split('|');
    itemCodeInput.value = parts[0];
    nameInput.value = parts[1];
    categoryInput.value = parts[2];
    priceInput.value = parts[3];
  } else {
    itemCodeInput.value = '';
    nameInput.value = '';
    categoryInput.value = '';
    priceInput.value = '';
  }
});

inventoryForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const id = itemIdInput.value;
  const currentDate = getCurrentDate();
  const currentUser = auth.currentUser ? auth.currentUser.email : 'Admin';

  const newPrice = parseInt(priceInput.value);
  const newStock = parseInt(stockInput.value);
  const newCode = itemCodeInput.value;
  const newName = nameInput.value;

  const itemData = {
    code: newCode,
    name: newName,
    category: categoryInput.value,
    price: newPrice,
    stock: newStock,
    lastEdited: currentDate
  };

  if (id) {
    const oldData = inventoryData[id];
    const changes = [];

    if (oldData.name !== newName) changes.push(`Nama: "${oldData.name}" -> "${newName}"`);
    if (oldData.price !== newPrice) changes.push(`Harga: Rp ${oldData.price.toLocaleString('id-ID')} -> Rp ${newPrice.toLocaleString('id-ID')}`);
    if (oldData.stock !== newStock) changes.push(`Stok: ${oldData.stock} -> ${newStock}`);

    update(ref(db, 'inventory/' + id), itemData)
      .then(() => {
        if (changes.length > 0) {
          push(logsRef, {
            timestamp: getDateTime(),
            editedBy: currentUser,
            action: 'EDIT_BARANG',
            itemCode: newCode,
            itemName: newName,
            details: changes.join(' | ')
          });
        }
        alert('Data barang berhasil diperbarui!');
        resetInventoryForm();
      })
      .catch(error => console.error(error));

  } else {
    push(itemsRef, itemData)
      .then(() => {
        push(logsRef, {
          timestamp: getDateTime(),
          editedBy: currentUser,
          action: 'TAMBAH_BARANG',
          itemCode: newCode,
          itemName: newName,
          details: `Stok awal: ${newStock} unit, Harga: Rp ${newPrice.toLocaleString('id-ID')}`
        });
        alert('Barang baru berhasil ditambahkan!');
        resetInventoryForm();
      })
      .catch(error => console.error(error));
  }
});

function resetInventoryForm() {
  inventoryForm.reset();
  itemIdInput.value = '';
  cancelBtn.style.display = 'none';
  submitBtn.innerText = 'Simpan Barang';
}

inventoryList.addEventListener('click', (e) => {
  if (e.target.classList.contains('btn-edit')) {
    const id = e.target.dataset.id;
    const item = inventoryData[id];
    
    itemIdInput.value = id;
    itemCodeInput.value = item.code;
    nameInput.value = item.name;
    categoryInput.value = item.category;
    priceInput.value = item.price;
    stockInput.value = item.stock;
    
    submitBtn.innerText = 'Update Barang';
    cancelBtn.style.display = 'inline-block';
    document.querySelector('.tabs').scrollIntoView({ behavior: 'smooth' });

  } else if (e.target.classList.contains('btn-delete')) {
    const id = e.target.dataset.id;
    const item = inventoryData[id];

    if (confirm(`Yakin ingin menghapus barang ${item.name}?`)) {
      const currentUser = auth.currentUser ? auth.currentUser.email : 'Admin';
      remove(ref(db, 'inventory/' + id)).then(() => {
        push(logsRef, {
          timestamp: getDateTime(),
          editedBy: currentUser,
          action: 'HAPUS_BARANG',
          itemCode: item.code,
          itemName: item.name,
          details: `Barang dihapus dari inventori pusat (Stok terakhir: ${item.stock}).`
        });
      });
    }
  }
});

cancelBtn.addEventListener('click', resetInventoryForm);

// -----------------------------------------------------------
// 8. Transaksi Permintaan Cabang & Hitung Harga
// -----------------------------------------------------------
function calculateTotal() {
  const itemId = itemSelect.value;
  const qty = parseInt(requestQty.value) || 0;

  if (!itemId || !inventoryData[itemId]) {
    displayPrice.value = 'Rp 0';
    displayTotal.value = 'Rp 0';
    return;
  }
  
  const item = inventoryData[itemId];
  const price = parseInt(item.price || 0);
  const total = price * qty;
  
  displayPrice.value = `Rp ${price.toLocaleString('id-ID')}`;
  displayTotal.value = `Rp ${total.toLocaleString('id-ID')}`;
}

itemSelect.addEventListener('change', calculateTotal);
requestQty.addEventListener('input', calculateTotal);

branchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const currentUser = auth.currentUser;
  const userBranch = currentUser ? (USER_BRANCH_MAP[currentUser.email] || (branchDisplayName ? branchDisplayName.value : '')) : null;
  const isAdmin = checkIsAdmin(currentUser);

  const selectedBranch = isAdmin ? branchSelect.value : userBranch;
  const itemId = itemSelect.value;
  const qty = parseInt(requestQty.value);

  if (!selectedBranch) {
    alert('Cabang tidak terdeteksi!');
    return;
  }

  if (!itemId || !inventoryData[itemId]) {
    alert('Silakan pilih barang terlebih dahulu!');
    return;
  }

  const item = inventoryData[itemId];
  const price = parseInt(item.price || 0);
  const itemName = item.name;
  const currentStock = item.stock;

  if (qty > currentStock) {
    alert(`Stok tidak cukup! Sisa stok saat ini: ${currentStock}`);
    return;
  }

  const transactionData = {
    date: getCurrentDate(),
    branch: selectedBranch,
    itemId: itemId,
    itemName: itemName,
    itemCode: item.code || '',
    qty: qty,
    price: price,
    totalPrice: price * qty
  };

  const newStock = currentStock - qty;

  update(ref(db, 'inventory/' + itemId), { stock: newStock, lastEdited: getCurrentDate() })
    .then(() => push(transRef, transactionData))
    .then(() => {
      alert(`Permintaan barang untuk ${selectedBranch} berhasil diproses!`);
      branchForm.reset();
      requestQty.value = 1;
      
      if (!isAdmin && userBranch) {
        if (branchDisplayName) branchDisplayName.value = userBranch;
        branchSelect.value = userBranch;
      }
      
      calculateTotal();
      renderFilteredTransactions();
    })
    .catch((error) => {
      console.error('Error proses transaksi:', error);
      alert('Gagal memproses transaksi: ' + error.message);
    });
});

// -----------------------------------------------------------
// 9. Log Audit & Manajemen User (Khusus Admin)
// -----------------------------------------------------------
function loadLogsData() {
  onValue(logsRef, (snapshot) => {
    if (!logList) return;
    logList.innerHTML = '';
    
    if (snapshot.exists()) {
      const logs = snapshot.val();
      const logArray = [];

      for (const key in logs) {
        logArray.push({ id: key, ...logs[key] });
      }

      logArray.reverse().forEach(log => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${log.timestamp || '-'}</td>
          <td>${log.editedBy || '-'}</td>
          <td><strong>${log.action || '-'}</strong></td>
          <td>${log.itemCode || ''} ${log.itemName ? '- ' + log.itemName : '-'}</td>
          <td>${log.details || '-'}</td>
        `;
        logList.appendChild(tr);
      });
    } else {
      logList.innerHTML = '<tr><td colspan="5" style="text-align:center;">Belum ada catatan log audit.</td></tr>';
    }
  });
}

function loadUsersData() {
  onValue(usersRef, (snapshot) => {
    const existingUsers = snapshot.exists() ? snapshot.val() : {};
    
    const defaultAccounts = [
      { email: 'admin1@inventori.com', branch: 'Pusat', role: 'Admin Pusat' },
      { email: 'admin2@inventori.com', branch: 'Pusat', role: 'Admin Pusat' },
      { email: 'cabang1@inventori.com', branch: 'Cabang 1', role: 'Cabang 1' },
      { email: 'cabang2@inventori.com', branch: 'Cabang 2', role: 'Cabang 2' },
      { email: 'cabang3@inventori.com', branch: 'Cabang 3', role: 'Cabang 3' },
      { email: 'cabang4@inventori.com', branch: 'Cabang 4', role: 'Cabang 4' }
    ];

    let needsUpdate = false;
    const updates = {};

    defaultAccounts.forEach(acc => {
      const uKey = emailToKey(acc.email);
      if (!existingUsers[uKey]) {
        needsUpdate = true;
        updates[uKey] = {
          email: acc.email,
          branch: acc.branch,
          role: acc.role,
          status: 'aktif',
          failedAttempts: 0,
          isLocked: false
        };
      }
    });

    if (needsUpdate) {
      update(usersRef, updates);
      return;
    }

    usersData = existingUsers;
    const branchSet = new Set();

    for (const key in usersData) {
      const u = usersData[key];
      if (u.email && u.branch) {
        USER_BRANCH_MAP[u.email] = u.branch;
        if (!checkIsAdmin({ email: u.email })) {
          branchSet.add(u.branch);
        }
      }
    }

    const sortedBranches = Array.from(branchSet).sort();
    
    if (branchSelect) {
      branchSelect.innerHTML = '<option value="">-- Pilih Cabang --</option>';
      sortedBranches.forEach(b => {
        branchSelect.innerHTML += `<option value="${b}">${b}</option>`;
      });
    }

    if (filterBranch && checkIsAdmin(auth.currentUser)) {
      const currentFilter = filterBranch.value || 'ALL';
      filterBranch.innerHTML = '<option value="ALL">-- Semua Cabang --</option>';
      sortedBranches.forEach(b => {
        filterBranch.innerHTML += `<option value="${b}">${b}</option>`;
      });
      filterBranch.value = currentFilter;
    }

    renderUsersTable();
  });
}

if (btnOpenUserModal) btnOpenUserModal.addEventListener('click', () => userModal.style.display = 'flex');
if (btnCloseUserModal) btnCloseUserModal.addEventListener('click', () => userModal.style.display = 'none');

if (createUserForm) {
  createUserForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('new-user-email').value.trim().toLowerCase();
    const branch = document.getElementById('new-user-branch').value.trim();
    const uKey = emailToKey(email);

    update(ref(db, `users/${uKey}`), {
      email: email,
      branch: branch,
      role: branch,
      status: 'aktif',
      failedAttempts: 0,
      isLocked: false
    }).then(() => {
      alert(`Akun ${email} berhasil ditambahkan!`);
      createUserForm.reset();
      userModal.style.display = 'none';
    });
  });
}

function renderUsersTable() {
  if (!userList) return;
  userList.innerHTML = '';

  for (const key in usersData) {
    const u = usersData[key];
    const tr = document.createElement('tr');

    const statusBadge = u.isLocked 
      ? `<span style="background:#e53e3e; color:#fff; padding:3px 8px; border-radius:4px; font-size:0.8rem;">Terkunci</span>`
      : u.status === 'aktif'
        ? `<span style="background:#2b8a3e; color:#fff; padding:3px 8px; border-radius:4px; font-size:0.8rem;">Aktif</span>`
        : `<span style="background:#718096; color:#fff; padding:3px 8px; border-radius:4px; font-size:0.8rem;">Nonaktif</span>`;

    let adminButtons = '';
    if (!checkIsAdmin({ email: u.email })) {
      const toggleActionText = u.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan';
      const toggleClass = u.status === 'aktif' ? 'btn-delete' : 'btn-edit';

      let unlockBtn = '';
      if (u.isLocked) {
        unlockBtn = `<button class="btn-action btn-edit btn-unlock-user" data-key="${key}">Buka Kunci</button>`;
      }

      adminButtons = `
        <td>
          ${unlockBtn}
          <button class="btn-action ${toggleClass} btn-toggle-user" data-key="${key}" data-status="${u.status}">${toggleActionText}</button>
          <button class="btn-action btn-delete btn-remove-user" data-key="${key}" data-email="${u.email}">Hapus</button>
        </td>
      `;
    } else {
      adminButtons = `<td>-</td>`;
    }

    tr.innerHTML = `
      <td>${u.email}</td>
      <td>${u.role || 'Cabang'}</td>
      <td>${statusBadge}</td>
      ${adminButtons}
    `;
    userList.appendChild(tr);
  }
}

if (userList) {
  userList.addEventListener('click', (e) => {
    const key = e.target.dataset.key;
    if (!key) return;

    if (e.target.classList.contains('btn-toggle-user')) {
      const currentStatus = e.target.dataset.status;
      const newStatus = currentStatus === 'aktif' ? 'nonaktif' : 'aktif';

      update(ref(db, `users/${key}`), { status: newStatus }).then(() => {
        alert(`Status akun berhasil diubah menjadi ${newStatus}!`);
      });

    } else if (e.target.classList.contains('btn-unlock-user')) {
      update(ref(db, `users/${key}`), { isLocked: false, failedAttempts: 0 }).then(() => {
        alert(`Kunci akun berhasil dibuka! User bisa mencoba login kembali.`);
      });

    } else if (e.target.classList.contains('btn-remove-user')) {
      const email = e.target.dataset.email;
      if (confirm(`Yakin ingin menghapus akun ${email}? Riwayat transaksi akun ini akan tetap tersimpan.`)) {
        update(ref(db, `users/${key}`), { status: 'nonaktif' }).then(() => {
          alert(`Akun ${email} telah dinonaktifkan/dihapus dari akses login.`);
        });
      }
    }
  });
}

// -----------------------------------------------------------
// 10. Generator Cetak Laporan PDF Ukuran A4 (Kop PT. ABC)
// -----------------------------------------------------------
function getCompanyLetterheadHTML(reportTitle, subtitleInfo) {
  const printDate = new Date().toLocaleDateString('id-ID', { 
    day: '2-digit', month: 'long', year: 'numeric' 
  });

  return `
    <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 3px double #026685; padding-bottom: 12px; margin-bottom: 18px;">
      <div style="display: flex; align-items: center; gap: 14px;">
        <svg width="58" height="58" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" rx="12" fill="#026685"/>
          <path d="M18 46L28 18H36L46 46H39L32 25L25 46H18Z" fill="#6CEBF9"/>
          <rect x="24" y="36" width="16" height="4" rx="2" fill="#FBDF13"/>
          <circle cx="48" cy="18" r="5" fill="#FCB100"/>
        </svg>
        <div>
          <h1 style="margin: 0; font-size: 20px; color: #026685; font-family: Arial, sans-serif;">PT. ABC</h1>
          <p style="margin: 2px 0; font-size: 12px; font-weight: bold; color: #148584; font-family: Arial, sans-serif;">DISTRIBUTOR ALAT TULIS DAN PERLENGKAPAN KANTOR</p>
          <p style="margin: 0; font-size: 11px; color: #333; font-family: Arial, sans-serif;">Jl. Cengkeh V/32, Ciputat</p>
        </div>
      </div>
      <div style="text-align: right; font-size: 11px; color: #555; font-family: Arial, sans-serif;">
        <div>Dicetak: ${printDate}</div>
        <div>Oleh: ${auth.currentUser ? auth.currentUser.email : '-'}</div>
      </div>
    </div>
    <div style="text-align: center; margin-bottom: 16px; font-family: Arial, sans-serif;">
      <h2 style="margin: 0; font-size: 15px; text-transform: uppercase; color: #111;">${reportTitle}</h2>
      <p style="margin: 4px 0 0 0; font-size: 11px; color: #555;">${subtitleInfo}</p>
    </div>
  `;
}

function openA4PrintWindow(htmlContent, docTitle) {
  const printWin = window.open('', '_blank', 'width=900,height=700');
  printWin.document.write(`
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>${docTitle}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 15mm;
        }
        body {
          font-family: Arial, Helvetica, sans-serif;
          color: #1e293b;
          margin: 0;
          padding: 0;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
          margin-top: 10px;
        }
        th {
          background-color: #026685 !important;
          color: #ffffff !important;
          padding: 8px 6px;
          border: 1px solid #026685;
          text-align: left;
        }
        td {
          padding: 7px 6px;
          border: 1px solid #cbd5e1;
        }
        tr:nth-child(even) td {
          background-color: #f8fafc;
        }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .total-row td {
          background-color: #e2e8f0 !important;
          font-weight: bold;
          font-size: 12px;
        }
        .signature-area {
          margin-top: 35px;
          display: flex;
          justify-content: flex-end;
          font-size: 11px;
        }
        .signature-box {
          text-align: center;
          width: 200px;
        }
      </style>
    </head>
    <body>
      ${htmlContent}
      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `);
  printWin.document.close();
}

// 1. Cetak PDF Laporan Stok Barang (Khusus Admin)
const btnPrintStock = document.getElementById('btn-print-stock');
if (btnPrintStock) {
  btnPrintStock.addEventListener('click', () => {
    let rowsHTML = '';
    let no = 1;
    let totalAssetValue = 0;
    let totalStockUnits = 0;

    for (const key in inventoryData) {
      const item = inventoryData[key];
      const price = parseInt(item.price || 0);
      const stock = parseInt(item.stock || 0);
      const subtotal = price * stock;

      totalStockUnits += stock;
      totalAssetValue += subtotal;

      const rawDate = item.lastEdited || item.entrydate || item.entryDate || item.dateAdded || '-';
      rowsHTML += `
        <tr>
          <td class="text-center">${no++}</td>
          <td>${item.code || '-'}</td>
          <td>${item.name || '-'}</td>
          <td>${item.category || '-'}</td>
          <td class="text-right">Rp ${price.toLocaleString('id-ID')}</td>
          <td class="text-center">${stock}</td>
          <td class="text-right">Rp ${subtotal.toLocaleString('id-ID')}</td>
          <td class="text-center">${formatDateDisplay(rawDate)}</td>
        </tr>
      `;
    }

    if (no === 1) {
      rowsHTML = '<tr><td colspan="8" class="text-center">Belum ada data stok barang.</td></tr>';
    }

    const headerHTML = getCompanyLetterheadHTML(
      'LAPORAN STOK BARANG INVENTORI PUSAT',
      'Status Persediaan Gudang Pusat PT. ABC'
    );

    const fullHTML = `
      ${headerHTML}
      <table>
        <thead>
          <tr>
            <th class="text-center" style="width: 30px;">No</th>
            <th>Kode</th>
            <th>Nama Barang</th>
            <th>Kategori</th>
            <th class="text-right">Harga Satuan</th>
            <th class="text-center">Sisa Stok</th>
            <th class="text-right">Nilai Persediaan</th>
            <th class="text-center">Tgl Update</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHTML}
          <tr class="total-row">
            <td colspan="5" class="text-right">TOTAL KESELURUHAN</td>
            <td class="text-center">${totalStockUnits} Unit</td>
            <td class="text-right">Rp ${totalAssetValue.toLocaleString('id-ID')}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
      <div class="signature-area">
        <div class="signature-box">
          <p>Ciputat, ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          <p style="margin-bottom: 55px;">Admin Inventori Pusat,</p>
          <p><strong>( _______________________ )</strong></p>
        </div>
      </div>
    `;

    openA4PrintWindow(fullHTML, 'Laporan_Stok_Barang_PT_ABC');
  });
}

// 2. Cetak PDF Laporan Transaksi (Untuk Admin Maupun User Cabang - Urut Murni Cabang)
const btnPrintTransactions = document.getElementById('btn-print-transactions');
if (btnPrintTransactions) {
  btnPrintTransactions.addEventListener('click', () => {
    const currentUser = auth.currentUser;
    const userBranch = currentUser ? USER_BRANCH_MAP[currentUser.email] : null;
    const isAdmin = checkIsAdmin(currentUser);

    const selectedBranch = isAdmin ? filterBranch.value : userBranch;
    const searchText = filterSearch.value.trim().toLowerCase();
    const startDate = filterStartDate.value;
    const endDate = filterEndDate.value;

    let rowsHTML = '';
    let no = 1;
    let totalQty = 0;
    let grandTotal = 0;

    const sortedForPrint = [...allTransactionsData].sort((a, b) => {
      const branchA = (a.branch || '').toLowerCase();
      const branchB = (b.branch || '').toLowerCase();
      return branchA.localeCompare(branchB, 'id', { numeric: true });
    });

    sortedForPrint.forEach(trans => {
      const transBranch = trans.branch || '';
      const itemName = (trans.itemName || '').toLowerCase();
      const itemCode = (trans.itemCode || trans.itemId || '').toLowerCase();
      const rawTransDate = trans.date || trans.transDate || trans.tgl || trans.timestamp || trans.created_at;
      const formattedDate = formatDateDisplay(rawTransDate);

      if (!isAdmin && userBranch && transBranch !== userBranch) return;
      if (isAdmin && selectedBranch !== 'ALL' && transBranch !== selectedBranch) return;
      if (searchText && !itemName.includes(searchText) && !itemCode.includes(searchText)) return;

      if (startDate || endDate) {
        let transDateObj = new Date(rawTransDate);
        if (isNaN(transDateObj.getTime()) && rawTransDate) {
          const parts = rawTransDate.split('/');
          if (parts.length === 3) transDateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }
        if (!isNaN(transDateObj.getTime())) {
          if (startDate && transDateObj < new Date(startDate)) return;
          if (endDate) {
            const endDateTime = new Date(endDate);
            endDateTime.setHours(23, 59, 59);
            if (transDateObj > endDateTime) return;
          }
        }
      }

      const qty = parseInt(trans.qty || 0);
      const price = parseInt(trans.price || 0);
      const subtotal = parseInt(trans.totalPrice || 0);

      totalQty += qty;
      grandTotal += subtotal;

      rowsHTML += `
        <tr>
          <td class="text-center">${no++}</td>
          <td class="text-center">${formattedDate}</td>
          <td>${transBranch}</td>
          <td>${trans.itemName || '-'}</td>
          <td class="text-center">${qty}</td>
          <td class="text-right">Rp ${price.toLocaleString('id-ID')}</td>
          <td class="text-right">Rp ${subtotal.toLocaleString('id-ID')}</td>
        </tr>
      `;
    });

    if (no === 1) {
      rowsHTML = '<tr><td colspan="7" class="text-center">Tidak ada data transaksi pada periode/filter ini.</td></tr>';
    }

    const reportTitle = isAdmin 
      ? (selectedBranch === 'ALL' ? 'LAPORAN DISTRIBUSI & PENJUALAN KE SELURUH CABANG' : `LAPORAN DISTRIBUSI BARANG - ${selectedBranch.toUpperCase()}`)
      : `LAPORAN TRANSAKSI PERMINTAAN BARANG - ${(userBranch || 'CABANG').toUpperCase()}`;

    const periodeLabel = (startDate || endDate) 
      ? `Periode: ${startDate || 'Awal'} s/d ${endDate || 'Sekarang'}` 
      : 'Periode: Semua Transaksi Tercatat';

    const headerHTML = getCompanyLetterheadHTML(reportTitle, periodeLabel);

    const fullHTML = `
      ${headerHTML}
      <table>
        <thead>
          <tr>
            <th class="text-center" style="width: 30px;">No</th>
            <th class="text-center">Tanggal</th>
            <th>Cabang</th>
            <th>Nama Barang</th>
            <th class="text-center">Qty</th>
            <th class="text-right">Harga Satuan</th>
            <th class="text-right">Total Harga</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHTML}
          <tr class="total-row">
            <td colspan="4" class="text-right">GRAND TOTAL TRANSAKSI</td>
            <td class="text-center">${totalQty} Unit</td>
            <td></td>
            <td class="text-right">Rp ${grandTotal.toLocaleString('id-ID')}</td>
          </tr>
        </tbody>
      </table>
      <div class="signature-area">
        <div class="signature-box">
          <p>Ciputat, ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          <p style="margin-bottom: 55px;">${isAdmin ? 'Admin Pusat,' : `Kepala ${userBranch || 'Cabang'},`}</p>
          <p><strong>( _______________________ )</strong></p>
        </div>
      </div>
    `;

    const fileName = isAdmin ? 'Laporan_Transaksi_Pusat_PT_xyz' : `Laporan_Transaksi_${(userBranch || 'Cabang').replace(/\s+/g, '_')}`;
    openA4PrintWindow(fullHTML, fileName);
  });
}