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

# api login
#đọc admin.json check username và password, set session
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
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