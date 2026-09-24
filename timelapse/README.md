# CNGPHM Timelapse

Landing page tĩnh cho dịch vụ timelapse dài hạn, xuất bản tại `https://oddpig.io.vn/timelapse/`.

## Chạy thử

Dùng một static server từ thư mục gốc repository. Không dùng `node server.js` nếu không muốn đồng bộ và ghi lại `data.js` của portfolio.

Ví dụ với Python:

```bash
python -m http.server 8081
```

Sau đó mở `http://localhost:8081/timelapse/`.

## Cấu hình liên hệ

Mở `js/contact-config.js`:

- `formEndpoint`: URL Formspree hoặc Google Apps Script. Để trống thì form tạo email đã điền sẵn.
- `bookingUrl`: URL Calendly hoặc trang đặt lịch. Để trống thì nút đặt lịch chuyển sang email.
- `email`: địa chỉ nhận brief dự án.

## Thay media

Các file media nằm trong `assets/media/`. Giữ nguyên tên file để thay trực tiếp mà không sửa HTML, hoặc cập nhật các đường dẫn trong `index.html`.

- `maritime-shipbuilding-hero.mp4`
- `maritime-shipbuilding-hero.webp`
- `construction-hangar-progress.webp`
- `industrial-facility-aerial.webp`
- `ship-dry-dock-aerial.webp`

Ảnh stock trong bản đầu chỉ là hình minh họa. Khi có tư liệu dự án thật, cập nhật ảnh, `alt`, Open Graph image và ghi nguồn/quyền sử dụng trong `assets/media/SOURCES.md`.

## Lưu ý nội dung

Không thêm số dự án, khách hàng, testimonial, chứng nhận hay thông số bảo vệ thiết bị nếu chưa có bằng chứng xác thực. Cấu hình kỹ thuật phải được mô tả là phương án được lựa chọn theo điều kiện từng dự án.
