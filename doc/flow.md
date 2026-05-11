# Flow hệ thống

Tài liệu này mô tả luồng chính của ứng dụng `map-search`, từ tương tác người dùng đến kết quả tìm đường hiển thị trên bản đồ.

## 1. Người dùng tương tác

- Người dùng mở trang `index.html` trên frontend.
- Người dùng chọn điểm bắt đầu và điểm đến trên bản đồ hoặc nhập trực tiếp.
- Người dùng kích hoạt tìm đường (click nút tìm đường).

## 2. Frontend xử lý và gọi API

- JavaScript frontend (`script.js`) thu thập tọa độ, lựa chọn thuật toán và các tham số cần thiết.
- Frontend gửi yêu cầu HTTP đến backend qua endpoint `/api/path`.
- Yêu cầu thường là `POST` kèm dữ liệu JSON:
  - `start` (tọa độ hoặc node id)
  - `end` (tọa độ hoặc node id)
  - `algorithm` (`dijkstra` hoặc `astar`)

## 3. Backend nhận yêu cầu API

- `backend/app.py` khởi tạo ứng dụng và đăng ký các route.
- `backend/api/routes.py` định nghĩa endpoint API.
- Khi `/api/path` được gọi, route sẽ:
  - kiểm tra dữ liệu yêu cầu,
  - gọi service tìm đường tương ứng,
  - trả về kết quả dưới dạng JSON.

## 4. Service điều phối nghiệp vụ

- `backend/services/pathfinding_service.py` chịu trách nhiệm:
  - nạp dữ liệu đồ thị từ `data/edges.json` và `data/stations.json`,
  - dựng đối tượng Graph từ `backend/models/graph.py`,
  - tìm đường bằng thuật toán được chọn,
  - tính toán chi phí, tổng khoảng cách, số điểm đi qua,
  - format kết quả trả về.

## 5. Thuật toán tìm đường

- Thư mục `backend/algorithms/` chứa các thuật toán:
  - `dijkstra.py`: thuật toán Dijkstra để tìm đường ngắn nhất.
  - `astar.py`: thuật toán A* với heuristic để tìm đường nhanh hơn.
- Thuật toán dùng dữ liệu graph và các node/edge từ `backend/models/`.
- Kết quả thu được là danh sách cạnh/node theo thứ tự đi qua và tổng chi phí.

## 6. Mô hình dữ liệu và cấu trúc đồ thị

- `backend/models/graph.py` định nghĩa Graph, node, edge và các hàm truy vấn.
- `backend/models/station.py` định nghĩa thông tin trạm.
- `backend/models/edge.py` định nghĩa cạnh/tuyến đường nối giữa các trạm.
- Dữ liệu đầu vào chính nằm trong:
  - `data/stations.json`
  - `data/edges.json`

## 7. Trả kết quả về frontend

- `backend/api/routes.py` nhận kết quả từ service và trả JSON:
  - danh sách điểm đi qua,
  - tổng khoảng cách,
  - hướng dẫn chi tiết,
  - trạng thái tuyến đường nếu có.
- Frontend nhận JSON trong `script.js`.

## 8. Hiển thị kết quả trên bản đồ

- Frontend xử lý dữ liệu trả về, vẽ đường đi bằng Leaflet.
- Hiển thị:
  - tuyến đường trên bản đồ,
  - thông tin chi tiết kết quả,
  - các điểm bắt đầu/kết thúc,
  - trạng thái tuyến đường (màu sắc, hover, click).

## 9. Luồng admin và cập nhật dữ liệu

- Trang `frontend/html/admin.html` dùng để quản lý dữ liệu.
- Backend có thể xử lý cập nhật dữ liệu admin qua API (nếu triển khai).
- Dữ liệu admin lưu trong `data/admin.json` và có thể ảnh hưởng trạng thái tuyến đường.

## 10. Luồng dữ liệu thô và tiền xử lý

- Thư mục `data/file raw/` chứa dữ liệu GTFS thô và công cụ lọc:
  - `filter_metro_routes.py`
  - `generate_metro_graph.py`
- Dữ liệu thô có thể chuyển đổi thành `data/stations.json` và `data/edges.json` để sử dụng trong hệ thống.

---

### Tóm tắt luồng chính

1. Người dùng tương tác với `frontend/html/index.html`.
2. Frontend gửi yêu cầu tới `backend/api/routes.py`.
3. Service xử lý logic tìm đường (`backend/services/pathfinding_service.py`).
4. Thuật toán tìm đường (`backend/algorithms/*.py`) chạy trên graph.
5. Kết quả được trả về frontend.
6. Frontend hiển thị đường đi lên bản đồ Leaflet.

