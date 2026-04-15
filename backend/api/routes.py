from flask import Blueprint, request, jsonify
from services.pathfinding_service import find_path, graph

api_blueprint = Blueprint("api", __name__)

@api_blueprint.route("/path", methods=["POST"])
def get_path():
    data = request.get_json()
    if not data or 'source' not in data or 'target' not in data:
        return jsonify({"error": "Missing source or target"}), 400

    source_name = data['source'].strip().lower()
    target_name = data['target'].strip().lower()

    # Convert name to ID
    source_id = None
    target_id = None
    for station in graph.stations:
        if station.name.strip().lower() == source_name:
            source_id = station.id
        if station.name.strip().lower() == target_name:
            target_id = station.id

    if not source_id or not target_id:
        return jsonify({"error": "Invalid station name"}), 400

    result = find_path(source_id, target_id)
    if "error" in result:
        return jsonify(result), 400

    return jsonify(result)

@api_blueprint.route("/graph", methods=["GET"])
def get_graph():
    return jsonify(graph.to_dict())