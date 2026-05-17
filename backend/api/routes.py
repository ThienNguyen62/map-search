from flask import Blueprint, request, jsonify
import json
from services.pathfinding_service import find_path, graph

api_blueprint = Blueprint("api", __name__)

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

    # Helper to resolve names to IDs if needed
    def resolve_to_id(value):
        # if already looks like an ID (contains _), assume it's ID
        if not value:
            return None
        if isinstance(value, str) and '_' in value:
            return value
        # try match by name
        name = value.strip().lower()
        for station in graph.stations:
            if station.name.strip().lower() == name:
                return station.id
        return None

    # Build candidate lists
    if source_candidates and isinstance(source_candidates, list):
        src_list = [resolve_to_id(s) for s in source_candidates]
        src_list = [s for s in src_list if s]
    else:
        sid = resolve_to_id(source)
        if not sid:
            return jsonify({"error": "Invalid source"}), 400
        src_list = [sid]

    if target_candidates and isinstance(target_candidates, list):
        tgt_list = [resolve_to_id(t) for t in target_candidates]
        tgt_list = [t for t in tgt_list if t]
    else:
        tid = resolve_to_id(target)
        if not tid:
            return jsonify({"error": "Invalid target"}), 400
        tgt_list = [tid]

    result = find_path(src_list, tgt_list)
    if "error" in result:
        return jsonify(result), 400

    return jsonify(result)

@api_blueprint.route("/graph", methods=["GET"])
def get_graph():
    return jsonify(graph.to_dict())


@api_blueprint.route("/stations", methods=["GET"])
def get_stations():
    try:
        return jsonify([s.to_dict() for s in graph.stations])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_blueprint.route("/edges", methods=["GET"])
def get_edges():
    try:
        # return edges in the original connections format if available
        return jsonify([e.to_dict() for e in graph.edges])
    except Exception as e:
        return jsonify({"error": str(e)}), 500