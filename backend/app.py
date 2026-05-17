from flask import Flask, request, session, jsonify
from functools import wraps
from flask_cors import CORS
from api.routes import api_blueprint
import json
import os

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
# load admin data
def load_admins():
    path = os.path.join(os.path.dirname(__file__), '..', 'data', 'admin.json')
    path = os.path.abspath(path)

    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)['admins']


def load_users():
    path = os.path.join(os.path.dirname(__file__), '..', 'data', 'users.json')
    path = os.path.abspath(path)
    # If users file doesn't exist, create an empty structure
    if not os.path.exists(path):
        with open(path, 'w', encoding='utf-8') as f:
            json.dump({"users": []}, f, ensure_ascii=False, indent=2)

    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f).get('users', [])


def save_user(user_obj):
    path = os.path.join(os.path.dirname(__file__), '..', 'data', 'users.json')
    path = os.path.abspath(path)
    users = []
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            users = json.load(f).get('users', [])
    users.append(user_obj)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump({"users": users}, f, ensure_ascii=False, indent=2)

# api login
#đọc admin.json check username và password, set session
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'user')

    if role == 'admin':
        admins = load_admins()
        for admin in admins:
            if admin['username'] == username and admin['password'] == password:
                session['is_admin'] = True
                session['username'] = username
                return jsonify({"success": True, "redirect": "/admin.html"})
        return jsonify({"success": False, "message": "Sai tài khoản admin"}), 401
    else:
        # user login
        users = load_users()
        for user in users:
            if user.get('username') == username and user.get('password') == password:
                session['is_admin'] = False
                session['username'] = username
                return jsonify({"success": True, "redirect": "/user.html"})
        return jsonify({"success": False, "message": "Sai tài khoản người dùng"}), 401


@app.route('/api/auth/signup', methods=['POST'])
def signup():
    data = request.json
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    first_name = data.get('first_name')
    last_name = data.get('last_name')

    if not username or not email or not password:
        return jsonify({"error": "Thiếu thông tin đăng ký"}), 400

    users = load_users()
    for u in users:
        if u.get('username') == username or u.get('email') == email:
            return jsonify({"error": "Tên người dùng hoặc email đã tồn tại"}), 400

    new_user = {
        "username": username,
        "email": email,
        "password": password,
        "first_name": first_name,
        "last_name": last_name
    }
    save_user(new_user)
    return jsonify({"success": True}), 201

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