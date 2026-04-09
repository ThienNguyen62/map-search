from flask import Flask
from flask_cors import CORS
from api.routes import api_blueprint

app = Flask(__name__)

# Enable CORS for all routes
CORS(app, resources={
    r"/api/*": {
        "origins": ["*"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# đăng ký API
app.register_blueprint(api_blueprint, url_prefix="/api")

@app.route("/")
def home():
    return "Flask is running"

if __name__ == "__main__":
    app.run(debug=True)