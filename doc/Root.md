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