# Flow hệ thống

Tài liệu này mô tả luồng hoạt động của ứng dụng `map-search` — hệ thống tìm đường metro München, kiến trúc **Client–Server 3-tier** với backend **Layered Architecture**.

## Kiến trúc tổng quan

```
[ Trình duyệt — Presentation Tier ]
        ↕ HTTP/JSON + Cookie Session
[ Flask Backend — Business Logic Tier ]
  API → Service → Model/Algorithm
        ↕
[ Data Tier — JSON + SQLite ]
```

---

## Luồng 1: Tìm đường metro (luồng cốt lõi)

### 1. Người dùng tương tác

- Người dùng mở trang bản đồ: `index.html` (khách) hoặc `user.html` (đã đăng nhập).
- Chọn trạm đi / trạm đến bằng cách:
  - nhập tên trạm vào ô tìm kiếm,
  - click trên bản đồ Leaflet,
  - hoặc chọn điểm tùy ý (hệ thống tìm trạm gần nhất + tính đoạn đi bộ qua OSRM).
- Bấm nút tìm đường.

### 2. Frontend nạp dữ liệu đồ thị

- `script.js` gọi `GET /api/graph` (hoặc `/api/stations` + `/api/edges`) khi trang tải.
- Nhận JSON chứa danh sách trạm và cạnh, vẽ mạng lưới metro lên bản đồ Leaflet.
- Nếu admin đã chặn tuyến hoặc đóng trạm, frontend đọc thêm `localStorage` (`metroAdminStateV1`) để hiển thị trạng thái và chặn tìm kiếm qua trạm đóng.

### 3. Frontend gọi API tìm đường

- `script.js` gửi `POST /api/path` với body JSON:
  - `source` — ID hoặc tên trạm đi
  - `target` — ID hoặc tên trạm đến
  - `source_candidates` / `target_candidates` — (tuỳ chọn) danh sách trạm trùng tên
- Request gửi tới backend Flask (mặc định `http://127.0.0.1:5000`).

### 4. Backend nhận yêu cầu API

- `backend/app.py` khởi tạo Flask, CORS, session; đăng ký blueprint `/api`.
- `backend/api/routes.py` nhận request tại `/api/path`:
  - kiểm tra `source` và `target`,
  - resolve tên trạm → danh sách ID (hỗ trợ trạm trùng tên trên nhiều tuyến),
  - gọi `pathfinding_service.find_path()`.

### 5. Service điều phối nghiệp vụ

- `backend/services/pathfinding_service.py`:
  - nạp đồ thị một lần từ `data/stations.json` và `data/edges.json`,
  - dựng `Graph` (`models/graph.py`) và NetworkX graph,
  - tìm tối đa **3 lộ trình** tối ưu (NetworkX `shortest_simple_paths`),
  - chấm điểm theo thời gian di chuyển và số lần chuyển tuyến,
  - trả về `{ "routes": [...] }` với các trường: `path`, `metro_time`, `transfers`, `stops`, `lines`, `score`.

### 6. Thuật toán tìm đường

- **Production:** NetworkX trên graph đã nạp (trong `pathfinding_service.py`).
- **Dự phòng / tham khảo:** `algorithms/dijkstra.py` (Dijkstra tự cài), `algorithms/astar.py` (A* — chưa gắn vào API live).
- Mô hình dữ liệu: `models/station.py`, `models/edge.py`, `models/graph.py`.

### 7. Trả kết quả về frontend

- API trả JSON danh sách route.
- `script.js` nhận kết quả, hiển thị panel chi tiết (thời gian, tuyến U/S, số chuyển tuyến).
- Người dùng có thể chọn, chuyển hoặc xóa từng lộ trình trong danh sách.

### 8. Hiển thị trên bản đồ

- Vẽ polyline tuyến metro lên Leaflet (màu theo tuyến).
- Hiển thị marker trạm đi/đến, popup thông tin trạm.
- Nếu có đoạn đi bộ: vẽ thêm polyline từ OSRM.
- `user_history.js` lưu kết quả vào `localStorage` (tối đa 200 mục, theo username hoặc `anonymous`).

### 9. Sơ đồ mạng lưới (tuỳ chọn)

- Người dùng mở `diagram.html`.
- `diagram.js` tải graph, hiển thị sơ đồ SVG tương tác (pan/zoom, highlight tuyến, tìm trạm).

---

## Luồng 2: Xác thực User

### 1. Đăng ký

- Người dùng mở `signup.html`, nhập họ tên, username, mật khẩu.
- `signup.js` gửi `POST /api/auth/signup`.
- `user.py` hash mật khẩu (PBKDF2-SHA256) và lưu vào SQLite `users.db`.

### 2. Đăng nhập User

- Người dùng mở `login.html`, tab **User**, nhập username hoặc email + mật khẩu.
- `login.js` gửi `POST /api/login` với `role: "user"`.
- Backend xác thực qua SQLite, tạo session (`is_admin = false`), ghi `login_history`.
- Redirect → `user.html`.

### 3. Kiểm tra phiên & đăng xuất

- `GET /api/me` — trả thông tin user hiện tại (username, email, role).
- `auth_link.js` cập nhật link Đăng nhập / Đăng xuất trên header.
- `POST /api/logout` — xóa session, quay về `login.html`.

### 4. Quản lý tài khoản (client-side)

- `user.js` mở modal cài đặt: xem profile qua `/api/me`, đổi email/mật khẩu lưu trong `localStorage` (chưa có API backend tương ứng).

---

## Luồng 3: Xác thực & vận hành Admin

### 1. Đăng nhập Admin

- Tab **Admin** trên `login.html`.
- `POST /api/login` với `role: "admin"`.
- Backend xác thực qua `data/admin.json` (không qua SQLite).
- Session: `is_admin = true` → redirect `admin.html`.
- `admin.html` gọi `verifyAdminSession()` khi tải trang; nếu không phải admin → quay về login.

### 2. Dashboard tổng quan

- Tab **Tổng quan**: thống kê số trạm, tuyến đang hoạt động, số thông báo.
- Dữ liệu graph lấy từ `GET /api/graph`.

### 3. Vận hành hệ thống metro (client-side)

- Tab **Vận hành**: chặn/mở tuyến (U1–U8, S1–S8, S20), đóng/mở trạm, tạo thông báo vận hành.
- Toàn bộ state lưu trong `localStorage` (`metroAdminStateV1`).
- `script.js` trên trang user/index đọc state này → tô đỏ tuyến bị chặn, chặn tìm đường qua trạm đóng.
- **Lưu ý:** backend `/api/path` **chưa** áp dụng trạng thái chặn tuyến — chỉ validate phía client.

### 4. Quản lý người dùng (server-side)

- Tab **Quản lý người dùng**, các API yêu cầu session admin (`@admin_required`):
  - `GET /api/auth/users` — danh sách user
  - `POST /api/auth/users` — thêm user (mật khẩu mặc định `User@123`)
  - `POST /api/auth/users/search` — tìm kiếm/lọc
  - `PUT /api/auth/users/<id>` — sửa họ tên
  - `DELETE /api/auth/users/<id>` — xóa user (không xóa admin)
  - `GET /api/auth/login-history` — lịch sử đăng nhập toàn hệ thống
  - `GET /api/auth/user-history/<username>` — lịch sử theo user

---

## Tóm tắt luồng chính

1. User mở `index.html` hoặc `user.html`.
2. Frontend tải graph qua `GET /api/graph`.
3. User chọn trạm đi/đến → `POST /api/path`.
4. `pathfinding_service.py` tính top 3 route bằng NetworkX.
5. Frontend vẽ lộ trình lên Leaflet và lưu lịch sử.
6. Admin đăng nhập → quản lý vận hành (localStorage) và user (SQLite qua API).
