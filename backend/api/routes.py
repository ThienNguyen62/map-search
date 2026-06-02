from flask import Blueprint, request, jsonify
import json
from services.pathfinding_service import find_path, graph

api_blueprint = Blueprint("api", __name__)


# ============================================================
# API: Tìm đường
# ============================================================
@api_blueprint.route("/path", methods=["POST"])
def get_path():
    # Read raw body and headers for robust parsing and debugging
    raw = request.get_data(as_text=True)
    # Try normal JSON parsing first, fall back to manual parse of raw body
    try:
        data = request.get_json()
    except Exception:
        data = None

    if not data and raw:
        try:
            data = json.loads(raw)
        except Exception:
            data = None

    if not data or 'source' not in data or 'target' not in data:
        # log details to help debug frontend payload issues
        try:
            print('\n--- /api/path BAD REQUEST ---')
            print('Headers:', dict(request.headers))
            print('Raw body:', raw)
            print('Parsed json:', data)
            print('-----------------------------\n')
        except Exception:
            pass
        return jsonify({"error": "Missing source or target"}), 400
    # Accept either single source/target or arrays of candidate station IDs
    source = data.get('source')
    target = data.get('target')
    source_candidates = data.get('source_candidates')
    target_candidates = data.get('target_candidates')

    # Helper to resolve a value to ALL matching station IDs
    def resolve_to_ids(value):
        """Resolve a station name or ID to a list of matching station IDs.
        
        - If value looks like an ID (contains '_'), return it as a single-item list.
        - Otherwise, treat as a name and return ALL station IDs with that name.
        This ensures stations with duplicate names on different lines are all considered.
        """
        if not value:
            return []
        if isinstance(value, str) and '_' in value:
            # Looks like an ID — validate it exists
            if value in graph.station_by_id:
                return [value]
            # Maybe it's a name with underscore? Fall through to name search
        # Try match by name — return ALL matching stations
        name = value.strip().lower()
        matching_stations = graph.get_stations_by_name(name)
        if matching_stations:
            return [s.id for s in matching_stations]
        # Fallback: partial match
        results = []
        for station in graph.stations:
            if station.name.strip().lower() == name:
                results.append(station.id)
        if results:
            return results
        # Last resort: single partial match
        for station in graph.stations:
            if name in station.name.strip().lower():
                results.append(station.id)
        return results


    # Build candidate lists
    if source_candidates and isinstance(source_candidates, list):
        src_list = []
        for s in source_candidates:
            src_list.extend(resolve_to_ids(s))
        src_list = list(dict.fromkeys(src_list))  # deduplicate preserving order
    else:
        src_list = resolve_to_ids(source)
        if not src_list:
            return jsonify({"error": "Invalid source"}), 400


    if target_candidates and isinstance(target_candidates, list):
        tgt_list = []
        for t in target_candidates:
            tgt_list.extend(resolve_to_ids(t))
        tgt_list = list(dict.fromkeys(tgt_list))  # deduplicate preserving order
    else:
        tgt_list = resolve_to_ids(target)
        if not tgt_list:
            return jsonify({"error": "Invalid target"}), 400

    result = find_path(src_list, tgt_list)
    if "error" in result:
        return jsonify(result), 400

    return jsonify(result)


# ============================================================
# API: Lấy danh sách tất cả ga
# ============================================================
@api_blueprint.route("/stations", methods=["GET"])
def get_stations():
    """Trả về danh sách ga cho frontend"""
    return jsonify({"stations": [s.to_dict() for s in graph.stations]})


# ============================================================
# API: Lấy danh sách tất cả kết nối (edges)
# ============================================================
@api_blueprint.route("/edges", methods=["GET"])
def get_edges():
    """Trả về danh sách edges cho frontend"""
    # Return all edges without deduplication to preserve graph integrity
    edges = [e.to_dict() for e in graph.edges]
    return jsonify({"edges": edges})


# ============================================================
# API: Lấy toàn bộ graph (fallback)
# ============================================================
@api_blueprint.route("/graph", methods=["GET"])
def get_graph():
    return jsonify(graph.to_dict())
