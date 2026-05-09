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

# Đọc stations.json (là một array trực tiếp)
with open(stations_file, 'r', encoding='utf-8') as f:
    stations_list = json.load(f)
    graph.stations = [Station(s['id'], s['name'], s['lat'], s['lon'], s.get('children', [])) for s in stations_list]
    graph.station_by_id = {s.id: s for s in graph.stations}

# Đọc edges.json (có cấu trúc {"description": "...", "connections": [...]})
with open(edges_file, 'r', encoding='utf-8') as f:
    edges_data = json.load(f)
    edges_list = edges_data['connections']  # Lấy mảng connections
    
    graph.edges = []
    for e in edges_list:
        # Tạo edge cho cả 2 chiều (đồ thị vô hướng)
        graph.edges.append(Edge(e['from_id'], e['to_id'], e['time_min'], ''))
        graph.edges.append(Edge(e['to_id'], e['from_id'], e['time_min'], ''))

# Tạo NetworkX graph cho Dijkstra
nx_graph = nx.Graph()

# Thêm TẤT CẢ stations làm nodes trước (kể cả ga chưa có edge)
# → tránh ValueError "Node không tồn tại" khi Dijkstra được gọi
for station in graph.stations:
    nx_graph.add_node(station.id)

for edge in graph.edges:
    nx_graph.add_edge(edge.from_station, edge.to_station, weight=edge.time)

def find_path(source, target, mode="shortest"):
    """
    Hàm chính xử lý tìm đường
    - source: điểm bắt đầu (station ID)
    - target: điểm kết thúc (station ID)
    - mode: loại tìm đường
    """
    if source not in graph.station_by_id or target not in graph.station_by_id:
        return {"error": "Invalid station ID"}

    # Kiểm tra station có edge nào không (isolated node)
    if nx_graph.degree(source) == 0:
        return {"error": f"Ga '{source}' không có kết nối nào trong dữ liệu edges.json"}
    if nx_graph.degree(target) == 0:
        return {"error": f"Ga '{target}' không có kết nối nào trong dữ liệu edges.json"}

    # hiện tại chỉ dùng dijkstra
    path, cost = dijkstra(nx_graph, source, target)

    if not path:
        return {"error": f"Không tìm thấy đường đi từ {source} đến {target}"}

    return {
        "path": path,
        "cost": cost
    }
