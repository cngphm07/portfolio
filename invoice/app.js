'use strict';

/* ============================================================
   CNGPHM — INVOICE STUDIO JAVASCRIPT ENGINE
   ============================================================ */

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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
window.S = {
  tab: 'freelancer',
  lang: 'en',
  currency: 'VND',
  
  // Freelancer form
  f: {
    invNum: 'INV-001',
    invDate: '22/08/2026',
    workFrom: '20/08/2026',
    workTo: '24/08/2026',
    name: 'Nguyen Van A',
    subtitle: 'Invoice for services and referrals',
    email: 'contact@example.com',
    address: 'Ho Chi Minh City, Vietnam',
    billTo: 'The Speechless Communication Pty Ltd',
    billAddr: 'Sydney, NSW, Australia',
    bank: 'Techcombank (Vietnam Technological and Commercial Joint Stock Bank)',
    accNum: '19030012345678',
    accName: 'NGUYEN VAN A',
    notes: 'Thank you.\n3 days',
    items: [
      { id: 1, desc: 'Work: 20/08/2026 - 24/08/2026', qty: '3 days', rate: '', isTbc: true, amount: 0 },
      { id: 2, desc: 'Editor referral fee', qty: '2 referrals', rate: '2,250,000', isTbc: false, amount: 4500000 },
    ]
  },

  // Service form
  s: {
    invNum: 'INV-001',
    invDate: '22/08/2026',
    dueDate: '05/09/2026',
    name: 'CNGPHM Studio',
    subtitle: 'Media Production & Post-Production Studio',
    email: 'contact@oddpig.io.vn',
    address: 'Ho Chi Minh City, Vietnam',
    billTo: 'The Speechless Communication Pty Ltd',
    billAddr: 'Sydney, NSW, Australia',
    taxPct: 0,
    bank: 'Techcombank (Vietnam Technological and Commercial Joint Stock Bank)',
    accNum: '19030012345678',
    accName: 'CNGPHM STUDIO',
    notes: 'Payment is due within 14 days.\nThank you for working with us!',
    items: [
      { id: 1, desc: 'Commercial Video Editing (3 reels)', qty: '3', rate: '2,500,000', isTbc: false, amount: 7500000 },
      { id: 2, desc: 'Sound Design & Audio Mastering', qty: '1', rate: '1,500,000', isTbc: false, amount: 1500000 },
    ]
  }
};

let nextItemId = 100;

/* ---------- Helper Functions ---------- */
function parseDmy(str) {
  if (!str) return null;
  if (str instanceof Date) return str;
  const parts = String(str).trim().split(/[\/\-.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateDisplay(dmy) {
  if (!dmy) return '';
  const d = parseDmy(dmy);
  if (!d) return dmy;
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// Always strictly dd/mm/yyyy - dd/mm/yyyy
function formatWorkPeriodDisplay(fromDmy, toDmy) {
  if (!fromDmy && !toDmy) return '-';
  if (fromDmy && !toDmy) return formatDateDisplay(fromDmy);
  if (!fromDmy && toDmy) return formatDateDisplay(toDmy);

  const d1 = parseDmy(fromDmy);
  const d2 = parseDmy(toDmy);
  if (!d1 || !d2) return `${fromDmy} - ${toDmy}`;

  const pad = n => String(n).padStart(2, '0');
  const str1 = `${pad(d1.getDate())}/${pad(d1.getMonth() + 1)}/${d1.getFullYear()}`;
  const str2 = `${pad(d2.getDate())}/${pad(d2.getMonth() + 1)}/${d2.getFullYear()}`;
  return `${str1} - ${str2}`;
}

function t(key) {
  return I18N[S.lang]?.[key] || I18N.en[key] || key;
}

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

  const setVal = (id, val) => { const el = $(`#${id}`); if (el) el.value = val ?? ''; };
  setVal('f_invnum', f.invNum);
  setVal('f_invdate', f.invDate);
  setVal('f_work_from', f.workFrom);
  setVal('f_work_to', f.workTo);
  setVal('f_name', f.name);
  setVal('f_subtitle', f.subtitle);
  setVal('f_billto', f.billTo);
  setVal('f_billaddr', f.billAddr);
  setVal('f_bank', f.bank);
  setVal('f_accnum', f.accNum);
  setVal('f_accname', f.accName);
  setVal('f_notes', f.notes);

  setVal('s_invnum', s.invNum);
  setVal('s_invdate', s.invDate);
  setVal('s_duedate', s.dueDate);
  setVal('s_name', s.name);
  setVal('s_subtitle', s.subtitle);
  setVal('s_billto', s.billTo);
  setVal('s_billaddr', s.billAddr);
  setVal('s_taxpct', s.taxPct);
  setVal('s_bank', s.bank);
  setVal('s_accnum', s.accNum);
  setVal('s_accname', s.accName);
  setVal('s_notes', s.notes);

  renderItemInputs('freelancer');
  renderItemInputs('service');
}

// Collects whatever the user typed in line items before re-rendering
function collectCurrentItemInputsFromDOM(tab) {
  const wrap = $(`#${tab === 'freelancer' ? 'f' : 's'}_items_wrap`);
  if (!wrap) return;
  const rows = wrap.querySelectorAll('.item-row');
  const data = tab === 'freelancer' ? S.f : S.s;
  if (!data || !Array.isArray(data.items)) return;

  rows.forEach(row => {
    const descIn = row.querySelector('[data-act="desc"]');
    const qtyIn = row.querySelector('[data-act="qty"]');
    const rateIn = row.querySelector('[data-act="rate"]');
    const tbcIn = row.querySelector('[data-act="tbc"]');
    if (!descIn) return;
    const id = parseInt(descIn.dataset.id, 10);
    const item = data.items.find(it => it.id === id);
    if (item) {
      if (descIn) item.desc = descIn.value;
      if (qtyIn) item.qty = qtyIn.value;
      if (tbcIn) item.isTbc = tbcIn.checked;
      if (rateIn && !item.isTbc) item.rate = rateIn.value;
    }
  });
}

function renderItemInputs(tab) {
  const data = tab === 'freelancer' ? S.f : S.s;
  if (!data || !Array.isArray(data.items)) {
    if (data) data.items = [];
  }
  const wrap = $(`#${tab === 'freelancer' ? 'f' : 's'}_items_wrap`);
  if (!wrap) return;

  wrap.innerHTML = '';
  data.items.forEach(item => {
    const isTbc = !!item.isTbc;
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
      <input type="text" placeholder="Mô tả công việc" value="${esc(item.desc)}" data-act="desc" data-tab="${tab}" data-id="${item.id}">
      <input type="text" placeholder="SL / Ngày" value="${esc(item.qty)}" data-act="qty" data-tab="${tab}" data-id="${item.id}" style="text-align:right">
      <input type="text" class="money-in" placeholder="${isTbc ? 'Chờ xác nhận' : 'Đơn giá'}" value="${isTbc ? '' : esc(item.rate)}" ${isTbc ? 'disabled' : ''} data-act="rate" data-tab="${tab}" data-id="${item.id}">
      <label class="tbc-check" title="To be confirmed (Chờ xác nhận)">
        <input type="checkbox" ${isTbc ? 'checked' : ''} onchange="toggleItemTbc('${tab}', ${item.id}, this.checked)" data-act="tbc" data-tab="${tab}" data-id="${item.id}">
        <span>TBC</span>
      </label>
      <button type="button" class="item-del-btn" onclick="deleteItem('${tab}', ${item.id})" title="Xóa dòng">✕</button>
    `;
    wrap.appendChild(row);
  });
}

window.toggleItemTbc = function(tab, id, checked) {
  const data = tab === 'freelancer' ? S.f : S.s;
  if (!data || !Array.isArray(data.items)) return;
  collectCurrentItemInputsFromDOM(tab);
  const item = data.items.find(it => it.id === id);
  if (item) {
    item.isTbc = checked;
  }
  renderItemInputs(tab);
  syncAllInputsToStateAndPreview();
};

window.addItem = function(tab) {
  const activeTab = tab || S.tab || 'freelancer';
  const data = activeTab === 'freelancer' ? S.f : S.s;
  if (!Array.isArray(data.items)) data.items = [];
  
  // Save whatever user typed into DOM before re-render
  collectCurrentItemInputsFromDOM(activeTab);

  const newId = ++nextItemId;
  data.items.push({
    id: newId,
    desc: '',
    qty: '1',
    rate: '0',
    isTbc: false,
    amount: 0
  });

  renderItemInputs(activeTab);
  syncAllInputsToStateAndPreview();

  // Focus the new row's description input smoothly
  setTimeout(() => {
    const wrap = $(`#${activeTab === 'freelancer' ? 'f' : 's'}_items_wrap`);
    if (wrap) {
      const inputs = wrap.querySelectorAll('.item-row input[data-act="desc"]');
      if (inputs.length > 0) {
        inputs[inputs.length - 1].focus();
      }
    }
  }, 20);
};

window.deleteItem = function(tab, id) {
  const data = tab === 'freelancer' ? S.f : S.s;
  if (!data || !Array.isArray(data.items)) return;
  collectCurrentItemInputsFromDOM(tab);
  const idx = data.items.findIndex(it => it.id === id);
  if (idx > -1) {
    data.items.splice(idx, 1);
    renderItemInputs(tab);
    syncAllInputsToStateAndPreview();
  }
};

window.switchTab = function(tab) {
  S.tab = tab;
  $$('[data-tab-switch]').forEach(b => b.classList.toggle('active', b.dataset.tabSwitch === tab));
  const viewF = $('#view_freelancer');
  if (viewF) {
    viewF.classList.toggle('active', tab === 'freelancer');
    viewF.hidden = (tab !== 'freelancer');
  }
  const viewS = $('#view_service');
  if (viewS) {
    viewS.classList.toggle('active', tab === 'service');
    viewS.hidden = (tab !== 'service');
  }
  syncAllInputsToStateAndPreview();
};

window.setLang = function(lang) {
  S.lang = lang;
  $$('[data-lang]').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
  syncAllInputsToStateAndPreview();
};

window.setCurrency = function(curr) {
  S.currency = curr;
  $$('[data-currency]').forEach(b => b.classList.toggle('active', b.dataset.currency === curr));
  syncAllInputsToStateAndPreview();
};

/* ---------- Universal Live Sync Engine ---------- */
window.syncAllInputsToStateAndPreview = function() {
  // Read all Freelancer inputs
  const fNum = $('#f_invnum'); if (fNum) S.f.invNum = fNum.value;
  const fDate = $('#f_invdate'); if (fDate) S.f.invDate = fDate.value;
  const fFrom = $('#f_work_from'); if (fFrom) S.f.workFrom = fFrom.value;
  const fTo = $('#f_work_to'); if (fTo) S.f.workTo = fTo.value;
  const fName = $('#f_name'); if (fName) S.f.name = fName.value;
  const fSub = $('#f_subtitle'); if (fSub) S.f.subtitle = fSub.value;
  const fBill = $('#f_billto'); if (fBill) S.f.billTo = fBill.value;
  const fAddr = $('#f_billaddr'); if (fAddr) S.f.billAddr = fAddr.value;
  const fBank = $('#f_bank'); if (fBank) S.f.bank = fBank.value;
  const fAccN = $('#f_accnum'); if (fAccN) S.f.accNum = fAccN.value;
  const fAccNm = $('#f_accname'); if (fAccNm) S.f.accName = fAccNm.value;
  const fNotes = $('#f_notes'); if (fNotes) S.f.notes = fNotes.value;

  // Read all Service inputs
  const sNum = $('#s_invnum'); if (sNum) S.s.invNum = sNum.value;
  const sDate = $('#s_invdate'); if (sDate) S.s.invDate = sDate.value;
  const sDue = $('#s_duedate'); if (sDue) S.s.dueDate = sDue.value;
  const sName = $('#s_name'); if (sName) S.s.name = sName.value;
  const sSub = $('#s_subtitle'); if (sSub) S.s.subtitle = sSub.value;
  const sBill = $('#s_billto'); if (sBill) S.s.billTo = sBill.value;
  const sAddr = $('#s_billaddr'); if (sAddr) S.s.billAddr = sAddr.value;
  const sTax = $('#s_taxpct'); if (sTax) S.s.taxPct = parseFloat(sTax.value) || 0;
  const sBank = $('#s_bank'); if (sBank) S.s.bank = sBank.value;
  const sAccN = $('#s_accnum'); if (sAccN) S.s.accNum = sAccN.value;
  const sAccNm = $('#s_accname'); if (sAccNm) S.s.accName = sAccNm.value;
  const sNotes = $('#s_notes'); if (sNotes) S.s.notes = sNotes.value;

  updateDocPreview();
};

/* ---------- Render Preview to Paper Viewport ---------- */
function updateDocPreview() {
  const isFreelancer = S.tab === 'freelancer';
  const data = isFreelancer ? S.f : S.s;
  if (!data) return;

  // Header
  const senderNameEl = $('#doc_sender_name');
  if (senderNameEl) senderNameEl.textContent = data.name || 'Your Name';
  const senderSubEl = $('#doc_sender_sub');
  if (senderSubEl) senderSubEl.textContent = data.subtitle || '';
  const titleEl = $('#doc_title');
  if (titleEl) titleEl.textContent = t('invoice');
  const invIdEl = $('#doc_inv_id');
  if (invIdEl) invIdEl.textContent = data.invNum ? `#${data.invNum}` : '';

  // Meta Left
  const billToLbl = $('#doc_billto_label');
  if (billToLbl) billToLbl.textContent = t('billTo');
  const billToName = $('#doc_billto_name');
  if (billToName) billToName.textContent = data.billTo || '-';
  const addrEl = $('#doc_billto_addr');
  if (addrEl) {
    if (data.billAddr) {
      addrEl.textContent = data.billAddr;
      addrEl.hidden = false;
    } else {
      addrEl.hidden = true;
    }
  }

  // Meta Right
  const dateLbl = $('#doc_date_label');
  if (dateLbl) dateLbl.textContent = t('invoiceDate') + ':';
  const dateVal = $('#doc_date_val');
  if (dateVal) dateVal.textContent = formatDateDisplay(data.invDate) || '-';

  const periodRow = $('#doc_period_row');
  const dueRow = $('#doc_due_row');

  if (isFreelancer) {
    if (periodRow) periodRow.hidden = false;
    if (dueRow) dueRow.hidden = true;
    const pLbl = $('#doc_period_label');
    if (pLbl) pLbl.textContent = t('workPeriod') + ':';
    const pVal = $('#doc_period_val');
    if (pVal) pVal.textContent = formatWorkPeriodDisplay(data.workFrom, data.workTo);
  } else {
    if (periodRow) periodRow.hidden = true;
    if (dueRow) dueRow.hidden = false;
    const dLbl = $('#doc_due_label');
    if (dLbl) dLbl.textContent = t('dueDate') + ':';
    const dVal = $('#doc_due_val');
    if (dVal) dVal.textContent = formatDateDisplay(data.dueDate) || '-';
  }

  const currLbl = $('#doc_curr_label');
  if (currLbl) currLbl.textContent = t('currency') + ':';
  const currVal = $('#doc_curr_val');
  if (currVal) currVal.textContent = S.currency;

  // Table Headers
  const thDesc = $('#doc_th_desc'); if (thDesc) thDesc.textContent = t('description');
  const thQty = $('#doc_th_qty'); if (thQty) thQty.textContent = t('qty');
  const thRate = $('#doc_th_rate'); if (thRate) thRate.textContent = isFreelancer ? t('rate') : t('unitPrice');
  const thAmt = $('#doc_th_amt'); if (thAmt) thAmt.textContent = t('amount');

  // Table Rows & Totals Calculation
  const tbody = $('#doc_tbody');
  if (tbody) {
    tbody.innerHTML = '';
    let subtotal = 0;
    let hasPending = false;

    if (Array.isArray(data.items)) {
      data.items.forEach(it => {
        let rateDisplay = '';
        let amtDisplay = '';

        if (it.isTbc) {
          hasPending = true;
          it.amount = 0;
          rateDisplay = t('toBeConfirmed');
          amtDisplay = t('toBeConfirmed');
        } else {
          const qNum = parseQty(it.qty);
          const rNum = parseMoney(it.rate);

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
    }

    const summaryTbody = $('#doc_summary_tbody');
    if (summaryTbody) {
      let summaryHtml = '';
      if (isFreelancer) {
        summaryHtml += `<tr><td>${t('referralSubtotal')}</td><td>${formatCurrency(subtotal)}</td></tr>`;
        if (hasPending) {
          summaryHtml += `<tr><td>${t('workFee')}</td><td>${t('toBeConfirmed')}</td></tr>`;
        }
        const finalTotal = hasPending ? t('toBeConfirmed') : formatCurrency(subtotal);
        summaryHtml += `<tr class="total-row"><td>${t('totalDue')}</td><td>${finalTotal}</td></tr>`;
        
        const badge = $('#badge_total');
        if (badge) badge.textContent = finalTotal;
      } else {
        const taxVal = (subtotal * (data.taxPct || 0)) / 100;
        const finalTotal = subtotal + taxVal;
        summaryHtml += `<tr><td>${t('subtotal')}</td><td>${formatCurrency(subtotal)}</td></tr>`;
        if (data.taxPct > 0) {
          summaryHtml += `<tr><td>${t('tax')} (${data.taxPct}%): ${formatCurrency(taxVal)}</td></tr>`;
        }
        summaryHtml += `<tr class="total-row"><td>${t('totalDue')}</td><td>${formatCurrency(finalTotal)}</td></tr>`;
        
        const badge = $('#badge_total');
        if (badge) badge.textContent = formatCurrency(finalTotal);
      }
      summaryTbody.innerHTML = summaryHtml;
    }
  }

  // Payment Box
  const payBox = $('#doc_payment_box');
  if (payBox) {
    if (data.bank || data.accNum || data.accName) {
      payBox.hidden = false;
      const pTitle = $('#doc_pay_title');
      if (pTitle) pTitle.textContent = t('paymentDetails');
      const pGrid = $('#doc_pay_grid');
      if (pGrid) {
        pGrid.innerHTML = `
          ${data.bank ? `<span class="lbl">${t('bank')}:</span><span class="val">${esc(data.bank)}</span>` : ''}
          ${data.accNum ? `<span class="lbl">${t('accountNumber')}:</span><span class="val">${esc(data.accNum)}</span>` : ''}
          ${data.accName ? `<span class="lbl">${t('accountName')}:</span><span class="val">${esc(data.accName)}</span>` : ''}
        `;
      }
    } else {
      payBox.hidden = true;
    }
  }

  // Notes
  const notesEl = $('#doc_notes');
  if (notesEl) {
    if (data.notes) {
      notesEl.textContent = data.notes;
      notesEl.hidden = false;
    } else {
      notesEl.hidden = true;
    }
  }

  // Footer
  const footInv = $('#doc_foot_invnum');
  if (footInv) footInv.textContent = data.invNum || '';
  const footSender = $('#doc_foot_sender');
  if (footSender) footSender.textContent = data.name || '';

  saveDraftToStorage();
}

/* ---------- Event Handlers ---------- */
function bindEvents() {
  // Real-time input synchronization
  document.addEventListener('input', e => {
    const t = e.target;
    if (t && t.dataset && t.dataset.act && t.dataset.tab) {
      const act = t.dataset.act;
      const tab = t.dataset.tab;
      const id = parseInt(t.dataset.id, 10);
      const data = tab === 'freelancer' ? S.f : S.s;
      if (data && Array.isArray(data.items)) {
        const item = data.items.find(it => it.id === id);
        if (item) {
          if (act === 'desc') item.desc = t.value;
          else if (act === 'qty') item.qty = t.value;
          else if (act === 'rate' && !item.isTbc) item.rate = t.value;
        }
      }
    }
    syncAllInputsToStateAndPreview();
  });

  document.addEventListener('change', () => {
    syncAllInputsToStateAndPreview();
  });

  document.addEventListener('keyup', () => {
    syncAllInputsToStateAndPreview();
  });

  document.addEventListener('paste', () => {
    setTimeout(syncAllInputsToStateAndPreview, 10);
  });
}

/* ---------- PDF Export Engine (html2pdf.js) ---------- */
window.exportPDF = function() {
  const paper = $('#invoice_paper');
  if (!paper) return;

  const isFreelancer = S.tab === 'freelancer';
  const data = isFreelancer ? S.f : S.s;
  const senderSlug = (data.name || 'Invoice').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
  const invNumSlug = (data.invNum || '001').replace(/[^\w-]/g, '');
  const fileName = `Invoice_${senderSlug}_${invNumSlug}.pdf`;

  showToast('⏳ ĐANG XUẤT PDF VECTOR...');

  const opt = {
    margin: [6, 6, 6, 6],
    filename: fileName,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2.5,
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
};

/* ---------- Copy Summary to Clipboard ---------- */
window.copyInvoiceSummary = function() {
  const isFreelancer = S.tab === 'freelancer';
  const data = isFreelancer ? S.f : S.s;

  let lines = [];
  lines.push(`📄 ${t('invoice').toUpperCase()}: #${data.invNum}`);
  lines.push(`👤 ${t('from')}: ${data.name}`);
  lines.push(`🏢 ${t('billTo')}: ${data.billTo}`);
  lines.push(`📅 ${t('invoiceDate')}: ${formatDateDisplay(data.invDate)}`);
  if (isFreelancer) lines.push(`⏱️ ${t('workPeriod')}: ${formatWorkPeriodDisplay(data.workFrom, data.workTo)}`);
  if (!isFreelancer && data.dueDate) lines.push(`⏰ ${t('dueDate')}: ${formatDateDisplay(data.dueDate)}`);
  lines.push(`💰 ${t('currency')}: ${S.currency}`);
  lines.push('\n--- CHI TIẾT ---');

  let subtotal = 0;
  if (Array.isArray(data.items)) {
    data.items.forEach((it, i) => {
      let amtStr = '';
      let rateStr = '';
      if (it.isTbc) {
        rateStr = t('toBeConfirmed');
        amtStr = t('toBeConfirmed');
      } else {
        const qNum = parseQty(it.qty);
        const rNum = parseMoney(it.rate);
        if (!isNaN(qNum) && !isNaN(rNum)) {
          subtotal += qNum * rNum;
          rateStr = formatCurrency(rNum);
          amtStr = formatCurrency(qNum * rNum);
        } else {
          rateStr = it.rate || t('toBeConfirmed');
          amtStr = t('toBeConfirmed');
        }
      }
      lines.push(`${i + 1}. ${it.desc} | SL: ${it.qty} | Đơn giá: ${rateStr} => ${amtStr}`);
    });
  }

  lines.push('\n--- TỔNG KẾT ---');
  if (isFreelancer) {
    lines.push(`${t('referralSubtotal')}: ${formatCurrency(subtotal)}`);
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
};

/* ---------- LocalStorage Persistence ---------- */
const STORAGE_KEY_PROFILE = 'oddpig_invoice_profile';
const STORAGE_KEY_DRAFT = 'oddpig_invoice_draft';

window.saveDefaultProfile = function() {
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
};

window.loadDefaultProfile = function() {
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

    $$('[data-currency]').forEach(b => b.classList.toggle('active', b.dataset.currency === S.currency));
    $$('[data-lang]').forEach(b => b.classList.toggle('active', b.dataset.lang === S.lang));

    initFormFields();
    syncAllInputsToStateAndPreview();
    showToast('📂 ĐÃ TẢI THÔNG TIN MẶC ĐỊNH');
  } catch (e) {
    showToast('❌ LỖI ĐỌC DỮ LIỆU');
  }
};

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

    $$('[data-tab-switch]').forEach(b => b.classList.toggle('active', b.dataset.tabSwitch === S.tab));
    $$('[data-currency]').forEach(b => b.classList.toggle('active', b.dataset.currency === S.currency));
    $$('[data-lang]').forEach(b => b.classList.toggle('active', b.dataset.lang === S.lang));
    
    const viewF = $('#view_freelancer');
    if (viewF) {
      viewF.classList.toggle('active', S.tab === 'freelancer');
      viewF.hidden = (S.tab !== 'freelancer');
    }
    const viewS = $('#view_service');
    if (viewS) {
      viewS.classList.toggle('active', S.tab === 'service');
      viewS.hidden = (S.tab !== 'service');
    }
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

/* ---------- Timecode Clock ---------- */
function tickTC() {
  const el = $('#tcClock');
  if (!el) return;
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  el.textContent = `TC ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}:${p(Math.floor(d.getMilliseconds() / 40))}`;
}

function todayDmy() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/* ---------- Flatpickr Datepicker Initialization ---------- */
let fpInstances = {};
function initDatePickers() {
  if (typeof flatpickr === 'function') {
    const ids = ['f_invdate', 'f_work_from', 'f_work_to', 's_invdate', 's_duedate'];
    ids.forEach(id => {
      const el = $(`#${id}`);
      if (el) {
        if (fpInstances[id]) {
          try { fpInstances[id].destroy(); } catch (e) {}
        }
        fpInstances[id] = flatpickr(el, {
          dateFormat: 'd/m/Y',
          allowInput: true,
          disableMobile: false,
          onReady: function(selectedDates, dateStr, instance) {
            if (!instance.calendarContainer.querySelector('.flatpickr-custom-footer')) {
              const footer = document.createElement('div');
              footer.className = 'flatpickr-custom-footer';
              footer.innerHTML = `
                <button type="button" class="fp-today-btn">● TODAY (${todayDmy()})</button>
              `;
              footer.querySelector('.fp-today-btn').addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                instance.setDate(new Date(), true);
                instance.close();
                syncAllInputsToStateAndPreview();
              });
              instance.calendarContainer.appendChild(footer);
            }
          },
          onChange: () => syncAllInputsToStateAndPreview(),
          onClose: () => syncAllInputsToStateAndPreview()
        });
      }
    });
  }
}

/* ---------- Bank Database & Autocomplete Engine ---------- */
const VIETNAM_BANKS = [
  {
    code: 'VPB',
    short: 'VPBank',
    full: 'VPBANK (Vietnam Prosperity Joint Stock Commercial Bank)',
    vn: 'Ngân hàng TMCP Việt Nam Thịnh Vượng',
    keywords: 'vpb vpbank việt nam thịnh vượng vietnam prosperity'
  },
  {
    code: 'TCB',
    short: 'Techcombank',
    full: 'TECHCOMBANK (Vietnam Technological and Commercial Joint Stock Bank)',
    vn: 'Ngân hàng TMCP Kỹ Thương Việt Nam',
    keywords: 'tcb techcombank kỹ thương technological and commercial'
  },
  {
    code: 'VCB',
    short: 'Vietcombank',
    full: 'VIETCOMBANK (Joint Stock Commercial Bank for Foreign Trade of Vietnam)',
    vn: 'Ngân hàng TMCP Ngoại Thương Việt Nam',
    keywords: 'vcb vietcombank ngoại thương foreign trade'
  },
  {
    code: 'MB',
    short: 'MBBank',
    full: 'MBBANK (Military Commercial Joint Stock Bank)',
    vn: 'Ngân hàng TMCP Quân Đội',
    keywords: 'mb mbbank quân đội military commercial'
  },
  {
    code: 'ACB',
    short: 'ACB',
    full: 'ACB (Asia Commercial Joint Stock Bank)',
    vn: 'Ngân hàng TMCP Á Châu',
    keywords: 'acb á châu asia commercial'
  },
  {
    code: 'BIDV',
    short: 'BIDV',
    full: 'BIDV (Joint Stock Commercial Bank for Investment and Development of Vietnam)',
    vn: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam',
    keywords: 'bidv đầu tư phát triển investment and development'
  },
  {
    code: 'CTG',
    short: 'VietinBank',
    full: 'VIETINBANK (Vietnam Joint Stock Commercial Bank for Industry and Trade)',
    vn: 'Ngân hàng TMCP Công Thương Việt Nam',
    keywords: 'ctg vietinbank viettinbank công thương industry and trade'
  },
  {
    code: 'TPB',
    short: 'TPBank',
    full: 'TPBANK (Tien Phong Commercial Joint Stock Bank)',
    vn: 'Ngân hàng TMCP Tiên Phong',
    keywords: 'tpb tpbank tiên phong tien phong'
  },
  {
    code: 'STB',
    short: 'Sacombank',
    full: 'SACOMBANK (Saigon Thuong Tin Commercial Joint Stock Bank)',
    vn: 'Ngân hàng TMCP Sài Gòn Thương Tín',
    keywords: 'stb sacombank sài gòn thương tín saigon thuong tin'
  },
  {
    code: 'VIB',
    short: 'VIB',
    full: 'VIB (Vietnam International Commercial Joint Stock Bank)',
    vn: 'Ngân hàng TMCP Quốc Tế Việt Nam',
    keywords: 'vib quốc tế international'
  },
  {
    code: 'HDB',
    short: 'HDBank',
    full: 'HDBANK (Ho Chi Minh City Development Joint Stock Commercial Bank)',
    vn: 'Ngân hàng TMCP Phát triển TP.HCM',
    keywords: 'hdb hdbank phát triển tphcm ho chi minh city development'
  },
  {
    code: 'MSB',
    short: 'MSB',
    full: 'MSB (Vietnam Maritime Commercial Joint Stock Bank)',
    vn: 'Ngân hàng TMCP Hàng Hải Việt Nam',
    keywords: 'msb maritime bank hàng hải'
  },
  {
    code: 'SHB',
    short: 'SHB',
    full: 'SHB (Saigon - Hanoi Commercial Joint Stock Bank)',
    vn: 'Ngân hàng TMCP Sài Gòn - Hà Nội',
    keywords: 'shb sài gòn hà nội saigon hanoi'
  },
  {
    code: 'SSB',
    short: 'SeABank',
    full: 'SEABANK (Southeast Asia Commercial Joint Stock Bank)',
    vn: 'Ngân hàng TMCP Đông Nam Á',
    keywords: 'ssb seabank đông nam á southeast asia'
  },
  {
    code: 'OCB',
    short: 'OCB',
    full: 'OCB (Orient Commercial Joint Stock Bank)',
    vn: 'Ngân hàng TMCP Phương Đông',
    keywords: 'ocb phương đông orient commercial'
  },
  {
    code: 'EIB',
    short: 'Eximbank',
    full: 'EXIMBANK (Vietnam Export Import Commercial Joint Stock Bank)',
    vn: 'Ngân hàng TMCP Xuất Nhập Khẩu Việt Nam',
    keywords: 'eib eximbank xuất nhập khẩu export import'
  },
  {
    code: 'LPB',
    short: 'LPBank',
    full: 'LPBANK (Fortune Commercial Joint Stock Bank)',
    vn: 'Ngân hàng TMCP Lộc Phát Việt Nam (LienVietPostBank)',
    keywords: 'lpb lpbank lộc phát lienvietpostbank bưu điện'
  },
  {
    code: 'VBA',
    short: 'Agribank',
    full: 'AGRIBANK (Vietnam Bank for Agriculture and Rural Development)',
    vn: 'Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam',
    keywords: 'vba agribank nông nghiệp nông thôn agriculture and rural'
  },
  {
    code: 'BAB',
    short: 'Bac A Bank',
    full: 'BAC A BANK (Bac A Commercial Joint Stock Bank)',
    vn: 'Ngân hàng TMCP Bắc Á',
    keywords: 'bab bắc á bac a bank'
  },
  {
    code: 'NAB',
    short: 'Nam A Bank',
    full: 'NAM A BANK (Nam A Commercial Joint Stock Bank)',
    vn: 'Ngân hàng TMCP Nam Á',
    keywords: 'nab nam á nam a bank'
  },
  {
    code: 'PVC',
    short: 'PVcomBank',
    full: 'PVCOMBANK (Vietnam Public Joint Stock Commercial Bank)',
    vn: 'Ngân hàng TMCP Đại Chúng Việt Nam',
    keywords: 'pvc pvcombank đại chúng vietnam public'
  },
  {
    code: 'VAB',
    short: 'VietABank',
    full: 'VIETABANK (Viet A Commercial Joint Stock Bank)',
    vn: 'Ngân hàng TMCP Việt Á',
    keywords: 'vab vietabank việt á viet a bank'
  },
  {
    code: 'BVB',
    short: 'BaoViet Bank',
    full: 'BAOVIET BANK (Bao Viet Joint Stock Commercial Bank)',
    vn: 'Ngân hàng TMCP Bảo Việt',
    keywords: 'bvb baoviet bảo việt'
  },
  {
    code: 'KLB',
    short: 'KienlongBank',
    full: 'KIENLONGBANK (Kien Long Commercial Joint Stock Bank)',
    vn: 'Ngân hàng TMCP Kiên Long',
    keywords: 'klb kienlongbank kiên long kien long'
  },
  {
    code: 'SGB',
    short: 'Saigonbank',
    full: 'SAIGONBANK (Saigon Bank for Industry and Trade)',
    vn: 'Ngân hàng TMCP Sài Gòn Công Thương',
    keywords: 'sgb saigonbank sài gòn công thương'
  },
  {
    code: 'NCB',
    short: 'NCB',
    full: 'NCB (National Citizen Commercial Joint Stock Bank)',
    vn: 'Ngân hàng TMCP Quốc Dân',
    keywords: 'ncb quốc dân national citizen'
  },
  {
    code: 'SHBVN',
    short: 'Shinhan Bank',
    full: 'SHINHAN BANK (Shinhan Bank Vietnam)',
    vn: 'Ngân hàng TNHH MTV Shinhan Việt Nam',
    keywords: 'shinhan bank hàn quốc'
  },
  {
    code: 'HSBC',
    short: 'HSBC',
    full: 'HSBC (HSBC Bank Vietnam)',
    vn: 'Ngân hàng TNHH MTV HSBC Việt Nam',
    keywords: 'hsbc hong kong shanghai'
  },
  {
    code: 'SCB_INT',
    short: 'Standard Chartered',
    full: 'STANDARD CHARTERED (Standard Chartered Bank Vietnam)',
    vn: 'Ngân hàng TNHH MTV Standard Chartered Việt Nam',
    keywords: 'scb standard chartered'
  },
  {
    code: 'UOB',
    short: 'UOB',
    full: 'UOB (United Overseas Bank Vietnam)',
    vn: 'Ngân hàng United Overseas Bank Việt Nam',
    keywords: 'uob united overseas'
  },
  {
    code: 'WOO',
    short: 'Woori Bank',
    full: 'WOORI BANK (Woori Bank Vietnam)',
    vn: 'Ngân hàng TNHH MTV Woori Việt Nam',
    keywords: 'woori bank hàn quốc'
  },
  {
    code: 'PBVN',
    short: 'Public Bank',
    full: 'PUBLIC BANK (Public Bank Vietnam)',
    vn: 'Ngân hàng TNHH MTV Public Bank Việt Nam',
    keywords: 'public bank malaysia'
  },
  {
    code: 'CIMB',
    short: 'CIMB Bank',
    full: 'CIMB BANK (CIMB Bank Vietnam)',
    vn: 'Ngân hàng TNHH MTV CIMB Việt Nam',
    keywords: 'cimb bank malaysia'
  },
  {
    code: 'HLBVN',
    short: 'Hong Leong Bank',
    full: 'HONG LEONG BANK (Hong Leong Bank Vietnam)',
    vn: 'Ngân hàng TNHH MTV Hong Leong Việt Nam',
    keywords: 'hong leong bank'
  }
];

function searchBanks(query) {
  if (!query || query.trim().length < 1) return [];
  const q = query.toLowerCase().trim();
  const strip = str => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const qNorm = strip(q);

  return VIETNAM_BANKS.filter(b => {
    return b.code.toLowerCase().includes(q) ||
           b.short.toLowerCase().includes(q) ||
           strip(b.short).includes(qNorm) ||
           b.full.toLowerCase().includes(q) ||
           strip(b.full).includes(qNorm) ||
           strip(b.vn).includes(qNorm) ||
           strip(b.keywords).includes(qNorm);
  }).slice(0, 6);
}

function initBankAutocomplete(inputId, suggestBoxId) {
  const input = $(`#${inputId}`);
  const box = $(`#${suggestBoxId}`);
  if (!input || !box) return;

  function renderSuggestions() {
    const val = input.value;
    const matches = searchBanks(val);
    if (matches.length === 0) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }

    box.innerHTML = matches.map(b => `
      <div class="bank-suggest-item" data-full="${esc(b.full)}">
        <span class="bank-suggest-name">${esc(b.full)}</span>
        <span class="bank-suggest-sub">${esc(b.vn)} · ${esc(b.code)}</span>
      </div>
    `).join('');
    box.hidden = false;
  }

  input.addEventListener('input', renderSuggestions);
  input.addEventListener('focus', () => {
    if (input.value.trim().length >= 1) renderSuggestions();
  });

  box.addEventListener('click', e => {
    const item = e.target.closest('.bank-suggest-item');
    if (!item) return;
    const full = item.dataset.full;
    input.value = full;
    box.hidden = true;
    box.innerHTML = '';
    syncAllInputsToStateAndPreview();
  });

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !box.contains(e.target)) {
      box.hidden = true;
    }
  });
}

/* ---------- Initialize Application ---------- */
function init() {
  loadDraftFromStorage();
  initFormFields();
  initDatePickers();
  initBankAutocomplete('f_bank', 'f_bank_suggestions');
  initBankAutocomplete('s_bank', 's_bank_suggestions');
  bindEvents();
  syncAllInputsToStateAndPreview();

  setInterval(tickTC, 40);
  tickTC();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
