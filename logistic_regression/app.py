from flask import Blueprint, render_template, jsonify, request
import joblib
import numpy as np
import pandas as pd
import os
from sklearn.model_selection import train_test_split
from sklearn.metrics import recall_score, f1_score, roc_auc_score

# 定義 Blueprint
logistic_bp = Blueprint(
    'logistic',
    __name__,
    template_folder='../templates',
    static_folder='../static'
)

# 載入模型和縮放器
try:
    model_path = os.path.join(os.path.dirname(__file__), '..', 'models', 'logistic_model.joblib')
    scaler_path = os.path.join(os.path.dirname(__file__), '..', 'models', 'logistic_scaler.joblib')
    data_path = os.path.join(os.path.dirname(__file__), '..', 'models', 'turnover_data.csv')

    model = joblib.load(model_path)
    scaler = joblib.load(scaler_path)
    
    # 載入原始資料
    df = pd.read_csv(data_path, usecols=[
        'stress_workload_amount', 
        'stress_org_climate_grievance', 
        'turnover_intention'
    ])
    chart_data_df = df.sample(n=200, random_state=42)
    
    # 載入完整資料
    df_full = pd.read_csv(data_path)
    
    # 資料前處理
    df_full['turnover_numeric'] = df_full['turnover_intention'].map({'有': 1, '沒有': 0})
    features = ['stress_workload_amount', 'stress_org_climate_grievance']
    target = 'turnover_numeric'
    
    X = df_full[features]
    y = df_full[target]
    
    X_scaled = scaler.transform(X)
    
    # 資料集分割
    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, 
        test_size=0.3, 
        random_state=42, 
        stratify=y
    )
    
    # 使用載入的 model 進行預測
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)[:, 1] # 取 class 1 (離職) 的機率
    
    # 計算指標
    real_metrics = {
        "recall": f"{recall_score(y_test, y_pred):.2f}",  # 格式化到小數點後 3 位
        "f1_score": f"{f1_score(y_test, y_pred):.2f}",
        "auc": f"{roc_auc_score(y_test, y_pred_proba):.2f}",
        "total_samples": len(df_full),
        "train_size": len(X_train),
        "test_size": len(X_test)
    }

except Exception as e:
    print(f"模型或資料載入/評估失敗: {e}")
    model = None
    scaler = None
    df_chart = pd.DataFrame()
    real_metrics = { 
        "recall": "N/A", "f1_score": "N/A", "auc": "N/A",
        "total_samples": "N/A", "train_size": "N/A", "test_size": "N/A"
    }




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
        # 從 GET 請求獲取特徵值
        f1 = float(request.args.get('f1', 1)) # stress_workload_amount
        f2 = float(request.args.get('f2', 1)) # stress_org_climate_grievance

        # 建立特徵陣列 (順序必須與訓練時相同)
        features = np.array([[f1, f2]])

        # 使用載入的 scaler 轉換資料
        features_scaled = scaler.transform(features)

        # 進行預測 (取得機率)
        prediction_prob = model.predict_proba(features_scaled)[0][1] 

        # 回傳 JSON 結果
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
        
    plot_data = chart_data_df.copy()
    plot_data['turnover_numeric'] = plot_data['turnover_intention'].map({'有': 1, '沒有': 0})
    
    data_points = plot_data.to_dict('records')
    
    return jsonify({
        "data": data_points,
        "x_label": "勞工對工作負荷量之滿意情形（工作負荷）",
        "y_label": "勞工對員工申訴管道之暢通之滿意情形（組織氣氛）"
    })

@logistic_bp.route("/logistic/info", methods=['GET'])
def get_model_info():
    """提供模型評估與資訊"""
    try:
        info = {
            "evaluation": {
                "recall": real_metrics["recall"],
                "f1_score": real_metrics["f1_score"],
                "auc": real_metrics["auc"]
            },
            "dataset": {
                "name": "勞工生活及就業狀況調查-北北桃",
                "total_samples": real_metrics["total_samples"],
                "train_size": real_metrics["train_size"],
                "test_size": real_metrics["test_size"],
                "target": "離職傾向"
            },
            "chart_info": {
                "title": "圖表說明",
                "description": "此散佈圖展示了「工作負荷壓力」(X軸) 與「組織氣氛壓力」(Y軸) 之間的關係。每個點代表一個隨機抽樣的勞工：<span class='legend-no'>藍點</span>代表無離職傾向，<span class='legend-yes'>紅點</span>代表有離職傾向，您可以觀察兩類群體在壓力特徵上的分佈差異。"
            }
        }
        return jsonify(info)
    except Exception as e:
        return jsonify({"error": str(e)}), 500