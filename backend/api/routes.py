from flask import Blueprint, request, jsonify

api_blueprint = Blueprint("api", __name__)

@api_blueprint.route("/path", methods=["POST"])
def get_path():
    data = request.get_json()

    source = data.get("source")
    target = data.get("target")

    # 👉 FAKE DATA trước
    return jsonify({
        "path": [source, "X", target],
        "time": 5
    })