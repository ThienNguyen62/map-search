# Root Documentation

Tài liệu mô tả cấu trúc thư mục và chức năng chính của dự án `map-search`.

**Kiến trúc:** Client–Server 3-tier, backend Layered (API → Service → Model/Algorithm → Data), monolithic Flask.

```
project-root/
│
├── backend/                  # Backend Python — API, nghiệp vụ, thuật toán
│   ├── app.py                # Entry point Flask: auth, CORS, session, serve static
│   ├── users.db              # SQLite — tài khoản user, lịch sử đăng nhập
│   ├── api/
│   │   └── routes.py         # API tìm đường, stations, edges, graph
│   ├── services/
│   │   ├── pathfinding_service.py  # Nạp graph, NetworkX, trả top 3 route
│   │   └── user.py           # CRUD user, hash password, login history
│   ├── algorithms/
│   │   ├── dijkstra.py       # Dijkstra (fallback / tham khảo)
│   │   ├── astar.py          # A* (chưa gắn API live)
│   │   └── testresult.md     # Ghi chú kết quả kiểm thử thuật toán
│   └── models/
│       ├── graph.py          # Lớp Graph, nạp JSON, truy vấn trạm
│       ├── station.py        # Lớp Station
│       └── edge.py           # Lớp Edge
│
├── frontend/                 # Giao diện web (HTML/CSS/JS + Leaflet)
│   ├── html/
│   │   ├── login.html        # Đăng nhập User / Admin (2 tab)
│   │   ├── signup.html       # Đăng ký tài khoản User
│   │   ├── index.html        # Bản đồ tìm đường (khách)
│   │   ├── user.html         # Bản đồ + tài khoản (User đã đăng nhập)
│   │   ├── admin.html        # Dashboard quản trị
│   │   └── diagram.html      # Sơ đồ mạng lưới metro (SVG)
│   ├── css/
│   │   ├── style.css         # CSS giao diện chính / bản đồ
│   │   ├── login.css         # CSS trang đăng nhập / đăng ký
│   │   ├── diagram.css       # CSS sơ đồ mạng lưới
│   │   ├── user-history.css  # CSS panel lịch sử tìm kiếm
│   │   └── marker-animations.css  # Hiệu ứng marker trên bản đồ
│   ├── js/
│   │   ├── script.js         # Leaflet map, tìm đường, multi-route, OSRM
│   │   ├── login.js          # Form đăng nhập
│   │   ├── signup.js         # Form đăng ký
│   │   ├── auth_link.js      # Link đăng nhập/đăng xuất trên header
│   │   ├── user.js           # Menu cài đặt tài khoản
│   │   ├── user_history.js   # Lưu / hiển thị lịch sử tìm kiếm
│   │   └── diagram.js        # Sơ đồ SVG tương tác
│   └── py/                   # Script Python hỗ trợ chỉnh sửa frontend/dữ liệu
│       ├── add_css_link.py
│       ├── fix_markers.py
│       ├── update_markers.py
│       └── update_select_station.py
│
├── data/                     # Dữ liệu hệ thống
│   ├── stations.json         # Danh sách trạm metro (id, tên, tọa độ, tuyến)
│   ├── edges.json            # Cạnh nối giữa trạm (from, to, time, line)
│   └── admin.json            # Tài khoản đăng nhập Admin
│
├── doc/                      # Tài liệu dự án
│   ├── Root.md               # Cấu trúc thư mục (file này)
│   ├── QuickStart.md         # Hướng dẫn chạy nhanh
│   ├── Setup.md              # Hướng dẫn cài đặt môi trường
│   ├── Contributing.md       # Hướng dẫn đóng góp
│   ├── flow.md               # Luồng hoạt động hệ thống
│   ├── daily.md              # Nhật ký công việc
│   └── task.md               # Nhiệm vụ và phân công
│
├── requirements.txt          # Dependencies Python
├── start_app.bat             # Khởi động nhanh trên Windows
└── README.md                 # Giới thiệu dự án
```

## Mô tả nhanh từng phần

| Thư mục / file | Vai trò |
|----------------|---------|
| `backend/app.py` | Flask app: route auth, admin API, phục vụ frontend static |
| `backend/api/routes.py` | REST API: `/path`, `/stations`, `/edges`, `/graph` |
| `backend/services/` | Logic nghiệp vụ tách khỏi HTTP layer |
| `backend/models/` + `algorithms/` | Đồ thị metro và thuật toán tìm đường |
| `backend/users.db` | Lưu user và login history (SQLite) |
| `frontend/html/` | Các trang web theo vai trò User / Admin / Guest |
| `frontend/js/script.js` | Core: bản đồ, gọi API, hiển thị route |
| `data/stations.json` | Nguồn dữ liệu trạm cho pathfinding |
| `data/edges.json` | Nguồn dữ liệu tuyến nối giữa trạm |
| `data/admin.json` | Xác thực Admin khi đăng nhập |
