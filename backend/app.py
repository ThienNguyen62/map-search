from flask import Flask, request, session, jsonify
from functools import wraps
from flask_cors import CORS
from api.routes import api_blueprint
from services.user import (
    init_db,
    create_user,
    hash_password,
    verify_password,
    get_user_by_username,
    get_user_by_email,
)
import json
import os
import sqlite3

# khởi tạo Flask
app = Flask(__name__)
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
        "origins": "http://127.0.0.1:5500"
    }
})
# cấu hình session cookie để frontend có thể nhận diện được session từ backend
app.config.update(
    SESSION_COOKIE_SAMESITE="None",
    SESSION_COOKIE_SECURE=False  # vì đang dùng http
)

# đăng ký API
app.register_blueprint(api_blueprint, url_prefix="/api")

# chuẩn bị cơ sở dữ liệu người dùng
init_db()

# load admin data
def load_admins():
    path = os.path.join(os.path.dirname(__file__), '..', 'data', 'admin.json')
    path = os.path.abspath(path)

    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)['admins']

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
            return jsonify({"success": False, "error": "Tên người dùng hoặc mật khẩu không đúng"}), 401

        session['is_admin'] = False
        session['username'] = user['username']
        return jsonify({
            "success": True,
            "redirect": "/user.html"
        })

    admins = load_admins()
    for admin in admins:
        if admin['username'] == username and admin['password'] == password:
            session['is_admin'] = True
            session['username'] = username

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

@app.route("/")
def home():
    return "Flask is running"

if __name__ == "__main__":
    app.run(debug=True)