# gọi thuật toán và xử lí logic
# backend/services/pathfinding_service.py

import os
import json
import networkx as nx
from algorithms.dijkstra import dijkstra
from models.graph import Graph
from models.station import Station
from models.edge import Edge

# Load graph 1 lần duy nhất (IMPORTANT)
data_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'data')
stations_file = os.path.join(data_dir, 'stations.json')
edges_file = os.path.join(data_dir, 'edges.json')

graph = Graph()

# ============================================================
# BƯỚC 1: Đọc edges.json
# ============================================================
with open(edges_file, 'r', encoding='utf-8') as f:
    edges_data = json.load(f)

print(f"📋 Keys trong edges.json: {list(edges_data.keys()) if isinstance(edges_data, dict) else 'ARRAY'}")

# Hỗ trợ nhiều cấu trúc file
if isinstance(edges_data, list):
    edges_list = edges_data
elif 'edges' in edges_data:
    edges_list = edges_data['edges']
elif 'connections' in edges_data:
    edges_list = edges_data['connections']
else:
    edges_list = None
    for key, value in edges_data.items():
        if isinstance(value, list):
            edges_list = value
            print(f"🔍 Tìm thấy danh sách edges trong key: '{key}'")
            break
    if edges_list is None:
        raise KeyError(f"Không tìm thấy mảng edges/connections. Keys: {list(edges_data.keys())}")

print(f"✅ Đã đọc {len(edges_list)} kết nối từ edges.json")

# ============================================================
# BƯỚC 2: Đọc stations.json (hỗ trợ key "stations" và chữ hoa)
# ============================================================
with open(stations_file, 'r', encoding='utf-8') as f:
    stations_data = json.load(f)

# Hỗ trợ {"stations": [...]} hoặc mảng trực tiếp [...]
if isinstance(stations_data, list):
    stations_raw = stations_data
elif 'stations' in stations_data:
    stations_raw = stations_data['stations']
else:
    # Thử tìm key đầu tiên chứa list
    stations_raw = None
    for key, value in stations_data.items():
        if isinstance(value, list):
            stations_raw = value
            print(f"🔍 Tìm thấy danh sách stations trong key: '{key}'")
            break
    if stations_raw is None:
        raise KeyError(f"Không tìm thấy mảng stations. Keys: {list(stations_data.keys())}")

# Chuẩn hóa dữ liệu station (hỗ trợ cả chữ hoa và chữ thường)
def normalize_station(raw):
    """Chuyển đổi station từ nhiều định dạng về định dạng chuẩn"""
    return {
        "id": raw.get("ID") or raw.get("id") or raw.get("station_id", ""),
        "name": raw.get("Name") or raw.get("name") or raw.get("station_name", ""),
        "lat": raw.get("lat", 0.0),
        "lon": raw.get("lon", 0.0),
        "children": raw.get("Nearby") or raw.get("nearby") or raw.get("children") or raw.get("connections", [])
    }

stations_list = [normalize_station(s) for s in stations_raw]
print(f"✅ Đã đọc {len(stations_list)} ga từ stations.json")

# ============================================================
# BƯỚC 3: Tạo graph stations
# ============================================================
graph.stations = [Station(s['id'], s['name'], s['lat'], s['lon'], s.get('children', [])) for s in stations_list]
graph.station_by_id = {s.id: s for s in graph.stations}

# ============================================================
# BƯỚC 4: Tạo edges từ edges_list
# ============================================================
graph.edges = []
seen_edges = set()

for e in edges_list:
    # Hỗ trợ các định dạng edge khác nhau: station1/station2, from_id/to_id, from/to
    if 'station1' in e and 'station2' in e:
        from_id = e['station1']
        to_id = e['station2']
    elif 'from_id' in e and 'to_id' in e:
        from_id = e['from_id']
        to_id = e['to_id']
    elif 'from' in e and 'to' in e:
        from_id = e['from']
        to_id = e['to']
    else:
        print(f"⚠️ Bỏ qua edge không rõ định dạng: {list(e.keys())}")
        continue

    time_min = e.get('time_min', e.get('time', 1))
    distance_km = e.get('distance_km', 0.0)
    line = e.get('line', '')

    # Tạo edge 2 chiều (đồ thị vô hướng)
    edge_key_1 = (from_id, to_id)
    edge_key_2 = (to_id, from_id)

    if edge_key_1 not in seen_edges:
        graph.edges.append(Edge(from_id, to_id, time_min, line))
        seen_edges.add(edge_key_1)

    if edge_key_2 not in seen_edges:
        graph.edges.append(Edge(to_id, from_id, time_min, line))
        seen_edges.add(edge_key_2)

print(f"✅ Đã tạo graph: {len(graph.stations)} ga, {len(graph.edges)} cạnh")

# ============================================================
# BƯỚC 5: Tạo NetworkX graph cho Dijkstra
# ============================================================
nx_graph = nx.Graph()

for station in graph.stations:
    nx_graph.add_node(station.id)

for edge in graph.edges:
    nx_graph.add_edge(edge.from_station, edge.to_station, weight=edge.time)

print(f"✅ NetworkX graph: {nx_graph.number_of_nodes()} nodes, {nx_graph.number_of_edges()} edges")

# ============================================================
# Hàm tìm đường
# ============================================================
def find_path(source, target, mode="shortest"):
    """
    Hàm chính xử lý tìm đường
    - source: điểm bắt đầu (station ID)
    - target: điểm kết thúc (station ID)
    - mode: loại tìm đường
    """
    if source not in graph.station_by_id or target not in graph.station_by_id:
        return {"error": "Invalid station ID"}

    if nx_graph.degree(source) == 0:
        return {"error": f"Ga '{source}' không có kết nối nào"}
    if nx_graph.degree(target) == 0:
        return {"error": f"Ga '{target}' không có kết nối nào"}

    path, cost = dijkstra(nx_graph, source, target)

    if not path:
        return {"error": f"Không tìm thấy đường đi từ {source} đến {target}"}

    return {
        "path": path,
        "cost": cost
    }
