from flask import Blueprint, request, jsonify
from services.pathfinding_service import find_path, graph

api_blueprint = Blueprint("api", __name__)


# ============================================================
# API: Tìm đường
# ============================================================
@api_blueprint.route("/path", methods=["POST"])
def get_path():
    data = request.get_json()
    if not data or 'source' not in data or 'target' not in data:
        return jsonify({"error": "Missing source or target"}), 400

    source_name = data['source'].strip().lower()
    target_name = data['target'].strip().lower()

    # Convert name to ID (hỗ trợ cả nhập tên hoặc ID)
    source_id = None
    target_id = None
    for station in graph.stations:
        if station.name.strip().lower() == source_name or station.id.strip().lower() == source_name:
            source_id = station.id
        if station.name.strip().lower() == target_name or station.id.strip().lower() == target_name:
            target_id = station.id

    if not source_id or not target_id:
        return jsonify({"error": "Invalid station name"}), 400

    result = find_path(source_id, target_id)
    if "error" in result:
        return jsonify(result), 400

    return jsonify(result)


# ============================================================
# API: Lấy danh sách tất cả ga
# ============================================================
@api_blueprint.route("/stations", methods=["GET"])
def get_stations():
    """Trả về danh sách ga cho frontend"""
    stations = []
    for s in graph.stations:
        stations.append({
            "ID": s.id,
            "Name": s.name,
            "lat": s.lat,
            "lon": s.lon,
            "Nearby": s.children
        })
    return jsonify({"stations": stations})


# ============================================================
# API: Lấy danh sách tất cả kết nối (edges)
# ============================================================
@api_blueprint.route("/edges", methods=["GET"])
def get_edges():
    """Trả về danh sách edges cho frontend"""
    edges = []
    seen = set()  # Tránh trùng lặp cạnh vô hướng
    
    for e in graph.edges:
        key = tuple(sorted([e.from_station, e.to_station]))
        if key not in seen:
            edges.append({
                "station1": e.from_station,
                "station2": e.to_station,
                "time_min": e.time,
                "line": e.line
            })
            seen.add(key)
    
    return jsonify({"edges": edges})


# ============================================================
# API: Lấy toàn bộ graph (fallback)
# ============================================================
@api_blueprint.route("/graph", methods=["GET"])
def get_graph():
    return jsonify(graph.to_dict())


# ============================================================
# API: Tìm kiếm ga (autocomplete)
# ============================================================
@api_blueprint.route("/stations/search", methods=["GET"])
def search_stations():
    """Tìm kiếm ga theo từ khóa"""
    query = request.args.get('q', '').strip().lower()
    if not query:
        return jsonify([])
    
    results = []
    for s in graph.stations:
        if query in s.name.lower() or query in s.id.lower():
            results.append({
                "ID": s.id,
                "Name": s.name,
                "lat": s.lat,
                "lon": s.lon
            })
    
    return jsonify(results[:20])  # Giới hạn 20 kết quả
