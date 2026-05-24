from flask import Flask, request, session, jsonify
from functools import wraps
from flask_cors import CORS
from api.routes import api_blueprint
import json
import os
import uuid
from datetime import datetime
from services.user import (
    init_db,
    hash_password,
    verify_password,
    create_user,
    get_user_by_username,
    get_user_by_email,
    record_login_attempt,
    list_favorite_routes,
    create_favorite_route,
    update_favorite_route_name,
    delete_favorite_route,
)

# khởi tạo Flask
app = Flask(__name__)
app.secret_key = "secret123"  # key bí mật cho session
init_db()

# Enable CORS for all routes
#cho phép frontend truy cập API từ bất kỳ nguồn nào, chỉ cho phép các phương thức GET, POST và OPTIONS, và chỉ cho phép header Content-Type
# CORS(app, resources={
#     r"/api/*": {
#         "origins": ["*"],
#         "methods": ["GET", "POST", "OPTIONS"],
#         "allow_headers": ["Content-Type"]
#     }
# })
CORS(app, supports_credentials=True, resources={
    r"/api/*": {
        "origins": ["http://127.0.0.1:5500", "http://localhost:5500"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})
# cấu hình session cookie để frontend có thể nhận diện được session từ backend
app.config.update(
    SESSION_COOKIE_SAMESITE="None",
    SESSION_COOKIE_SECURE=False  # vì đang dùng http
)

# đăng ký API
app.register_blueprint(api_blueprint, url_prefix="/api")
# load admin data
def load_admins():
    path = os.path.join(os.path.dirname(__file__), '..', 'data', 'admin.json')
    path = os.path.abspath(path)

    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)['admins']

# api login
#đọc admin.json check username và password, set session
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    role = (data.get('role') or 'user').strip().lower()

    if not password:
        return jsonify({
            "success": False,
            "error": "Thiếu mật khẩu"
        }), 400

    if role != 'admin' and not username and not email:
        return jsonify({
            "success": False,
            "error": "Thiếu tên đăng nhập hoặc email"
        }), 400

    ip = request.remote_addr
    user_agent = request.headers.get('User-Agent')

    # If role is 'user', accept the login and set session (no admin privileges required)
    if role != 'admin':
        user = None
        if email:
            user = get_user_by_email(email)
        if user is None and username:
            user = get_user_by_username(username)

        if not user or not verify_password(user.get('password_hash', ''), password):
            record_login_attempt(username or email or 'unknown', ip, user_agent, False)
            return jsonify({
                "success": False,
                "error": "Sai tài khoản hoặc mật khẩu"
            }), 401

        session['is_admin'] = False
        session['username'] = user['username']
        record_login_attempt(user['username'], ip, user_agent, True)
        return jsonify({
            "success": True,
            "redirect": "/user.html"
        })
    
    admins = load_admins()
    for admin in admins:
        if admin['username'] == username and admin['password'] == password:
            session['is_admin'] = True
            session['username'] = username
            record_login_attempt(username, ip, user_agent, True)

            return jsonify({
                "success": True,
                "redirect": "/admin.html"
            })

    record_login_attempt(username or 'unknown', ip, user_agent, False)

    return jsonify({
        "success": False,
        "error": "Sai tài khoản"
    }), 401


@app.route('/api/auth/signup', methods=['POST'])
def signup():
    data = request.get_json(silent=True) or {}
    first_name = (data.get('first_name') or '').strip()
    last_name = (data.get('last_name') or '').strip()
    username = (data.get('username') or '').strip()
    email = (data.get('email') or '').strip().lower()
    phone = (data.get('phone') or '').strip()
    password = data.get('password') or ''

    if not first_name or not last_name or not username or not email or not password:
        return jsonify({"error": "Thiếu thông tin đăng ký"}), 400

    if len(username) < 3:
        return jsonify({"error": "Tên người dùng phải có ít nhất 3 ký tự"}), 400

    if len(password) < 8:
        return jsonify({"error": "Mật khẩu phải có ít nhất 8 ký tự"}), 400

    if get_user_by_username(username):
        return jsonify({"error": "Tên người dùng đã tồn tại"}), 409

    if get_user_by_email(email):
        return jsonify({"error": "Email đã được đăng ký"}), 409

    try:
        password_hash = hash_password(password)
        create_user(
            username=username,
            email=email,
            password_hash=password_hash,
            first_name=first_name,
            last_name=last_name,
            phone=phone,
            role='user'
        )
    except Exception:
        return jsonify({"error": "Không thể tạo tài khoản"}), 500

    return jsonify({"success": True, "message": "Đăng ký thành công"}), 201

#api check session
@app.route('/api/me')
def me():
    return jsonify({
        "is_admin": session.get('is_admin', False),
        "username": session.get('username')
    })
#api logout
#xóa session khi đăng xuất
@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"message": "logged out"})

#bảo vệ admin api
def admin_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not session.get('is_admin'):
            return jsonify({"error": "Unauthorized"}), 403
        return f(*args, **kwargs)
    return wrapper


def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not session.get('username'):
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return wrapper


@app.route('/api/favorites', methods=['GET'])
@login_required
def get_favorites():
    username = session.get('username')
    try:
        favorites = list_favorite_routes(username)
        return jsonify({"favorites": favorites})
    except Exception:
        return jsonify({"error": "Không thể tải tuyến yêu thích"}), 500


@app.route('/api/favorites', methods=['POST'])
@login_required
def add_favorite():
    username = session.get('username')
    data = request.get_json(silent=True) or {}

    route_name = (data.get('routeName') or '').strip()
    source_id = (data.get('sourceId') or '').strip()
    source_name = (data.get('sourceName') or '').strip()
    target_id = (data.get('targetId') or '').strip()
    target_name = (data.get('targetName') or '').strip()
    path = data.get('path') or []
    stations = data.get('stations') or []
    metro_time = data.get('metroTime') or 0
    transfer_count = data.get('transferCount') or 0
    saved_at = (data.get('savedAt') or '').strip() or datetime.utcnow().isoformat()
    source_coord = data.get('sourceCoord') or None
    target_coord = data.get('targetCoord') or None

    # Allow saving either by station ids+names OR by exact coordinates
    has_station_ids = bool(source_id and source_name and target_id and target_name)
    has_coords = bool(source_coord and isinstance(source_coord, dict) and 'lat' in source_coord and 'lon' in source_coord
                      and target_coord and isinstance(target_coord, dict) and 'lat' in target_coord and 'lon' in target_coord)

    if not route_name or not (has_station_ids or has_coords):
        return jsonify({"error": "Thiếu thông tin tuyến yêu thích (station ids hoặc coordinates)"}), 400
    if not isinstance(path, list) or len(path) == 0:
        return jsonify({"error": "Dữ liệu path không hợp lệ"}), 400
    if not isinstance(stations, list):
        return jsonify({"error": "Dữ liệu stations không hợp lệ"}), 400

    favorite_id = (data.get('id') or '').strip() or f"fav_{uuid.uuid4().hex[:16]}"
    try:
        result = create_favorite_route(
            favorite_id=favorite_id,
            username=username,
            route_name=route_name,
            source_id=source_id,
            source_name=source_name,
            target_id=target_id,
            target_name=target_name,
            path=path,
            stations=stations,
            metro_time=float(metro_time),
            transfer_count=int(transfer_count),
            saved_at=saved_at,
            source_lat=(float(source_coord.get('lat')) if source_coord and 'lat' in source_coord else None),
            source_lon=(float(source_coord.get('lon')) if source_coord and 'lon' in source_coord else None),
            target_lat=(float(target_coord.get('lat')) if target_coord and 'lat' in target_coord else None),
            target_lon=(float(target_coord.get('lon')) if target_coord and 'lon' in target_coord else None),
        )
        if not result.get('ok') and result.get('reason') == 'duplicate':
            return jsonify({"error": "Tuyến đã tồn tại", "reason": "duplicate"}), 409
    except Exception:
        return jsonify({"error": "Không thể lưu tuyến yêu thích"}), 500

    favorites = list_favorite_routes(username)
    return jsonify({"favorites": favorites}), 201


@app.route('/api/favorites/<favorite_id>', methods=['PUT'])
@login_required
def rename_favorite(favorite_id):
    username = session.get('username')
    data = request.get_json(silent=True) or {}
    route_name = (data.get('routeName') or '').strip()
    if not route_name:
        return jsonify({"error": "Tên tuyến không được để trống"}), 400

    try:
        changed = update_favorite_route_name(username, favorite_id, route_name)
        if not changed:
            return jsonify({"error": "Không tìm thấy tuyến yêu thích"}), 404
    except Exception:
        return jsonify({"error": "Không thể cập nhật tuyến yêu thích"}), 500

    favorites = list_favorite_routes(username)
    return jsonify({"favorites": favorites})


@app.route('/api/favorites/<favorite_id>', methods=['DELETE'])
@login_required
def remove_favorite(favorite_id):
    username = session.get('username')
    try:
        changed = delete_favorite_route(username, favorite_id)
        if not changed:
            return jsonify({"error": "Không tìm thấy tuyến yêu thích"}), 404
    except Exception:
        return jsonify({"error": "Không thể xóa tuyến yêu thích"}), 500

    favorites = list_favorite_routes(username)
    return jsonify({"favorites": favorites})

@app.route("/")
def home():
    return "Flask is running"

if __name__ == "__main__":
    app.run(debug=True)