# lesson13_expanded/random_forest/app.py
from flask import Blueprint, render_template, jsonify, request
import joblib
import numpy as np
import pandas as pd
import os

# 定義 Blueprint
rf_bp = Blueprint(
    'rf',
    __name__,
    template_folder='../templates',
    static_folder='../static'
)

# 載入模型和特徵列表
try:
    model_path = os.path.join(os.path.dirname(__file__), '..', 'models', 'rf_model.joblib')
    features_path = os.path.join(os.path.dirname(__file__), '..', 'models', 'rf_features.joblib')
    data_path = os.path.join(os.path.dirname(__file__), '..', 'models', 'turnover_data.csv')

    model = joblib.load(model_path)
    feature_list = joblib.load(features_path) # ['stress_workload_amount', 'stress_org_climate_grievance']
    
    # 載入原始資料 (為了 scatter plot)
    df = pd.read_csv(data_path, usecols=[
        'stress_workload_amount', 
        'stress_org_climate_grievance', 
        'turnover_intention'
    ])
    # 取樣 200 筆
    chart_data_df = df.sample(n=200, random_state=42) # 使用相同的 random_state 確保資料一致

except FileNotFoundError as e:
    print(f"模型或資料檔案載入失敗: {e}")
    model = None
    feature_list = []
    chart_data_df = pd.DataFrame()


@rf_bp.route("/rf/")
def rf_index():
    """隨機森林頁面"""
    return render_template("random_forest.html")

@rf_bp.route("/rf/predict", methods=['GET'])
def predict():
    """
    模型預測 API
    使用 GET 請求，參數: f1 (工作量壓力), f2 (組織風氣壓力)
    """
    if not model or not feature_list:
        return jsonify({"error": "模型未載入"}), 500

    try:
        # 1. 從 GET 請求獲取特徵值
        f1 = float(request.args.get('f1', 1)) # stress_workload_amount
        f2 = float(request.args.get('f2', 1)) # stress_org_climate_grievance

        # 2. 建立 Pandas DataFrame (隨機森林模型需要特徵名稱)
        # feature_list 確保了順序和名稱與訓練時完全一致
        features_df = pd.DataFrame([[f1, f2]], columns=feature_list)

        # 3. 進行預測 (取得機率)
        prediction_prob = model.predict_proba(features_df)[0][1] 

        # 4. 回傳 JSON 結果
        return jsonify({
            "feature_names": feature_list,
            "feature_values": [f1, f2],
            "prediction_probability": round(prediction_prob * 100, 2) # 回傳百分比
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 400

@rf_bp.route("/rf/chart-data", methods=['GET'])
def get_chart_data():
    """提供給 Chart.js 的散佈圖資料 API"""
    if chart_data_df.empty:
        return jsonify({"error": "圖表資料未載入"}), 500
        
    plot_data = chart_data_df.copy()
    plot_data['turnover_numeric'] = plot_data['turnover_intention'].map({'有': 1, '沒有': 0})
    
    data_points = plot_data.to_dict('records')
    
    return jsonify({
        "data": data_points,
        "x_label": "工作量壓力 (stress_workload_amount)",
        "y_label": "組織風氣-申訴管道壓力 (stress_org_climate_grievance)"
    })