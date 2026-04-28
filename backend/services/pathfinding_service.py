# gọi thuật toán và xử lí logic
# backend/services/pathfinding_service.py

import os
import json
import networkx as nx
from algorithms.dijkstra import dijkstra_subway
from models.graph import Graph
from models.station import Station
from models.edge import Edge

# Load graph 1 lần duy nhất (IMPORTANT)
data_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'data')
graph_file = os.path.join(data_dir, 'metro_graph.json')

graph = Graph()
with open(graph_file, 'r', encoding='utf-8') as f:
    data = json.load(f)
    graph.stations = [Station(s['id'], s['name'], s['lat'], s['lon'], s.get('children', [])) for s in data['stations']]
    graph.edges = [Edge(e['from'], e['to'], e['time'], e['line']) for e in data['edges']]
    graph.station_by_id = {s.id: s for s in graph.stations}

# Tạo NetworkX graph cho Dijkstra
nx_graph = nx.Graph()
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

    # Sử dụng dijkstra_subway để tìm đường
    result = dijkstra_subway(nx_graph, source, target)

    return {
        "path": result.get("path", []),
        "cost": result.get("total_time", 0),
        "found": result.get("found", False)
    }