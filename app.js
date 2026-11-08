(() => {
  const STORAGE_KEY = 'sim-brilink-kios-v1';
  const INITIAL = {
    cash: 10000000,
    agent: 20000000,
    products: [
      { id: 'beras', name: 'Beras', stock: 60, unit: 'liter', price: 13000 },
      { id: 'minyak', name: 'Minyak goreng', stock: 12, unit: 'botol 1 liter', price: 18000 }
    ],
    transactions: [],
    activities: []
  };

  let state = loadState();
  let currentPage = 'dashboard';

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : clone(INITIAL);
    } catch (_) { return clone(INITIAL); }
  }
  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function resetState() { state = clone(INITIAL); saveState(); }
  function rupiah(value) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
  }
  function el(id) { return document.getElementById(id); }
  function showMessage(id, message) {
    const node = el(id);
    if (!node) return;
    node.textContent = message;
    node.hidden = false;
  }
  function hideMessage(id) {
    const node = el(id);
    if (node) { node.textContent = ''; node.hidden = true; }
  }
  function today() { return new Date().toISOString().slice(0, 10); }
  function addActivity(label, type, amount, fee = 0) {
    const item = { date: today(), label, type, amount, fee, status: 'Berhasil' };
    state.transactions.unshift(item);
    state.activities.unshift(item);
    saveState();
    renderAll();
  }

  function renderBalances() {
    el('cash-balance').textContent = rupiah(state.cash);
    el('agent-balance').textContent = rupiah(state.agent);
    el('dashboard-cash').textContent = rupiah(state.cash);
    el('dashboard-agent').textContent = rupiah(state.agent);
    el('dashboard-products').textContent = state.products.length;
    el('dashboard-count').textContent = state.transactions.length;
  }
  function renderInventory() {
    const productSelect = el('product-select');
    const stockSelect = el('stock-product');
    productSelect.innerHTML = '';
    stockSelect.innerHTML = '';
    state.products.forEach(p => {
      const option1 = new Option(p.name, p.id);
      const option2 = new Option(p.name, p.id);
      productSelect.add(option1);
      stockSelect.add(option2);
    });
    const rice = state.products.find(p => p.id === 'beras');
    el('stock-beras').textContent = rice ? `${rice.stock} ${rice.unit}` : '0';
    el('inventory-table').innerHTML = state.products.map(p => `
      <tr><td>${escapeHtml(p.name)}</td><td>${p.stock}</td><td>${escapeHtml(p.unit)}</td>
      <td>${rupiah(p.price)}</td><td><span class="status">${p.stock > 0 ? 'Tersedia' : 'Habis'}</span></td></tr>`).join('');
  }
  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function renderTransactions() {
    const rows = state.transactions.filter(t => t.type !== 'Penjualan' && t.type !== 'Penambahan stok')
      .map(t => `<tr><td>${t.date}</td><td>${escapeHtml(t.label)}</td><td>${rupiah(t.amount)}</td><td>${rupiah(t.fee)}</td><td>${t.status}</td></tr>`).join('');
    el('transaction-history').innerHTML = rows || '<tr><td colspan="5" class="empty">Belum ada transaksi.</td></tr>';
    const recent = state.activities.slice(0, 5).map(t =>
      `<tr><td>${t.date}</td><td>${escapeHtml(t.label)}</td><td>${escapeHtml(t.type)}</td><td>${rupiah(t.amount)}</td><td>${t.status}</td></tr>`
    ).join('');
    el('dashboard-recent').innerHTML = recent || '<tr><td colspan="5" class="empty">Belum ada aktivitas.</td></tr>';
    const last = state.transactions[0];
    el('last-transaction').textContent = last ? `${last.label} ${rupiah(last.amount)} Fee ${rupiah(last.fee)}` : '';
    el('last-transaction-fee').textContent = last ? rupiah(last.fee) : '';
  }
  function renderAll() { renderBalances(); renderInventory(); renderTransactions(); }

  function navigate(page) {
    currentPage = page;
    document.querySelectorAll('.page').forEach(p => p.hidden = p.id !== `page-${page}`);
    document.querySelectorAll('.nav-link').forEach(b => b.classList.toggle('active', b.dataset.page === page));
    const names = { dashboard: 'Dashboard', transactions: 'Transaksi Agen', inventory: 'Inventaris', reports: 'Laporan' };
    el('page-heading').textContent = names[page] || 'Dashboard';
    if (page === 'reports') renderReport();
  }
  function authenticated() {
    el('login-screen').hidden = true;
    el('app').hidden = false;
    renderAll();
    navigate('dashboard');
  }

  el('login-form').addEventListener('submit', event => {
    event.preventDefault();
    hideMessage('login-error');
    const username = el('login-username').value.trim();
    const password = el('login-password').value;
    if (username === 'admin' && password === 'admin123') {
      sessionStorage.setItem('sim-auth', 'true');
      authenticated();
    } else {
      showMessage('login-error', 'Username atau password tidak sesuai.');
    }
  });

  el('logout-button').addEventListener('click', () => {
    sessionStorage.removeItem('sim-auth');
    el('app').hidden = true;
    el('login-screen').hidden = false;
    el('login-form').reset();
  });

  document.querySelectorAll('.nav-link').forEach(button => {
    button.addEventListener('click', () => navigate(button.dataset.page));
  });
  document.querySelectorAll('[data-goto]').forEach(button => {
    button.addEventListener('click', () => navigate(button.dataset.goto));
  });

  el('transaction-type').addEventListener('change', () => {
    const type = el('transaction-type').value;
    el('service-field').hidden = type !== 'pembayaran';
    el('fee-field').hidden = type === 'tarik_tunai' || type === 'setor_tunai';
  });

  el('transaction-form').addEventListener('submit', event => {
    event.preventDefault();
    hideMessage('transaction-success');
    hideMessage('transaction-error');
    const type = el('transaction-type').value;
    const amount = Number(el('transaction-amount').value);
    const fee = Number(el('transaction-fee').value || 0);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
      showMessage('transaction-error', 'Nominal transaksi harus berupa bilangan bulat lebih dari nol.');
      return;
    }
    if (!Number.isFinite(fee) || fee < 0 || !Number.isInteger(fee)) {
      showMessage('transaction-error', 'Fee harus berupa bilangan bulat nol atau lebih.');
      return;
    }
    if (type === 'tarik_tunai') {
      if (state.cash < amount) { showMessage('transaction-error', 'Kas tidak mencukupi untuk tarik tunai.'); return; }
      state.cash -= amount;
      state.agent += amount;
      addActivity('Tarik tunai', 'Transaksi Agen', amount, 0);
    } else if (type === 'setor_tunai') {
      if (state.agent < amount) { showMessage('transaction-error', 'Saldo agen tidak mencukupi untuk setor tunai.'); return; }
      state.cash += amount;
      state.agent -= amount;
      addActivity('Setor tunai', 'Transaksi Agen', amount, 0);
    } else if (type === 'transfer') {
      addActivity('Transfer antarbank', 'Transaksi Agen', amount, fee);
    } else {
      const service = el('transaction-service').value;
      const labels = { tagihan: 'Pembayaran tagihan', pulsa: 'Pembelian pulsa', token_listrik: 'Pembelian token listrik' };
      addActivity(labels[service], 'Transaksi Agen', amount, fee);
    }
    showMessage('transaction-success', 'Transaksi berhasil disimpan.');
    el('transaction-form').reset();
    el('transaction-type').value = 'tarik_tunai';
    el('transaction-type').dispatchEvent(new Event('change'));
  });

  el('product-select').addEventListener('change', updateSalePreview);
  el('sale-quantity').addEventListener('input', updateSalePreview);
  function updateSalePreview() {
    const product = state.products.find(p => p.id === el('product-select').value);
    const qty = Number(el('sale-quantity').value || 0);
    el('sale-total').textContent = rupiah(product && qty > 0 ? product.price * qty : 0);
  }
  el('sale-form').addEventListener('submit', event => {
    event.preventDefault();
    hideMessage('sale-success'); hideMessage('sale-error');
    const product = state.products.find(p => p.id === el('product-select').value);
    const qty = Number(el('sale-quantity').value);
    if (!product || !Number.isInteger(qty) || qty <= 0) { showMessage('sale-error', 'Jumlah penjualan harus lebih dari nol.'); return; }
    if (qty > product.stock) { showMessage('sale-error', 'Stok tidak mencukupi untuk penjualan.'); return; }
    const total = product.price * qty;
    product.stock -= qty;
    state.cash += total;
    addActivity(`Penjualan ${product.name}`, 'Penjualan', total, 0);
    showMessage('sale-success', 'Penjualan berhasil disimpan.');
    el('sale-form').reset();
    updateSalePreview();
  });

  el('stock-form').addEventListener('submit', event => {
    event.preventDefault();
    hideMessage('stock-success');
    const product = state.products.find(p => p.id === el('stock-product').value);
    const qty = Number(el('stock-add-quantity').value);
    if (!product || !Number.isInteger(qty) || qty <= 0) {
      el('stock-add-quantity').setCustomValidity('Jumlah harus berupa bilangan bulat lebih dari nol.');
      el('stock-add-quantity').reportValidity();
      el('stock-add-quantity').setCustomValidity('');
      return;
    }
    product.stock += qty;
    addActivity(`Penambahan stok ${product.name}`, 'Penambahan stok', qty, 0);
    showMessage('stock-success', 'Stok berhasil ditambahkan.');
    el('stock-form').reset();
  });

  el('report-form').addEventListener('submit', event => {
    event.preventDefault();
    renderReport();
  });
  function renderReport() {
    const start = el('report-start').value;
    const end = el('report-end').value;
    const filtered = state.transactions.filter(t => t.date >= start && t.date <= end);
    const total = filtered.reduce((sum, t) => sum + t.amount, 0);
    const fee = filtered.reduce((sum, t) => sum + t.fee, 0);
    el('report-count').textContent = filtered.length;
    el('report-total').textContent = rupiah(total);
    el('report-fee').textContent = rupiah(fee);
    el('report-table').innerHTML = filtered.map(t =>
      `<tr><td>${t.date}</td><td>${escapeHtml(t.label)}</td><td>${rupiah(t.amount)}</td><td>${rupiah(t.fee)}</td></tr>`
    ).join('') || '<tr><td colspan="4" class="empty">Tidak ada transaksi pada periode ini.</td></tr>';
  }

  // Hooks untuk pengujian: reset data hanya dipakai di lingkungan prototype.
  window.SIMPrototype = { resetState, getState: () => clone(state) };
  renderAll();
  if (sessionStorage.getItem('sim-auth') === 'true') authenticated();
})();
