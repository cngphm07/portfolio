# Portfolio V2 — Monochrome Cinema (`/new/`)

Version 2 của portfolio, **tách biệt hoàn toàn** với trang cũ (vẫn ở root).
Preview: `https://oddpig.io.vn/new/` (deploy tự động theo `deploy.yml` hiện có) — local: `node server.js` rồi mở `http://localhost:8080/new/`.

## Kiến trúc
- Không build step, deploy thẳng file tĩnh như v1.
- Dùng chung `data.js` do CI sync từ Google Drive — load bằng đường dẫn tuyệt đối `/data.js` nên chạy đúng ở cả `/new/` và root.
- Thư viện qua CDN: GSAP 3 + ScrollTrigger + SplitText, Lenis 1.x. Nếu CDN chặn, site vẫn mở đầy đủ (không animation).
- Hero: WebGL scene tự viết (`js/hero.js`) — chữ DOM căn trái sắc nét + minh họa **globe plexus holographic** bên phải (640 node cầu fibonacci, ~1.9k cạnh nearest-neighbour, 4 vòng quỹ đạo nghiêng), nền silk streams + dust; xoay chậm, nghiêng theo chuột. Không WebGL / reduced-motion → bỏ canvas, chữ vẫn hiển thị.

## Files
```
new/
├── index.html      # khung + sections
├── css/style.css   # design system monochrome
└── js/
    ├── hero.js     # WebGL particle field (self-contained)
    ├── motion.js   # Lenis + GSAP reveals/marquee/cursor/counters
    ├── gallery.js  # filter + grid + lightbox (logic từ v1)
    └── main.js     # boot + preloader + cursor init
```

## Chuyển lên trang chủ (khi ưng ý)
1. Dời `index.html` + `css/` + `js/` từ `new/` ra root (thay `index.html` cũ; giữ bản cũ trong `legacy/` nếu muốn).
2. Bỏ thẻ `<meta name="robots" content="noindex, nofollow">` trong `index.html`.
3. Không cần sửa workflow — data.js vẫn ở root.

Lưu ý: meta `noindex` đang bật để Google không index trùng nội dung với trang chủ.
