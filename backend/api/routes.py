from flask import Blueprint, request, jsonify
from services.pathfinding_service import find_path, graph
from models.user import init_db, create_user, get_user_by_username, get_user_by_email, verify_password, list_users, hash_password

api_blueprint = Blueprint("api", __name__)

# Initialize SQLite user database when the API loads.
init_db()

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

@api_blueprint.route("/auth/signup", methods=["POST"])
def signup():
    data = request.get_json() or {}
    required_fields = ['username', 'email', 'password', 'first_name', 'last_name']
    for field in required_fields:
        if not data.get(field):
            return jsonify({"error": f"{field} is required"}), 400

    username = data['username'].strip().lower()
    email = data['email'].strip().lower()
    password = data['password']
    first_name = data['first_name'].strip()
    last_name = data['last_name'].strip()
    phone = data.get('phone', '').strip()

    if get_user_by_username(username):
        return jsonify({"error": "Username already exists"}), 400
    if get_user_by_email(email):
        return jsonify({"error": "Email already registered"}), 400

    password_hash = hash_password(password)
    create_user(username=username, email=email, password_hash=password_hash,
                first_name=first_name, last_name=last_name, phone=phone, role='user')

    return jsonify({"message": "User created successfully"}), 201

@api_blueprint.route("/auth/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    username = data.get('username', '').strip().lower()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    role = data.get('role', 'user')

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    user = get_user_by_username(username)
    if not user:
        return jsonify({"error": "User not found"}), 404

    if role == 'user' and user['role'] != 'user':
        return jsonify({"error": "This user is not a normal user"}), 403
    if role == 'admin' and user['role'] != 'admin':
        return jsonify({"error": "This account is not an admin"}), 403

    if role == 'user' and user['email'] != email:
        return jsonify({"error": "Email does not match"}), 400

    if not verify_password(user['password_hash'], password):
        return jsonify({"error": "Password is incorrect"}), 400

    return jsonify({
        "message": "Login successful",
        "user": {
            "username": user['username'],
            "email": user['email'],
            "first_name": user['first_name'],
            "last_name": user['last_name'],
            "role": user['role']
        }
    })

@api_blueprint.route("/auth/users", methods=["GET"])
def get_users():
    return jsonify({"users": list_users()})

@api_blueprint.route("/graph", methods=["GET"])
def get_graph():
    return jsonify(graph.to_dict())