'use strict';

/* ============================================================
   ODD PIG — INVOICE STUDIO JAVASCRIPT ENGINE
   ============================================================ */

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>', '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Multi-Language Translation Map ---------- */
const I18N = {
  en: {
    invoice: 'INVOICE',
    billTo: 'Bill To',
    invoiceDate: 'Invoice Date',
    dueDate: 'Due Date',
    workPeriod: 'Work Period',
    currency: 'Currency',
    description: 'Description',
    qty: 'Qty',
    rate: 'Rate',
    unitPrice: 'Unit Price',
    amount: 'Amount',
    subtotal: 'Subtotal',
    tax: 'Tax',
    referralSubtotal: 'Referral subtotal',
    workFee: 'Work fee',
    totalDue: 'TOTAL DUE',
    paymentDetails: 'Payment Details',
    bank: 'Bank',
    accountNumber: 'Account Number',
    accountName: 'Account Name',
    swift: 'Swift Code',
    notes: 'Notes',
    thankYou: 'Thank you.',
    toBeConfirmed: 'To be confirmed',
    from: 'From',
  },
  vi: {
    invoice: 'HÓA ĐƠN',
    billTo: 'Khách hàng',
    invoiceDate: 'Ngày lập',
    dueDate: 'Hạn thanh toán',
    workPeriod: 'Thời gian làm việc',
    currency: 'Tiền tệ',
    description: 'Mô tả công việc / Dịch vụ',
    qty: 'Số lượng',
    rate: 'Đơn giá',
    unitPrice: 'Đơn giá',
    amount: 'Thành tiền',
    subtotal: 'Tạm tính',
    tax: 'Thuế VAT',
    referralSubtotal: 'Tạm tính giới thiệu',
    workFee: 'Phí công việc',
    totalDue: 'TỔNG CỘNG',
    paymentDetails: 'Thông tin thanh toán',
    bank: 'Ngân hàng',
    accountNumber: 'Số tài khoản',
    accountName: 'Tên tài khoản',
    swift: 'Mã Swift',
    notes: 'Ghi chú',
    thankYou: 'Cảm ơn quý khách.',
    toBeConfirmed: 'Chờ xác nhận',
    from: 'Người gửi',
  },
  both: {
    invoice: 'INVOICE / HÓA ĐƠN',
    billTo: 'Bill To / Khách hàng',
    invoiceDate: 'Invoice Date / Ngày lập',
    dueDate: 'Due Date / Hạn thanh toán',
    workPeriod: 'Work Period / Thời gian',
    currency: 'Currency / Tiền tệ',
    description: 'Description / Mô tả',
    qty: 'Qty / Số lượng',
    rate: 'Rate / Đơn giá',
    unitPrice: 'Unit Price / Đơn giá',
    amount: 'Amount / Thành tiền',
    subtotal: 'Subtotal / Tạm tính',
    tax: 'Tax / Thuế',
    referralSubtotal: 'Referral subtotal / Tạm tính GT',
    workFee: 'Work fee / Phí công việc',
    totalDue: 'TOTAL DUE / TỔNG CỘNG',
    paymentDetails: 'Payment Details / Thanh toán',
    bank: 'Bank / Ngân hàng',
    accountNumber: 'Account No. / Số TK',
    accountName: 'Account Name / Tên TK',
    swift: 'Swift Code',
    notes: 'Notes / Ghi chú',
    thankYou: 'Thank you. / Cảm ơn.',
    toBeConfirmed: 'To be confirmed / Chờ xác nhận',
    from: 'From / Từ',
  }
};

/* ---------- Global State ---------- */
const S = {
  tab: 'freelancer', // 'freelancer' | 'service'
  lang: 'en',        // 'en' | 'vi' | 'both'
  currency: 'VND',   // 'VND' | 'USD'
  
  // Freelancer form
  f: {
    invNum: 'INV-001',
    invDate: todayYmd(),
    workPeriod: '20 August 2026 - 24 August 2026',
    name: 'Nguyen Ngoc Thu Hang',
    subtitle: 'Invoice for services and referrals',
    email: '',
    address: '',
    billTo: 'The Speechless Communication Pty Ltd',
    billAddr: '',
    bank: 'VPBANK (Vietnam Prosperity Joint Stock Commercial Bank)',
    accNum: '222007232',
    accName: 'Nguyen Ngoc Thu Hang',
    notes: 'Thank you.\n3 days',
    items: [
      { id: 1, desc: 'Work: 20 Aug - 24 Aug 2026', qty: 'To be confirmed', rate: 'To be confirmed', isText: true, amount: 0 },
      { id: 2, desc: 'Editor referral fee', qty: '2 referrals', rate: '2,250,000', isText: false, amount: 4500000 },
    ]
  },

  // Service / Business form
  s: {
    invNum: 'INV-001',
    invDate: todayYmd(),
    dueDate: todayYmd(),
    name: 'Nguyen Ngoc Thu Hang',
    subtitle: 'Invoice for media & production services',
    email: 'contact@oddpig.io.vn',
    address: 'Ho Chi Minh City, Vietnam',
    billTo: 'The Speechless Communication Pty Ltd',
    billAddr: '',
    taxPct: 0,
    bank: 'VPBANK (Vietnam Prosperity Joint Stock Commercial Bank)',
    accNum: '222007232',
    accName: 'Nguyen Ngoc Thu Hang',
    notes: 'Payment is due within 14 days.\nThank you for working with us!',
    items: [
      { id: 1, desc: 'Video Editing & Color Grading (3 reels)', qty: '3', rate: '2,500,000', isText: false, amount: 7500000 },
      { id: 2, desc: 'Sound Design & Mastering', qty: '1', rate: '1,500,000', isText: false, amount: 1500000 },
    ]
  }
};

let nextItemId = 100;

/* ---------- Helper Functions ---------- */
function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateDisplay(ymd) {
  if (!ymd) return '';
  const d = new Date(ymd);
  if (isNaN(d.getTime())) return ymd;
  const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  if (S.lang === 'en' || S.lang === 'both') {
    return `${d.getDate()} ${monthsEn[d.getMonth()]} ${d.getFullYear()}`;
  }
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function t(key) {
  return I18N[S.lang]?.[key] || I18N.en[key] || key;
}

// Parses numeric values or shorthand like 2tr, 2.5m, 500k, 2,250,000
function parseMoney(val) {
  if (typeof val === 'number') return val;
  let str = String(val ?? '').trim().toLowerCase().replace(/[, ]/g, '');
  if (!str) return 0;
  
  if (str.includes('confirm') || str.includes('pending') || str === '-' || str === 'chờ') {
    return NaN;
  }

  const m = str.match(/^([\d.]+)(tr|m|k)?$/);
  if (!m) {
    const raw = parseFloat(str.replace(/[^\d.]/g, ''));
    return isNaN(raw) ? 0 : raw;
  }
  let num = parseFloat(m[1]);
  if (isNaN(num)) return 0;
  const unit = m[2];
  if (unit === 'tr' || unit === 'm') num *= 1e6;
  else if (unit === 'k') num *= 1e3;
  return Math.round(num);
}

function parseQty(val) {
  if (typeof val === 'number') return val;
  let str = String(val ?? '').trim();
  if (str.toLowerCase().includes('confirm')) return NaN;
  const num = parseFloat(str.replace(/[^\d.]/g, ''));
  return isNaN(num) ? 0 : num;
}

function formatCurrency(n) {
  if (typeof n === 'string' && isNaN(Number(n))) return n;
  const num = Number(n) || 0;
  if (S.currency === 'VND') {
    return num.toLocaleString('vi-VN') + ' VND';
  }
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ---------- State Binding & Rendering ---------- */
function initFormFields() {
  const f = S.f;
  const s = S.s;

  // Freelancer fields
  $('#f_invnum').value = f.invNum;
  $('#f_invdate').value = f.invDate;
  $('#f_workperiod').value = f.workPeriod;
  $('#f_name').value = f.name;
  $('#f_subtitle').value = f.subtitle;
  $('#f_billto').value = f.billTo;
  $('#f_billaddr').value = f.billAddr;
  $('#f_bank').value = f.bank;
  $('#f_accnum').value = f.accNum;
  $('#f_accname').value = f.accName;
  $('#f_notes').value = f.notes;

  // Service fields
  $('#s_invnum').value = s.invNum;
  $('#s_invdate').value = s.invDate;
  $('#s_duedate').value = s.dueDate;
  $('#s_name').value = s.name;
  $('#s_subtitle').value = s.subtitle;
  $('#s_billto').value = s.billTo;
  $('#s_billaddr').value = s.billAddr;
  $('#s_taxpct').value = s.taxPct;
  $('#s_bank').value = s.bank;
  $('#s_accnum').value = s.accNum;
  $('#s_accname').value = s.accName;
  $('#s_notes').value = s.notes;

  renderItemInputs('freelancer');
  renderItemInputs('service');
}

function renderItemInputs(tab) {
  const data = tab === 'freelancer' ? S.f : S.s;
  const wrap = $(`#${tab === 'freelancer' ? 'f' : 's'}_items_wrap`);
  if (!wrap) return;

  wrap.innerHTML = '';
  data.items.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
      <input type="text" placeholder="Mô tả công việc" value="${esc(item.desc)}" data-act="desc" data-tab="${tab}" data-id="${item.id}">
      <input type="text" placeholder="SL / Ngày" value="${esc(item.qty)}" data-act="qty" data-tab="${tab}" data-id="${item.id}" style="text-align:right">
      <input type="text" class="money-in" placeholder="Đơn giá" value="${esc(item.rate)}" data-act="rate" data-tab="${tab}" data-id="${item.id}">
      <button class="item-del-btn" data-act="del-item" data-tab="${tab}" data-id="${item.id}" title="Xóa dòng">✕</button>
    `;
    wrap.appendChild(row);
  });
}

function addItem(tab) {
  const data = tab === 'freelancer' ? S.f : S.s;
  data.items.push({
    id: ++nextItemId,
    desc: '',
    qty: '1',
    rate: '0',
    isText: false,
    amount: 0
  });
  renderItemInputs(tab);
  updateDocPreview();
}

function deleteItem(tab, id) {
  const data = tab === 'freelancer' ? S.f : S.s;
  const idx = data.items.findIndex(it => it.id === id);
  if (idx > -1) {
    data.items.splice(idx, 1);
    renderItemInputs(tab);
    updateDocPreview();
  }
}

/* ---------- Calculations & Live Preview Update ---------- */
function updateDocPreview() {
  const isFreelancer = S.tab === 'freelancer';
  const data = isFreelancer ? S.f : S.s;

  // Header
  $('#doc_sender_name').textContent = data.name || 'Your Name';
  $('#doc_sender_sub').textContent = data.subtitle || '';
  $('#doc_title').textContent = t('invoice');
  $('#doc_inv_id').textContent = data.invNum ? `#${data.invNum}` : '';

  // Meta Left
  $('#doc_billto_label').textContent = t('billTo');
  $('#doc_billto_name').textContent = data.billTo || '-';
  const addrEl = $('#doc_billto_addr');
  if (data.billAddr) {
    addrEl.textContent = data.billAddr;
    addrEl.hidden = false;
  } else {
    addrEl.hidden = true;
  }

  // Meta Right
  $('#doc_date_label').textContent = t('invoiceDate');
  $('#doc_date_val').textContent = formatDateDisplay(data.invDate) || '-';

  const periodRow = $('#doc_period_row');
  const dueRow = $('#doc_due_row');

  if (isFreelancer) {
    periodRow.hidden = false;
    dueRow.hidden = true;
    $('#doc_period_label').textContent = t('workPeriod');
    $('#doc_period_val').textContent = data.workPeriod || '-';
  } else {
    periodRow.hidden = true;
    dueRow.hidden = false;
    $('#doc_due_label').textContent = t('dueDate');
    $('#doc_due_val').textContent = formatDateDisplay(data.dueDate) || '-';
  }

  $('#doc_curr_label').textContent = t('currency');
  $('#doc_curr_val').textContent = S.currency;

  // Table Headers
  $('#doc_th_desc').textContent = t('description');
  $('#doc_th_qty').textContent = t('qty');
  $('#doc_th_rate').textContent = isFreelancer ? t('rate') : t('unitPrice');
  $('#doc_th_amt').textContent = t('amount');

  // Table Rows & Totals Calculation
  const tbody = $('#doc_tbody');
  tbody.innerHTML = '';

  let subtotal = 0;
  let hasPending = false;

  data.items.forEach(it => {
    const qNum = parseQty(it.qty);
    const rNum = parseMoney(it.rate);

    let rateDisplay = it.rate;
    let amtDisplay = '';

    if (isNaN(qNum) || isNaN(rNum)) {
      hasPending = true;
      amtDisplay = t('toBeConfirmed');
      if (isNaN(rNum)) rateDisplay = it.rate || t('toBeConfirmed');
    } else {
      it.amount = qNum * rNum;
      subtotal += it.amount;
      rateDisplay = formatCurrency(rNum);
      amtDisplay = formatCurrency(it.amount);
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="desc-cell"><strong>${esc(it.desc) || '-'}</strong></td>
      <td class="r">${esc(it.qty) || '-'}</td>
      <td class="r">${rateDisplay}</td>
      <td class="r amount-cell">${amtDisplay}</td>
    `;
    tbody.appendChild(tr);
  });

  // Summary calculation
  const summaryTbody = $('#doc_summary_tbody');
  let summaryHtml = '';

  if (isFreelancer) {
    summaryHtml += `<tr><td>${t('referralSubtotal')}</td><td>${formatCurrency(subtotal)}</td></tr>`;
    summaryHtml += `<tr><td>${t('workFee')}</td><td>${t('toBeConfirmed')}</td></tr>`;
    const finalTotal = hasPending ? t('toBeConfirmed') : formatCurrency(subtotal);
    summaryHtml += `<tr class="total-row"><td>${t('totalDue')}</td><td>${finalTotal}</td></tr>`;
    
    // Update badge in action bar
    $('#badge_total').textContent = finalTotal;
  } else {
    const taxVal = (subtotal * (data.taxPct || 0)) / 100;
    const finalTotal = subtotal + taxVal;
    summaryHtml += `<tr><td>${t('subtotal')}</td><td>${formatCurrency(subtotal)}</td></tr>`;
    if (data.taxPct > 0) {
      summaryHtml += `<tr><td>${t('tax')} (${data.taxPct}%)</td><td>${formatCurrency(taxVal)}</td></tr>`;
    }
    summaryHtml += `<tr class="total-row"><td>${t('totalDue')}</td><td>${formatCurrency(finalTotal)}</td></tr>`;
    
    $('#badge_total').textContent = formatCurrency(finalTotal);
  }

  summaryTbody.innerHTML = summaryHtml;

  // Payment Box
  const payBox = $('#doc_payment_box');
  if (data.bank || data.accNum || data.accName) {
    payBox.hidden = false;
    $('#doc_pay_title').textContent = t('paymentDetails');
    $('#doc_pay_grid').innerHTML = `
      ${data.bank ? `<span class="lbl">${t('bank')}:</span><span class="val">${esc(data.bank)}</span>` : ''}
      ${data.accNum ? `<span class="lbl">${t('accountNumber')}:</span><span class="val">${esc(data.accNum)}</span>` : ''}
      ${data.accName ? `<span class="lbl">${t('accountName')}:</span><span class="val">${esc(data.accName)}</span>` : ''}
    `;
  } else {
    payBox.hidden = true;
  }

  // Notes
  const notesEl = $('#doc_notes');
  if (data.notes) {
    notesEl.textContent = data.notes;
    notesEl.hidden = false;
  } else {
    notesEl.hidden = true;
  }

  // Footer
  $('#doc_foot_invnum').textContent = data.invNum || '';
  $('#doc_foot_sender').textContent = data.name || '';

  // Auto-persist draft
  saveDraftToStorage();
}

/* ---------- Event Handlers ---------- */
function bindEvents() {
  // Tabs (Freelancer vs Service)
  $$('[data-tab-switch]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tabSwitch;
      S.tab = tab;
      $$('[data-tab-switch]').forEach(b => b.classList.toggle('active', b === btn));
      $('#view_freelancer').classList.toggle('active', tab === 'freelancer');
      $('#view_service').classList.toggle('active', tab === 'service');
      updateDocPreview();
    });
  });

  // Language buttons
  $$('[data-lang]').forEach(btn => {
    btn.addEventListener('click', () => {
      S.lang = btn.dataset.lang;
      $$('[data-lang]').forEach(b => b.classList.toggle('active', b === btn));
      updateDocPreview();
    });
  });

  // Currency buttons
  $$('[data-currency]').forEach(btn => {
    btn.addEventListener('click', () => {
      S.currency = btn.dataset.currency;
      $$('[data-currency]').forEach(b => b.classList.toggle('active', b === btn));
      updateDocPreview();
    });
  });

  // Form field inputs (Freelancer)
  const mapF = {
    f_invnum: 'invNum', f_invdate: 'invDate', f_workperiod: 'workPeriod',
    f_name: 'name', f_subtitle: 'subtitle', f_billto: 'billTo', f_billaddr: 'billAddr',
    f_bank: 'bank', f_accnum: 'accNum', f_accname: 'accName', f_notes: 'notes'
  };
  Object.keys(mapF).forEach(id => {
    const el = $(`#${id}`);
    if (el) el.addEventListener('input', e => {
      S.f[mapF[id]] = e.target.value;
      updateDocPreview();
    });
  });

  // Form field inputs (Service)
  const mapS = {
    s_invnum: 'invNum', s_invdate: 'invDate', s_duedate: 'dueDate',
    s_name: 'name', s_subtitle: 'subtitle', s_billto: 'billTo', s_billaddr: 'billAddr',
    s_taxpct: 'taxPct', f_bank: 'bank', s_accnum: 'accNum', s_accname: 'accName', s_notes: 'notes'
  };
  Object.keys(mapS).forEach(id => {
    const el = $(`#${id}`);
    if (el) el.addEventListener('input', e => {
      if (id === 's_taxpct') S.s.taxPct = parseFloat(e.target.value) || 0;
      else S.s[mapS[id]] = e.target.value;
      updateDocPreview();
    });
  });

  // Add Item buttons
  $('#btn_add_f_item')?.addEventListener('click', () => addItem('freelancer'));
  $('#btn_add_s_item')?.addEventListener('click', () => addItem('service'));

  // Table input delegation
  document.addEventListener('input', e => {
    const t = e.target;
    const act = t.dataset.act;
    const tab = t.dataset.tab;
    const id = parseInt(t.dataset.id, 10);
    if (!act || !tab || isNaN(id)) return;

    const data = tab === 'freelancer' ? S.f : S.s;
    const item = data.items.find(it => it.id === id);
    if (!item) return;

    if (act === 'desc') item.desc = t.value;
    else if (act === 'qty') item.qty = t.value;
    else if (act === 'rate') item.rate = t.value;

    updateDocPreview();
  });

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    const tab = btn.dataset.tab;
    const id = parseInt(btn.dataset.id, 10);

    if (act === 'del-item' && tab && !isNaN(id)) {
      deleteItem(tab, id);
    }
  });

  // Export PDF
  $('#btn_export_pdf')?.addEventListener('click', exportPDF);
  // Print
  $('#btn_print')?.addEventListener('click', () => window.print());
  // Copy breakdown
  $('#btn_copy_summary')?.addEventListener('click', copyInvoiceSummary);
  // Save profile / Load profile
  $('#btn_save_defaults')?.addEventListener('click', saveDefaultProfile);
  $('#btn_load_defaults')?.addEventListener('click', loadDefaultProfile);
}

/* ---------- PDF Export Engine (html2pdf.js) ---------- */
function exportPDF() {
  const paper = $('#invoice_paper');
  if (!paper) return;

  const isFreelancer = S.tab === 'freelancer';
  const data = isFreelancer ? S.f : S.s;
  const senderSlug = (data.name || 'Invoice').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
  const invNumSlug = (data.invNum || '001').replace(/[^\w-]/g, '');
  const fileName = `Invoice_${senderSlug}_${invNumSlug}.pdf`;

  showToast('⏳ ĐANG XUẤT PDF VECTOR...');

  const opt = {
    margin: [6, 6, 6, 6], // mm
    filename: fileName,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2.5, // Crisp high-res rendering
      useCORS: true,
      letterRendering: true,
      scrollY: 0,
      scrollX: 0
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait'
    }
  };

  html2pdf().set(opt).from(paper).save().then(() => {
    showToast(`✅ ĐÃ XUẤT: ${fileName}`);
  }).catch(err => {
    console.error('PDF Export Error:', err);
    showToast('❌ LỖI XUẤT PDF. VUI LÒNG THỬ IN (PRINT)');
  });
}

/* ---------- Copy Summary to Clipboard ---------- */
function copyInvoiceSummary() {
  const isFreelancer = S.tab === 'freelancer';
  const data = isFreelancer ? S.f : S.s;

  let lines = [];
  lines.push(`📄 ${t('invoice').toUpperCase()}: #${data.invNum}`);
  lines.push(`👤 ${t('from')}: ${data.name}`);
  lines.push(`🏢 ${t('billTo')}: ${data.billTo}`);
  lines.push(`📅 ${t('invoiceDate')}: ${formatDateDisplay(data.invDate)}`);
  if (isFreelancer && data.workPeriod) lines.push(`⏱️ ${t('workPeriod')}: ${data.workPeriod}`);
  if (!isFreelancer && data.dueDate) lines.push(`⏰ ${t('dueDate')}: ${formatDateDisplay(data.dueDate)}`);
  lines.push(`💰 ${t('currency')}: ${S.currency}`);
  lines.push('\n--- CHI TIẾT ---');

  let subtotal = 0;
  data.items.forEach((it, i) => {
    const qNum = parseQty(it.qty);
    const rNum = parseMoney(it.rate);
    const amtStr = (!isNaN(qNum) && !isNaN(rNum)) ? formatCurrency(qNum * rNum) : (it.rate || t('toBeConfirmed'));
    if (!isNaN(qNum) && !isNaN(rNum)) subtotal += qNum * rNum;
    lines.push(`${i + 1}. ${it.desc} | SL: ${it.qty} | Đơn giá: ${it.rate} => ${amtStr}`);
  });

  lines.push('\n--- TỔNG KẾT ---');
  if (isFreelancer) {
    lines.push(`${t('referralSubtotal')}: ${formatCurrency(subtotal)}`);
    lines.push(`${t('workFee')}: ${t('toBeConfirmed')}`);
  } else {
    lines.push(`${t('subtotal')}: ${formatCurrency(subtotal)}`);
    if (data.taxPct > 0) lines.push(`${t('tax')} (${data.taxPct}%): ${formatCurrency(subtotal * data.taxPct / 100)}`);
    lines.push(`${t('totalDue')}: ${formatCurrency(subtotal * (1 + (data.taxPct || 0) / 100))}`);
  }

  if (data.bank || data.accNum || data.accName) {
    lines.push('\n--- THANH TOÁN ---');
    if (data.bank) lines.push(`🏦 Ngân hàng: ${data.bank}`);
    if (data.accNum) lines.push(`💳 Số TK: ${data.accNum}`);
    if (data.accName) lines.push(`👤 Tên TK: ${data.accName}`);
  }

  navigator.clipboard.writeText(lines.join('\n')).then(() => {
    showToast('📋 ĐÃ COPY BẢNG TỔNG HỢP');
  }).catch(() => {
    showToast('⚠️ KHÔNG THỂ COPY VÀO CLIPBOARD');
  });
}

/* ---------- LocalStorage Persistence ---------- */
const STORAGE_KEY_PROFILE = 'oddpig_invoice_profile';
const STORAGE_KEY_DRAFT = 'oddpig_invoice_draft';

function saveDefaultProfile() {
  const profile = {
    name: S.f.name,
    subtitle: S.f.subtitle,
    bank: S.f.bank,
    accNum: S.f.accNum,
    accName: S.f.accName,
    currency: S.currency,
    lang: S.lang
  };
  localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
  showToast('💾 ĐÃ LƯU THÔNG TIN MẶC ĐỊNH');
}

function loadDefaultProfile() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_PROFILE);
    if (!saved) {
      showToast('⚠️ CHƯA CÓ DỮ LIỆU MẶC ĐỊNH');
      return;
    }
    const p = JSON.parse(saved);
    if (p.name) S.f.name = S.s.name = p.name;
    if (p.subtitle) S.f.subtitle = S.s.subtitle = p.subtitle;
    if (p.bank) S.f.bank = S.s.bank = p.bank;
    if (p.accNum) S.f.accNum = S.s.accNum = p.accNum;
    if (p.accName) S.f.accName = S.s.accName = p.accName;
    if (p.currency) S.currency = p.currency;
    if (p.lang) S.lang = p.lang;

    // Sync UI elements
    $$('[data-currency]').forEach(b => b.classList.toggle('active', b.dataset.currency === S.currency));
    $$('[data-lang]').forEach(b => b.classList.toggle('active', b.dataset.lang === S.lang));

    initFormFields();
    updateDocPreview();
    showToast('📂 ĐÃ TẢI THÔNG TIN MẶC ĐỊNH');
  } catch (e) {
    showToast('❌ LỖI ĐỌC DỮ LIỆU');
  }
}

function saveDraftToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY_DRAFT, JSON.stringify({
      tab: S.tab,
      lang: S.lang,
      currency: S.currency,
      f: S.f,
      s: S.s
    }));
  } catch (e) {}
}

function loadDraftFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DRAFT);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d.tab) S.tab = d.tab;
    if (d.lang) S.lang = d.lang;
    if (d.currency) S.currency = d.currency;
    if (d.f) S.f = d.f;
    if (d.s) S.s = d.s;

    // Sync pill buttons
    $$('[data-tab-switch]').forEach(b => b.classList.toggle('active', b.dataset.tabSwitch === S.tab));
    $$('[data-currency]').forEach(b => b.classList.toggle('active', b.dataset.currency === S.currency));
    $$('[data-lang]').forEach(b => b.classList.toggle('active', b.dataset.lang === S.lang));
    
    $('#view_freelancer')?.classList.toggle('active', S.tab === 'freelancer');
    $('#view_service')?.classList.toggle('active', S.tab === 'service');
  } catch (e) {}
}

/* ---------- Toast System ---------- */
let toastTimeout;
function showToast(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- Timecode Clock (Odd Pig Signature) ---------- */
function tickTC() {
  const el = $('#tcClock');
  if (!el) return;
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  el.textContent = `TC ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}:${p(Math.floor(d.getMilliseconds() / 40))}`;
}

/* ---------- Initialize Application ---------- */
function init() {
  loadDraftFromStorage();
  initFormFields();
  bindEvents();
  updateDocPreview();

  // Timecode loop
  setInterval(tickTC, 40);
  tickTC();
}

document.addEventListener('DOMContentLoaded', init);
