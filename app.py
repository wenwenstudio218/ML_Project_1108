from flask import Flask, render_template, jsonify, Response, request, url_for
from sklearn.datasets import fetch_california_housing
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_squared_error
import numpy as np
from logistic_regression.app import logistic_bp
from random_forest.app import rf_bp

app = Flask(__name__)

# 自定義JSON序列化設定
app.json.ensure_ascii = False

# 註冊 Blueprint
app.register_blueprint(logistic_bp)
app.register_blueprint(rf_bp)

@app.route("/")
def index():
    return render_template("index.html")

def main():
    app.run(debug=True,port=5000)

if __name__ == "__main__":
    main()