# 🐷 Odd Pig — Tool Báo giá & Quản lý Dự án

Tool nội bộ cho studio sản xuất video/marketing. **Chỉ nhập số → tự tính. Không cần AI, không tốn token.**

## Cách mở

**Cách 1 (đơn giản nhất):** double-click vào `index.html` — mở bằng Chrome/Edge, dùng được ngay.

**Cách 2 (nếu muốn chạy như 1 trang web):**
```bash
node -e "const http=require('http'),fs=require('fs'),path=require('path');const root=__dirname;const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css'};http.createServer((req,res)=>{let p=req.url.split('?')[0];if(p==='/')p='/index.html';fs.readFile(path.join(root,p),(e,d)=>{if(e){res.writeHead(404);res.end();return}res.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream'});res.end(d)})}).listen(8080)"
```
→ mở `http://localhost:8080`

## 3 tab chính

### 🧾 Báo giá (Calculator)
- **Loại job**: ô điền **tự do** — gõ gì cũng được (TVC, Social, Marketing Campaign, TVC 30s...). Bên dưới có **preset nhanh** để điền sẵn số liệu, chọn xong chỉnh tự do.
- **Quay**: số ngày, số camera, bật/tắt âm thanh & flycam.
- **Dựng**: tổng phút video dài + số short.
- **Đơn giá**: mở panel "⚙️ Đơn giá" để chỉnh đơn giá từng loại (gõ nhanh `2tr` = 2,000,000; `500k` = 500,000).
- **Kết quả**: COST → GIÁ BÁN ĐỀ XUẤT (cost ÷ (1 − margin)) → GIÁ SÀN (giá đề xuất × 0.9).
- **🔴 Khách trả giá**: nhập giá khách trả (vd `15tr`) → tool báo margin còn bao nhiêu, cảnh báo nếu dưới 30%, và **đề xuất giảm scope** (bỏ flycam, bớt ngày quay, bớt short...) — mỗi gợi ý có nút **Áp dụng** để thử ngay.
- **📋 Copy bảng báo giá**: copy dạng text gọn để gửi Zalo/email.
- **➕ Tạo dự án từ báo giá**: chuyển báo giá thành dự án, giữ nguyên breakdown làm Original Scope.

### 📁 Dự án (Project Manager)
Mỗi dự án có:
- **Hợp đồng + thanh toán**: Deposit / Final (hoặc thêm khoản tùy ý), tick "Đã nhận" có ngày.
- **Lịch quay**: tick từng ngày hoàn thành; ngày vượt cam kết tự dán nhãn **EXTRA**.
- **Deliverable**: checklist bàn giao.
- **Chi phí phát sinh (Extra)**: thêm mục + số tiền, tick "Duyệt" để tính vào tổng giá trị.
- **Tổng giá trị** = hợp đồng + extra đã duyệt. Nhập **chi phí thực tế** để xem margin thực sau job.
- **📜 Original Scope**: snapshot những gì khách mua ban đầu — khách hỏi *"cái này nằm trong gói ban đầu mà?"* là mở cái này ra.
- **🕘 Change Log**: lịch sử từng thay đổi scope, có ngày giờ + số tiền (thêm ngày EXTRA, thêm extra, đổi hợp đồng...). Mọi thay đổi scope đều **tự động** được ghi.
- **Timeline**: toàn bộ diễn biến dự án theo thời gian, có thể thêm ghi chú.

### ⚙️ Cài đặt
- Margin mặc định / margin tối thiểu / % giá sàn.
- **Quản lý loại job & preset**: thêm/sửa/xóa tùy ý (TVC, Marketing Campaign...), chỉnh số ngày/cam/phút/short mặc định của từng loại.
- Export backup ra file `.json` (nên làm định kỳ), Import để phục hồi.
- Xóa toàn bộ dữ liệu / nạp lại dự án mẫu.

## Deploy

Tool dùng tại **https://oddpig.io.vn/quotation** — deploy bằng cách copy thư mục tool vào `quotation/` trong repo portfolio (github.com/cngphm07/portfolio) và push; GitHub Actions tự lên production.

## 📄 Google Sheet tự động cho mỗi dự án

Khi tạo dự án mới (hoặc bấm "Sync sheet" trong chi tiết dự án), tool gửi dữ liệu sang một Google Apps Script → tự tạo **Google Sheet đúng tên dự án** trong thư mục Drive của bạn, gồm các tab: TỔNG QUAN, THANH TOÁN, LỊCH QUAY, DELIVERABLE, EXTRA, TIMELINE, CHANGE LOG. Dự án có thay đổi thì bấm **Sync sheet** để cập nhật.

**Setup 1 lần (~3 phút):**
1. Mở [script.google.com](https://script.google.com) → New project → dán nội dung file [`google-apps-script/Code.gs`](google-apps-script/Code.gs)
2. Sửa `FOLDER_ID` (thư mục Drive sẽ chứa sheet — lấy ID từ URL của folder) và `SECRET` (chuỗi bí mật tự đặt)
3. Deploy → New deployment → **Web app** → Execute as: **Me** / Who has access: **Anyone** → authorize → copy URL `/exec`
4. Vào tool → **Cài đặt → GOOGLE SHEET & DRIVE** → dán URL + token (trùng SECRET) → **Kiểm tra kết nối**
5. Tạo thử 1 dự án → sheet xuất hiện trong Drive, nút **Google Sheet ↗** ngay ở đầu trang chi tiết dự án

## Lưu trữ dữ liệu
Dữ liệu nằm trong **localStorage của trình duyệt** trên máy bạn — không gửi đi đâu cả. Rủi ro duy nhất: xóa dữ liệu trình duyệt sẽ mất hết → hãy **Export backup** thường xuyên. File backup import được lại bất cứ lúc nào.

## Công thức
```
Cost        = Nhân sự + Thiết bị + Di chuyển + Dựng
Giá bán     = Cost ÷ (1 − Margin)        // margin tính trên giá bán
Giá sàn     = Giá bán × (1 − 10%)
Margin thực = (Giá chốt − Cost) ÷ Giá chốt
```

## Dự án mẫu
Lần đầu mở sẽ có sẵn dự án **ABC Showroom** (hợp đồng 32M, 4 ngày cam kết + Day 5 EXTRA, extra interview +2M...) để xem cách Original Scope & Change Log hoạt động. Có thể xóa bất kỳ lúc nào.
