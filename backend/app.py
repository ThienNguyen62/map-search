from flask import Flask
from api.routes import api_blueprint

app = Flask(__name__)

# đăng ký API
app.register_blueprint(api_blueprint, url_prefix="/api")

@app.route("/")
def home():
    return "Flask is running"

if __name__ == "__main__":
    app.run(debug=True)