from flask import Flask, request, session, jsonify, send_from_directory
from functools import wraps
from flask_cors import CORS
from api.routes import api_blueprint
# quản lý người dùng, bao gồm khởi tạo cơ sở dữ liệu, tạo người dùng mới, hash mật khẩu, xác nhận mật khẩu
#lấy thông tin người dùng theo usename và ghi lại lịch sử đăng nhập
from services.user import (
    init_db,
    create_user,
    hash_password,
    verify_password,
    get_user_by_username,
    get_user_by_email,
    get_user_by_id,
    update_user_full_name,
    delete_user,
    list_users,
    search_users,
    create_user_admin,
    record_login_attempt,
    get_login_history,
    get_user_login_history,
)
import json
import os
import sqlite3

# khởi tạo Flask
frontend_folder = os.path.join(os.path.dirname(__file__), '..', 'frontend')
app = Flask(__name__, static_folder=frontend_folder, static_url_path='')
app.secret_key = "secret123"  # key bí mật cho session

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
        "origins": [
            "http://127.0.0.1:5500",
            "http://localhost:5500",
            "http://127.0.0.1:5000",
            "http://localhost:5000"
        ]
    }
})
# cấu hình session cookie để frontend có thể nhận diện được session từ backend
app.config.update(
    # Use Lax so cookies are accepted for same-site navigations during development
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=False  # vì đang dùng http (not secure)
)

# đăng ký API
app.register_blueprint(api_blueprint, url_prefix="/api")

@app.route('/admin.html')
def admin_html():
    return send_from_directory(frontend_folder, 'html/admin.html')

@app.route('/login.html')
def login_html():
    return send_from_directory(frontend_folder, 'html/login.html')

@app.route('/user.html')
def user_html():
    return send_from_directory(frontend_folder, 'html/user.html')

@app.route('/', defaults={'path': 'html/login.html'})
@app.route('/<path:path>')
def serve_frontend(path):
    if path.startswith('api/'):
        return jsonify({"error": "Not found"}), 404
    return send_from_directory(frontend_folder, path)

# chuẩn bị cơ sở dữ liệu người dùng
init_db()

# load admin data
def load_admins():
    path = os.path.join(os.path.dirname(__file__), '..', 'data', 'admin.json')
    path = os.path.abspath(path)

    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)['admins']
# thêm route ngày 24/5
@app.route('/api/auth/signup', methods=['POST'])
def signup():
    data = request.json or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    first_name = (data.get('first_name') or '').strip()
    last_name = (data.get('last_name') or '').strip()
    email = data.get('email')
    phone = data.get('phone')

    if not first_name or not last_name:
        return jsonify({"error": "Vui lòng nhập họ và tên"}), 400
    if not username or len(username) < 3:
        return jsonify({"error": "Tên người dùng phải có ít nhất 3 ký tự"}), 400
    if not password or len(password) < 6:
        return jsonify({"error": "Mật khẩu phải có ít nhất 6 ký tự"}), 400
    if get_user_by_username(username):
        return jsonify({"error": "Tên người dùng đã tồn tại"}), 400
    if email:
        if get_user_by_email(email):
            return jsonify({"error": "Email đã tồn tại"}), 400

    password_hash = hash_password(password)
    try:
        create_user(username=username, email=email, password_hash=password_hash,
                    first_name=first_name, last_name=last_name, phone=phone or '')
    except sqlite3.IntegrityError:
        return jsonify({"error": "Không thể tạo tài khoản, vui lòng thử lại"}), 500

    return jsonify({"success": True, "message": "Đăng ký thành công"})


# api login
# đọc admin.json check username và password, set session
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    email = (data.get('email') or '').strip()
    role = data.get('role', 'user')

    if role != 'admin':
        # Validate normal user credentials from the database
        user = None
        if username:
            user = get_user_by_username(username)
        if not user and email:
            user = get_user_by_email(email)

        if not user or not verify_password(user['password_hash'], password):
            record_login_attempt(username or email, request.remote_addr, request.headers.get('User-Agent'), success=False)
            return jsonify({"success": False, "error": "Tên người dùng hoặc mật khẩu không đúng"}), 401

        session['is_admin'] = False
        session['username'] = user['username']
        record_login_attempt(user['username'], request.remote_addr, request.headers.get('User-Agent'), success=True)
        return jsonify({
            "success": True,
            "redirect": "/user.html"
        })

    admins = load_admins()
    for admin in admins:
        if admin['username'] == username and admin['password'] == password:
            session['is_admin'] = True
            session['username'] = username
            record_login_attempt(username, request.remote_addr, request.headers.get('User-Agent'), success=True)

            return jsonify({
                "success": True,
                "redirect": "/admin.html"
            })

    return jsonify({
        "success": False,
        "message": "Sai tài khoản"
    }), 401

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

@app.route('/api/auth/users', methods=['GET', 'POST'])
@admin_required
def auth_users():
    if request.method == 'GET':
        return jsonify({"users": list_users()})

    data = request.json or {}
    username = (data.get('username') or '').strip()
    first_name = (data.get('first_name') or '').strip()
    last_name = (data.get('last_name') or '').strip()
    role = (data.get('role') or 'user').strip()

    if not username or len(username) < 3:
        return jsonify({"error": "Tên người dùng phải có ít nhất 3 ký tự"}), 400
    if not first_name:
        return jsonify({"error": "Vui lòng nhập họ"}), 400
    if not last_name:
        return jsonify({"error": "Vui lòng nhập tên"}), 400
    if role not in ('user', 'admin'):
        return jsonify({"error": "Vai trò không hợp lệ"}), 400
    if get_user_by_username(username):
        return jsonify({"error": "Tên người dùng đã tồn tại"}), 400

    try:
        user_id = create_user_admin(username, first_name, last_name, role)
    except sqlite3.IntegrityError:
        return jsonify({"error": "Không thể tạo tài khoản, vui lòng thử lại"}), 500

    user = get_user_by_id(user_id)
    return jsonify({
        "success": True,
        "message": "Thêm tài khoản thành công. Mật khẩu mặc định: User@123",
        "user": user,
    }), 201


@app.route('/api/auth/users/search', methods=['POST'])
@admin_required
def auth_search_users():
    data = request.json or {}
    users = search_users(
        username=(data.get('username') or '').strip(),
        full_name=(data.get('full_name') or '').strip(),
        role=(data.get('role') or '').strip(),
        from_date=(data.get('from_date') or '').strip() or None,
        to_date=(data.get('to_date') or '').strip() or None,
    )
    return jsonify({"users": users})


@app.route('/api/auth/users/<int:user_id>', methods=['PUT'])
@admin_required
def auth_update_user(user_id):
    data = request.json or {}
    full_name = (data.get('full_name') or '').strip()

    if not full_name:
        return jsonify({"error": "Họ tên không được để trống"}), 400
    if len(full_name) < 2:
        return jsonify({"error": "Họ tên phải có ít nhất 2 ký tự"}), 400

    user = get_user_by_id(user_id)
    if not user:
        return jsonify({"error": "Không tìm thấy người dùng"}), 404

    parts = full_name.split(None, 1)
    first_name = parts[0]
    last_name = parts[1] if len(parts) > 1 else ''

    if not update_user_full_name(user_id, first_name, last_name):
        return jsonify({"error": "Không thể cập nhật người dùng"}), 500

    updated = get_user_by_id(user_id)
    return jsonify({
        "success": True,
        "message": "Cập nhật người dùng thành công",
        "user": updated,
    })


@app.route('/api/auth/users/<int:user_id>', methods=['DELETE'])
@admin_required
def auth_delete_user(user_id):
    user = get_user_by_id(user_id)
    if not user:
        return jsonify({"error": "Không tìm thấy người dùng"}), 404
    if user.get('role') == 'admin' or user.get('username') == 'admin':
        return jsonify({"error": "Không thể xóa tài khoản admin"}), 400

    if not delete_user(user_id):
        return jsonify({"error": "Không thể xóa người dùng"}), 500

    return jsonify({
        "success": True,
        "message": "Xóa người dùng thành công",
    })


@app.route('/api/auth/login-history', methods=['GET'])
@admin_required
def auth_login_history():
    return jsonify({"history": get_login_history()})

@app.route('/api/auth/user-history/<username>', methods=['GET'])
@admin_required
def auth_user_history(username):
    return jsonify({"history": get_user_login_history(username)})

@app.route("/")
def home():
    return "Flask is running"

if __name__ == "__main__":
    app.run(debug=True)