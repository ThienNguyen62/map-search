# Root Documentation

Đây là tài liệu mô tả cấu trúc thư mục và chức năng chính của dự án `map-search` phiên bản mới nhất.

project-root/
│
├── backend/                  # Phần lõi Python xử lý logic tìm đường và API
│   ├── app.py                # Điểm vào chính của ứng dụng backend
│   ├── api/                  # Định nghĩa endpoint API để frontend gọi
│   │   └── routes.py         # Các route API (tìm đường, lấy dữ liệu, quản lý người dùng...)
│   ├── services/             # Xử lý nghiệp vụ và điều phối các thành phần
│   │   ├── pathfinding_service.py  # Logic tìm đường, gọi thuật toán, chuẩn hóa kết quả
│   │   └── user.py           # Xử lý thông tin người dùng và xác thực nếu có
│   ├── algorithms/           # Bộ thuật toán đường đi
│   │   ├── dijkstra.py       # Cài đặt thuật toán Dijkstra tìm đường ngắn nhất
│   │   ├── astar.py          # Cài đặt thuật toán A* tìm đường với heuristic
│   │   └── testresult.md     # Ghi chú kết quả kiểm thử các thuật toán (nội bộ)
│   ├── models/               # Định nghĩa cấu trúc dữ liệu trong hệ thống
│   │   ├── graph.py          # Lớp Graph, nạp/mô tả đồ thị
│   │   ├── station.py        # Lớp Station đại diện trạm/metropole
│   │   ├── edge.py           # Lớp Edge đại diện cạnh/tuyến nối giữa các trạm
│   │   └── __init__.py       # Khởi tạo package models
│   ├── __init__.py           # Khởi tạo package backend
│
├── frontend/                 # Giao diện người dùng web
│   ├── html/                 # Các trang HTML giao diện chính
│   │   ├── index.html        # Trang tìm đường chung
│   │   ├── login.html        # Trang đăng nhập người dùng
│   │   └── admin.html        # Trang quản lý admin/duyệt dữ liệu
│   ├── css/                  # Stylesheet dành cho frontend
│   │   ├── style.css         # CSS giao diện chính
│   │   ├── admin.css         # CSS riêng cho trang admin
│   │   ├── login.css         # CSS cho trang đăng nhập
│   │   └── marker-animations.css  # Hiệu ứng marker trên bản đồ
│   ├── js/                   # JavaScript điều khiển UI và gọi API
│   │   ├── script.js         # Logic tìm đường, tương tác bản đồ, xử lý kết quả
│   │   ├── login.js          # Xử lý đăng nhập, xác thực người dùng
│   │   ├── signup.js         # Xử lý đăng ký tài khoản
│   └── py/                   # Script Python hỗ trợ chỉnh sửa frontend/dữ liệu
│       ├── add_css_link.py   # Thêm link CSS vào file HTML tự động
│       ├── fix_markers.py    # Sửa tọa độ marker hoặc metadata cho bản đồ
│       ├── update_markers.py # Cập nhật danh sách marker
│       └── update_select_station.py  # Cập nhật lựa chọn trạm trong frontend
│
├── data/                     # Dữ liệu đầu vào và dữ liệu hỗ trợ
│   ├── stations.json         # Dữ liệu trạm hiện tại dùng cho hệ thống
│   ├── edges.json            # Dữ liệu cạnh/tuyến đường giữa trạm
│   ├── admin.json            # Dữ liệu cấu hình/quyền admin
│   ├── file data cũ/         # Dữ liệu cũ/backup của hệ thống
│   │   ├── Stations(new).json
│   │   ├── edges(new).json
│   │   └── metro_graph.json
│   └── file raw/             # Dữ liệu thô và công cụ tiền xử lý
│       ├── gesamt_gtfs/      # Dữ liệu GTFS thô của metro
│       └── tool lọc/         # Script lọc/generate dữ liệu metro
│           ├── filter_metro_routes.py
│           └── generate_metro_graph.py
│
├── doc/                      # Tài liệu dự án
│   ├── Root.md               # Tài liệu cấu trúc chính của project
│   ├── QuickStart.md         # Hướng dẫn chạy nhanh
│   ├── Setup.md              # Hướng dẫn cài đặt môi trường
│   ├── Contributing.md       # Hướng dẫn đóng góp
│   ├── flow.md               # Mô tả flow của dự án
│   ├── daily.md              # Nhật ký công việc/hàng ngày
│   └── task.md               # Mô tả nhiệm vụ và phân công
│
├── requirements.txt         # Danh sách package Python cần cài
├── start_app.bat            # Script Windows để chạy ứng dụng nhanh
├── detection_pipeline.tex   # Tài liệu/tiểu luận mô tả pipeline phát hiện (nếu cần)
└── README.md                # Giới thiệu dự án và tính năng chính
