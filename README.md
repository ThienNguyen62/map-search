# 🗺️ Hệ Thống Tìm Đường Tối ưu Cho Hệ Thống Metro Munich - Munich Metro Transit Route Finder

Chương trình cho phép tìm kiếm đường đi tối ưu nhất và mô phỏng các tình huống đời thực.

---

## 👥 Thành viên nhóm

- Nguyễn Đức Thiện MSSV: 202416356  
- Lê Trần Mạnh Tiến MSSV: 202416620  
- Nguyễn Hoàng Hải MSSV: 202416479  
- Nguyễn Đăng Khôi MSSV: 202416535  
- Nguyễn Bá Bắc MSSV: 202416420  
- Nguyễn Thành Kiên MSSV: 202416540  

---

## 🚀 Tính năng

### 👤 Người dùng

- Tìm đường tối ưu giữa 2 điểm bất kỳ  
- Hỗ trợ 2 thuật toán: Dijkstra, A*  
- Nhập tọa độ hoặc chọn điểm trực tiếp trên bản đồ  
- Hiển thị kết quả chi tiết:
  - Tổng khoảng cách (bao gồm khoảng cách từ điểm chọn đến node gần nhất)  
  - Số lượng node đi qua  
  - Đường đi chi tiết (node → node → node...)  
- Xem trạng thái đường trên bản đồ theo màu sắc  
- Thông tin chi tiết khi hover/click vào đường  

---

### 🛠️ Admin

- Quản lý dữ liệu tuyến đường  
- Cập nhật trạng thái đường (tắc, ngập, một chiều...)  
- Thêm / sửa / xóa node và edge  

---

## 🗂️ Cấu trúc dự án
project-root/
│
├── backend/                  # Python core (não hệ thống)
│   ├── app.py                # Entry point (Flask/FastAPI)
│   ├── api/                  # API endpoints
│   │   └── routes.py
│   ├── services/             # Business logic
│   │   └── pathfinding_service.py
│   ├── algorithms/           # Thuật toán AI
│   │   ├── dijkstra.py
│   │   └── astar.py
│   ├── models/               # Data model
│   │   ├── graph.py
│   │   ├── station.py
│   │   └── edge.py
│   ├── repositories/         # Data access
│   │   └── data_loader.py
│   └── utils/                # Helper functions
│
├── frontend/                 # UI + Leaflet
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── map.js           # Leaflet map
│   │   ├── api.js           # gọi backend
│   │   └── ui.js            # xử lý UI
│
├── data/                     # dữ liệu hệ thống
│   ├── stations.json
│   ├── edges.json
│   └── scenarios.json
│
├── docs/                     # tài liệu
│   ├── architecture.md
│   ├── usecase.md
│   └── api.md
│
├── tests/                    # test
│   ├── test_dijkstra.py
│   └── test_api.py
│
├── requirements.txt
├── README.md
└── .gitignore
