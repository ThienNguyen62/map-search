# gọi thuật toán và xử lí logic
# backend/services/pathfinding_service.py

import os
import json
import networkx as nx
from algorithms.dijkstra import dijkstra
from models.graph import Graph
from models.station import Station
from models.edge import Edge
from math import radians, sin, cos, atan2, sqrt
import itertools

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
        line = e.get('line', '')
        time_min = e.get('time_min') or e.get('time') or 1
        # Tạo edge cho cả 2 chiều (đồ thị vô hướng)
        graph.edges.append(Edge(e['from_id'], e['to_id'], time_min, line))
        graph.edges.append(Edge(e['to_id'], e['from_id'], time_min, line))

# Tạo NetworkX graph cho Dijkstra
nx_graph = nx.Graph()

# Thêm TẤT CẢ stations làm nodes trước (kể cả ga chưa có edge)
# → tránh ValueError "Node không tồn tại" khi Dijkstra được gọi
for station in graph.stations:
    nx_graph.add_node(station.id)

for edge in graph.edges:
    nx_graph.add_edge(edge.from_station, edge.to_station, weight=edge.time, line=edge.line)


def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = radians(lat2 - lon1) if False else radians(lat2 - lat1)
    dlon = radians(lon2 - lon1) if False else radians(lon2 - lon1)
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    return R * c


def compute_route_metrics(path):
    # path: list of node ids
    total = 0
    lines = []
    transfers = 0
    prev_line = None
    for i in range(len(path)-1):
        a = path[i]
        b = path[i+1]
        data = nx_graph.get_edge_data(a, b)
        if not data:
            # fallback if no direct edge
            continue
        weight = data.get('weight', 0)
        line = data.get('line') or ''
        total += weight
        lines.append(line)
        if prev_line is not None and line != prev_line:
            transfers += 1
        prev_line = line
    # dedupe lines
    unique_lines = []
    for l in lines:
        if not unique_lines or unique_lines[-1] != l:
            unique_lines.append(l)
    return {
        'metro_time': total,
        'transfers': transfers,
        'stops': len(path),
        'lines': unique_lines
    }


def score_route(metrics):
    # Lower score is better. Tunable weights.
    # Give strong weight to metro time, penalize transfers, small penalty for stops (circuitousness)
    return metrics['metro_time'] + metrics['transfers'] * 2.0 + max(0, (metrics['stops'] - 2)) * 0.2

def find_path(source, target, mode="shortest", top_k=3, per_pair_k=5):
    """
    Hàm chính xử lý tìm đường
    - source: điểm bắt đầu (station ID)
    - target: điểm kết thúc (station ID)
    - mode: loại tìm đường
    """
    # source/target can be single station id or list of ids
    source_candidates = source if isinstance(source, (list, tuple)) else [source]
    target_candidates = target if isinstance(target, (list, tuple)) else [target]

    # validate
    for sid in source_candidates + target_candidates:
        if sid not in graph.station_by_id:
            return {"error": f"Invalid station ID: {sid}"}

    # Collect candidate routes from multiple candidate station pairs
    import networkx as _nx
    candidate_routes = []
    seen_paths = set()

    for s, t in itertools.product(source_candidates, target_candidates):
        if _nx.is_isolate(nx_graph, s) or _nx.is_isolate(nx_graph, t):
            continue
        try:
            gen = _nx.shortest_simple_paths(nx_graph, s, t, weight='weight')
            count = 0
            for p in gen:
                # p is a path list
                key = '::'.join(p)
                if key in seen_paths:
                    continue
                seen_paths.add(key)
                metrics = compute_route_metrics(p)
                metrics['path'] = p
                metrics['score'] = score_route(metrics)
                candidate_routes.append(metrics)
                count += 1
                if count >= per_pair_k:
                    break
        except Exception:
            # fallback to Dijkstra single path
            try:
                p, cost = dijkstra(nx_graph, s, t)
                if p:
                    metrics = compute_route_metrics(p)
                    metrics['path'] = p
                    metrics['score'] = score_route(metrics)
                    key = '::'.join(p)
                    if key not in seen_paths:
                        seen_paths.add(key)
                        candidate_routes.append(metrics)
            except Exception:
                continue

    if not candidate_routes:
        return {"error": "Không tìm thấy lộ trình giữa các candidate được cung cấp"}

    # Filter near-duplicate routes: remove routes with >80% overlap or identical sequences
    def is_similar(a, b):
        set_a = set(a)
        set_b = set(b)
        inter = len(set_a & set_b)
        smaller = min(len(set_a), len(set_b))
        if smaller == 0:
            return False
        return (inter / smaller) >= 0.85

    unique_routes = []
    for r in sorted(candidate_routes, key=lambda x: x['score']):
        dup = False
        for u in unique_routes:
            if is_similar(r['path'], u['path']):
                dup = True
                break
        if not dup:
            unique_routes.append(r)

    # sort and pick top_k
    unique_routes.sort(key=lambda x: x['score'])
    top = unique_routes[:top_k]

    # format output
    out = []
    for r in top:
        out.append({
            'path': r['path'],
            'metro_time': r['metro_time'],
            'transfers': r['transfers'],
            'stops': r['stops'],
            'lines': r['lines'],
            'score': r['score']
        })

    return {'routes': out}
