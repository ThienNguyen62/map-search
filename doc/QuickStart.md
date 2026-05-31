# 🚀 Quick Start

Hướng dẫn nhanh để cài đặt, chạy và truy cập ứng dụng `map-search` trên máy Windows.

## 📋 Yêu cầu

- Python 3.8 hoặc mới hơn
- Git
- Trình duyệt web hiện đại (Chrome, Edge, Firefox)

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

## 4. Chạy ứng dụng

### Cách A: Khởi động nhanh (khuyến nghị — Windows)

Chạy file `start_app.bat` từ thư mục gốc:

- Khởi động Flask backend trên cổng **5000**
- Tự mở trình duyệt tại `http://127.0.0.1:5000/html/login.html`

### Cách B: Chạy thủ công

```bash
cd backend
python app.py
```

Backend chạy tại `http://127.0.0.1:5000` và **đồng thời phục vụ file frontend** (HTML/CSS/JS).

## 5. Truy cập các trang

| Trang | URL |
|-------|-----|
| Đăng nhập (User + Admin) | `http://127.0.0.1:5000/html/login.html` |
| Đăng ký | `http://127.0.0.1:5000/html/signup.html` |
| Bản đồ (khách) | `http://127.0.0.1:5000/html/index.html` |
| Bản đồ (User đã đăng nhập) | `http://127.0.0.1:5000/user.html` |
| Admin dashboard | `http://127.0.0.1:5000/admin.html` |
| Sơ đồ mạng lưới metro | `http://127.0.0.1:5000/html/diagram.html` |

## 6. Tài khoản mặc định

### Admin

Đăng nhập qua tab **Admin** trên trang login. Tài khoản lưu trong `data/admin.json`, ví dụ:

- Username: `admin` — Password: `admin123`
- Username: `admin2` — Password: `Admin@123`

### User

- Đăng ký tài khoản mới tại `signup.html`, hoặc
- Admin tạo user qua dashboard (mật khẩu mặc định: `User@123`)

## 7. Chạy frontend riêng (tuỳ chọn)

Nếu muốn mở frontend qua HTTP server cổng 5500 (Live Server hoặc `python -m http.server`):

```bash
python -m http.server 5500
```

Truy cập: `http://127.0.0.1:5500/frontend/html/index.html`

> Backend đã cấu hình CORS cho cả `:5000` và `:5500`. Đảm bảo backend vẫn đang chạy khi dùng cách này.

## 8. API chính

### Tìm đường & dữ liệu (public)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/path` | Tìm đường giữa `source` và `target` |
| GET | `/api/graph` | Lấy toàn bộ đồ thị (stations + edges) |
| GET | `/api/stations` | Danh sách trạm |
| GET | `/api/edges` | Danh sách cạnh/tuyến |

### Xác thực

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/auth/signup` | Đăng ký user mới |
| POST | `/api/login` | Đăng nhập (User hoặc Admin) |
| GET | `/api/me` | Thông tin phiên hiện tại |
| POST | `/api/logout` | Đăng xuất |

### Quản lý user (Admin only)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET/POST | `/api/auth/users` | Liệt kê / thêm user |
| POST | `/api/auth/users/search` | Tìm kiếm user |
| PUT | `/api/auth/users/<id>` | Cập nhật user |
| DELETE | `/api/auth/users/<id>` | Xóa user |
| GET | `/api/auth/login-history` | Lịch sử đăng nhập |
| GET | `/api/auth/user-history/<username>` | Lịch sử theo user |

## 9. Các lỗi thường gặp

- **Frontend không gọi được API:** kiểm tra backend đang chạy tại cổng 5000; xem cấu hình CORS trong `backend/app.py`.
- **Admin bị redirect về login:** đảm bảo đăng nhập qua tab Admin và cookie session không bị chặn.
- **Lỗi cài gói Python:** thử `pip install --upgrade pip` rồi cài lại `requirements.txt`.
- **Không tìm thấy trạm:** kiểm tra `data/stations.json` và `data/edges.json` tồn tại.

## 10. Dừng ứng dụng

- Dừng backend bằng `Ctrl + C` trong terminal chạy Flask.
- Nếu dùng HTTP server riêng (cổng 5500), dừng bằng `Ctrl + C` tương tự.
