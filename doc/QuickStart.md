# 🚀 Quick Start

Hướng dẫn nhanh để cài đặt, chạy và truy cập ứng dụng `map-search` trên máy Windows.

## 📋 Yêu cầu
- Python 3.8 hoặc mới hơn
- Git
- Trình duyệt web hiện đại (Chrome, Edge, Firefox)
- (Tuỳ chọn) Live Server hoặc HTTP server để mở frontend tĩnh

## 1. Clone repository
```bash
git clone <repository-url>
cd map-search
```

## 2. Tạo và kích hoạt môi trường ảo
```bash
python -m venv venv
venv\Scripts\activate
```

## 3. Cài đặt phụ thuộc
```bash
pip install -r requirements.txt
```

## 4. Chạy backend
```bash
cd backend
python app.py
```

> Mặc định backend sẽ chạy trên `http://127.0.0.1:5000`.

## 5. Chạy frontend
### Cách A: Dùng trình duyệt tĩnh
Mở file:
- `frontend/html/index.html` để vào trang tìm đường
- `frontend/html/login.html` để đăng nhập admin

### Cách B: Dùng HTTP server tại cổng 5500
Từ thư mục gốc của repo:
```bash
python -m http.server 5500
```
Mở trình duyệt tại:
```text
http://127.0.0.1:5500/frontend/html/index.html
```

> Lưu ý: `backend/app.py` hiện tại cho phép CORS từ `http://127.0.0.1:5500`, nên tốt nhất truy cập frontend qua địa chỉ này.

## 6. Truy cập ứng dụng
- Trang chính: `http://127.0.0.1:5500/frontend/html/index.html`
- Trang admin: `http://127.0.0.1:5500/frontend/html/login.html`

## 7. Khởi động nhanh trên Windows
Nếu dùng Windows, bạn có thể chạy `start_app.bat` để:
- khởi động backend
- mở trình duyệt đến frontend

## 8. API chính
- `POST /api/path` — Tìm đường giữa `source` và `target`
- `GET /api/graph` — Lấy dữ liệu graph hiện tại
- `POST /api/login` — Đăng nhập admin
- `GET /api/me` — Kiểm tra session admin
- `POST /api/logout` — Đăng xuất

## 9. Các lỗi thường gặp
- Nếu frontend không kết nối được backend: kiểm tra `backend/app.py` và origin CORS
- Nếu gặp lỗi cài gói: thử `pip install --upgrade pip` rồi cài lại
- Nếu không chạy được Python: kiểm tra lại Python đã thêm vào PATH

## 10. Dừng ứng dụng
- Dừng backend bằng `Ctrl + C` trong terminal chạy Flask
- Dừng HTTP server bằng `Ctrl + C` nếu dùng `python -m http.server`
