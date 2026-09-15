/**
 * ODD PIG — Google Sheet tự động cho dự án
 * ============================================================
 * Tool báo giá (oddpig.io.vn/quotation) sẽ POST dữ liệu dự án
 * sang web app này → script tự tạo 1 Google Sheet đúng tên dự án
 * trong thư mục Drive bạn chỉ định, ghi sẵn: tổng quan, thanh toán,
 * lịch quay, deliverable, extra, timeline, change log.
 *
 * ── HƯỚNG DẪN SETUP (làm 1 lần, ~3 phút) ────────────────────
 * 1. Mở https://script.google.com → New project
 * 2. Dán toàn bộ file này vào Code.gs
 * 3. Sửa 2 dòng bên dưới: FOLDER_ID và SECRET
 *    - FOLDER_ID: mở Google Drive, vào thư mục muốn chứa sheet,
 *      copy ID từ thanh địa chỉ
 *      https://drive.google.com/drive/folders/<FOLDER_ID>
 *      (để '' nếu muốn tạo trong root My Drive)
 *    - SECRET: tự nghĩ một chuỗi bất kỳ, phải khớp với token
 *      nhập trong tool (tab Cài đặt)
 * 4. Deploy → New deployment → Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 *    → Authorize (cho phép tạo file trong Drive) → copy URL /exec
 * 5. Dán URL đó vào tool: tab Cài đặt → GOOGLE SHEET & DRIVE
 * 6. Bấm "Kiểm tra kết nối" → mở 1 dự án → sheet tự xuất hiện
 * ============================================================
 */

const FOLDER_ID = '';      // vd: '1AbCdEfGhIjKlMnOpQrStUvWxYz'
const SECRET = 'oddpig-secret';   // đổi thành chuỗi bí mật của bạn

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (SECRET && body.token !== SECRET) return out({ ok: false, error: 'Sai token' });

    let ss;
    if (body.action === 'create') {
      const name = String(body.project && body.project.name || 'Dự án').slice(0, 99);
      ss = SpreadsheetApp.create(name);
      if (FOLDER_ID) {
        DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(FOLDER_ID));
      }
    } else if (body.action === 'sync') {
      if (!body.spreadsheetId) return out({ ok: false, error: 'Thiếu spreadsheetId' });
      ss = SpreadsheetApp.openById(body.spreadsheetId);
    } else {
      return out({ ok: false, error: 'Action không hợp lệ' });
    }

    writeProject(ss, body.project || {});
    return out({ ok: true, spreadsheetId: ss.getId(), url: ss.getUrl() });
  } catch (err) {
    return out({ ok: false, error: String(err && err.message || err) });
  }
}

// GET ?token=... → test kết nối nhanh từ trình duyệt
function doGet(e) {
  const t = (e && e.parameter && e.parameter.token) || '';
  if (SECRET && t !== SECRET) return out({ ok: false, error: 'Sai token' });
  return out({ ok: true, msg: 'ODD PIG Sheet service is live' });
}

function writeProject(ss, p) {
  const total = (p.contract || 0) + (p.extrasApproved || 0);
  const overview = [
    ['ODD PIG — BÁO GIÁ & DỰ ÁN', ''],
    ['Tên dự án', p.name || ''],
    ['Khách hàng', p.client || ''],
    ['Trạng thái', p.status === 'done' ? 'HOÀN THÀNH' : 'ĐANG CHẠY'],
    ['Ngày tạo', p.createdAt || ''],
    ['Cập nhật lần cuối', new Date().toISOString()],
    [],
    ['Hợp đồng', p.contract || 0],
    ['Extra đã duyệt', p.extrasApproved || 0],
    ['Tổng giá trị', total],
    ['Đã thu', p.paid || 0],
    ['Còn lại', total - (p.paid || 0)],
    ['Chi phí thực tế', p.actualCost || ''],
    ['Margin thực (%)', (p.actualMargin === null || p.actualMargin === undefined) ? '' : p.actualMargin],
  ];
  writeSheet(ss, 'TỔNG QUAN', overview, [320, 220]);
  formatMoney(ss, 'TỔNG QUAN', 7, 12, 2);   // B8:B13 — các dòng tiền

  writeSheet(ss, 'THANH TOÁN', [
    ['KHOẢN', 'SỐ TIỀN', 'TRẠNG THÁI', 'NGÀY'],
    ...(p.payments || []).map(x => [x[0], x[1], x[2], x[3]]),
  ], [220, 140, 120, 120]);
  formatMoney(ss, 'THANH TOÁN', 2, Math.max(2, (p.payments || []).length + 1), 2);

  writeSheet(ss, 'LỊCH QUAY', [
    ['NGÀY', 'KHÓA QUAY', 'LOẠI', 'HOÀN THÀNH'],
    ...(p.days || []).map(d => [d[1], d[0], d[2], d[3]]),
  ], [140, 120, 120, 130]);

  writeSheet(ss, 'DELIVERABLE', [
    ['HẠNG MỤC', 'TRẠNG THÁI'],
    ...(p.deliverables || []).map(d => [d[0], d[1]]),
  ], [260, 130]);

  writeSheet(ss, 'EXTRA', [
    ['NỘI DUNG', 'SỐ TIỀN', 'DUYỆT', 'NGÀY'],
    ...(p.extras || []).map(x => [x[0], x[1], x[2], x[3]]),
  ], [260, 140, 130, 120]);
  formatMoney(ss, 'EXTRA', 2, Math.max(2, (p.extras || []).length + 1), 2);

  const tl = (p.timeline || []).slice().sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  writeSheet(ss, 'TIMELINE', [
    ['THỜI GIAN', 'LOẠI', 'NỘI DUNG'],
    ...tl,
  ], [150, 90, 620]);

  const changes = (p.changes || []).slice().sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  writeSheet(ss, 'CHANGE LOG', [
    ['THỜI GIAN', 'NỘI DUNG'],
    ...(changes.length ? changes : [['', 'Chưa có thay đổi scope nào']]),
  ], [150, 660]);

  // dọn sheet mặc định "Sheet1"
  const def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
}

function writeSheet(ss, name, rows, widths) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.clear();
  if (!rows.length) rows = [['(trống)']];
  const cols = Math.max.apply(null, rows.map(r => r.length));
  const padded = rows.map(r => r.concat(Array(cols - r.length).fill('')));
  sh.getRange(1, 1, padded.length, cols).setValues(padded);
  sh.getRange(1, 1, 1, cols).setFontWeight('bold').setBackground('#0b0b0b').setFontColor('#f4f4f4');
  sh.setFrozenRows(1);
  (widths || []).forEach((w, i) => sh.setColumnWidth(i + 1, w));
}

// format cột tiền: cột colIndex, từ dòng rowStart đến rowEnd
function formatMoney(ss, name, colIndex, rowStart, rowEnd) {
  const sh = ss.getSheetByName(name);
  if (!sh || rowEnd < rowStart) return;
  sh.getRange(rowStart, colIndex, rowEnd - rowStart + 1, 1).setNumberFormat('#,##0');
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
