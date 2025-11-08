# lesson13_expanded/logistic_regression/app.py
from flask import Blueprint, render_template, jsonify, request
import joblib
import numpy as np
import pandas as pd
import os

# 定義 Blueprint
logistic_bp = Blueprint(
    'logistic',
    __name__,
    template_folder='../templates',
    static_folder='../static'
)

# 載入模型和縮放器
# 使用 os.path.join 確保路徑在不同作業系統下皆可運作
try:
    model_path = os.path.join(os.path.dirname(__file__), '..', 'models', 'logistic_model.joblib')
    scaler_path = os.path.join(os.path.dirname(__file__), '..', 'models', 'logistic_scaler.joblib')
    data_path = os.path.join(os.path.dirname(__file__), '..', 'models', 'turnover_data.csv')

    model = joblib.load(model_path)
    scaler = joblib.load(scaler_path)
    
    # 載入原始資料 (為了 scatter plot)
    # 我們只需要 'stress_workload_amount', 'stress_org_climate_grievance', 'turnover_intention'
    df = pd.read_csv(data_path, usecols=[
        'stress_workload_amount', 
        'stress_org_climate_grievance', 
        'turnover_intention'
    ])
    # 取樣 200 筆
    chart_data_df = df.sample(n=200, random_state=42)

except FileNotFoundError as e:
    print(f"模型或資料檔案載入失敗: {e}")
    model = None
    scaler = None
    chart_data_df = pd.DataFrame()


@logistic_bp.route("/logistic/")
def logistic_index():
    """邏輯斯回歸頁面"""
    return render_template("logistic.html")

@logistic_bp.route("/logistic/predict", methods=['GET'])
def predict():
    """
    模型預測 API
    使用 GET 請求，參數: f1 (工作量壓力), f2 (組織風氣壓力)
    """
    if not model or not scaler:
        return jsonify({"error": "模型未載入"}), 500

    try:
        # 1. 從 GET 請求獲取特徵值
        f1 = float(request.args.get('f1', 1)) # stress_workload_amount
        f2 = float(request.args.get('f2', 1)) # stress_org_climate_grievance

        # 2. 建立特徵陣列 (順序必須與訓練時相同)
        features = np.array([[f1, f2]])

        # 3. 使用載入的 scaler 轉換資料
        features_scaled = scaler.transform(features)

        # 4. 進行預測 (取得機率)
        # model.predict_proba 會回傳 [[class_0_prob, class_1_prob]]
        # 假設 "有" 離職傾向是 class 1
        prediction_prob = model.predict_proba(features_scaled)[0][1] 

        # 5. 回傳 JSON 結果
        return jsonify({
            "feature_names": ["工作量壓力", "組織風氣-申訴管道壓力"],
            "feature_values": [f1, f2],
            "prediction_probability": round(prediction_prob * 100, 2) # 回傳百分比
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 400

@logistic_bp.route("/logistic/chart-data", methods=['GET'])
def get_chart_data():
    """提供給 Chart.js 的散佈圖資料 API"""
    if chart_data_df.empty:
        return jsonify({"error": "圖表資料未載入"}), 500
        
    # 將 '有' '沒有' 轉換為 1 和 0，便於圖表處理
    plot_data = chart_data_df.copy()
    plot_data['turnover_numeric'] = plot_data['turnover_intention'].map({'有': 1, '沒有': 0})
    
    # 轉換為 Chart.js 偏好的格式
    data_points = plot_data.to_dict('records')
    
    return jsonify({
        "data": data_points,
        "x_label": "工作量壓力 (stress_workload_amount)",
        "y_label": "組織風氣-申訴管道壓力 (stress_org_climate_grievance)"
    })