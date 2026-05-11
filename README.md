# 🗺️ Map Search - Hệ Thống Tìm Đường Metro

Dự án `map-search` là một ứng dụng tìm đường tối ưu cho hệ thống metro, với backend Python và frontend tương tác bằng HTML/CSS/JavaScript.
## 👥 Thành viên nhóm

- Nguyễn Đức Thiện MSSV: 202416356  
- Lê Trần Mạnh Tiến MSSV: 202416620  
- Nguyễn Hoàng Hải MSSV: 202416479  
- Nguyễn Đăng Khôi MSSV: 202416535  
- Nguyễn Bá Bắc MSSV: 202416420  
- Nguyễn Thành Kiên MSSV: 202416540  

## ✅ Mục tiêu
- Tìm đường ngắn nhất giữa hai trạm
- So sánh hai thuật toán: Dijkstra và A*
- Hiển thị kết quả trực quan trên bản đồ
- Hỗ trợ quản lý dữ liệu và giao diện admin cơ bản

## 🚀 Tính năng chính

### Người dùng
- Tìm đường giữa hai trạm bằng tên nguồn và đích
- Chọn thuật toán Dijkstra hoặc A*
- Hiển thị lộ trình, tổng khoảng cách, số điểm qua, và chi tiết từng bước
- Vẽ đường đi lên bản đồ với màu sắc và thông tin tương tác

### Admin
- Đăng nhập admin và truy cập trang quản lý
- Quản lý trạng thái tuyến đường, cập nhật dữ liệu (nếu được triển khai)
- Lưu trạng thái quản trị trong `data/admin.json`

## 📁 Cấu trúc thư mục
   Xem file doc/Root.md

## 🔧 Yêu cầu cài đặt
- Python 3.8+
- Git
- Trình duyệt web

## 📌 Hướng dẫn chạy nhanh
1. Tạo môi trường ảo: `python -m venv venv`
2. Kích hoạt: `venv\Scripts\activate`
3. Cài dependencies: `pip install -r requirements.txt`
4. Chạy backend: `cd backend && python app.py`
5. Mở frontend:
   - `python -m http.server 5500` từ thư mục gốc, sau đó truy cập `http://127.0.0.1:5500/frontend/html/index.html`
   - hoặc mở `frontend/html/index.html` bằng Live Server

## 📡 API chính
- `POST /api/path`: tìm đường giữa `source` và `target`
- `GET /api/graph`: trả dữ liệu graph JSON
- `POST /api/login`: đăng nhập admin
- `GET /api/me`: kiểm tra session admin
- `POST /api/logout`: đăng xuất

## 💡 Lưu ý
- Backend hiện đang cấu hình CORS cho origin `http://127.0.0.1:5500`
- Nếu truy cập frontend từ địa chỉ khác, cần chỉnh `backend/app.py`
- `start_app.bat` là lựa chọn khởi động nhanh cho Windows

## 🛠️ Ghi chú nhóm
- Thành viên nhóm: Nguyễn Đức Thiện, Lê Trần Mạnh Tiến, Nguyễn Hoàng Hải, Nguyễn Đăng Khôi, Nguyễn Bá Bắc, Nguyễn Thành Kiên

