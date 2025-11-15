# lesson13_expanded/random_forest/app.py
from flask import Blueprint, render_template, jsonify, request
import joblib
import numpy as np
import pandas as pd
import os
from sklearn.model_selection import train_test_split
from sklearn.metrics import recall_score, f1_score, roc_auc_score, accuracy_score, confusion_matrix

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

# --- 3. 【要求 3】新增：自動計算評估指標 ---
    
    # 載入完整資料
    df_full = pd.read_csv(data_path)
    
    # 資料前處理 (同 notebook)
    df_full['turnover_numeric'] = df_full['turnover_intention'].map({'有': 1, '沒有': 0})
    target = 'turnover_numeric'
    
    # X 使用載入的 feature_list
    X = df_full[feature_list] 
    y = df_full[target]
    
    # 隨機森林不需要縮放 (X 保持原樣)
    
    # 關鍵：使用與 notebook 相同的分割參數 (我們假設 test_size=0.2, random_state=42)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, 
        test_size=0.3, 
        random_state=42, 
        stratify=y
    )
    
    # 使用載入的 model 進行預測
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)[:, 1]
    
    # 計算指標
    real_metrics = {
        "recall": f"{recall_score(y_test, y_pred):.3f}",
        "f1_score": f"{f1_score(y_test, y_pred):.3f}",
        "auc": f"{roc_auc_score(y_test, y_pred_proba):.3f}",
        "total_samples": len(df_full),
        "train_size": len(X_train),
        "test_size": len(X_test)
    }

except Exception as e:
    print(f"模型或資料載入/評估失敗: {e}")
    model = None
    feature_list = []
    df_chart = pd.DataFrame()
    real_metrics = { # 發生錯誤時的預設值
        "recall": "N/A", "f1_score": "N/A", "auc": "N/A",
        "total_samples": "N/A", "train_size": "N/A", "test_size": "N/A"
    }


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
        "x_label": "勞工對工作負荷量之滿意情形（工作負荷）",
        "y_label": "勞工對員工申訴管道之暢通之滿意情形（組織氣氛）"
    })

@rf_bp.route("/rf/info", methods=['GET'])
def get_model_info():
    """提供模型評估與資訊"""
    try:
        # 範例數據 (請您替換為模型訓練的真實數據)
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
    

@rf_bp.route("/rf/evaluate-new-data", methods=['GET'])
def evaluate_new_data():
    """
    使用新的預測資料(data110-北北桃新預測.csv)來評估模型。
    """
    if not model or not feature_list:
        return jsonify({"error": "模型未載入"}), 500

    try:
        # 1. 載入「新」的評估資料
        new_data_path = os.path.join(os.path.dirname(__file__), '..', 'models', 'new_turnover_data.csv')
        df_new = pd.read_csv(new_data_path)

        # 2. 資料前處理 (同訓練時)
        df_new['turnover_numeric'] = df_new['turnover_intention'].map({'有': 1, '沒有': 0})

        # 確保特徵欄位存在
        if not all(f in df_new.columns for f in feature_list):
             return jsonify({"error": "新資料中缺少必要的特徵欄位"}), 400

        X_new = df_new[feature_list]
        y_new_actual = df_new['turnover_numeric']

        # 3. 執行預測
        y_new_pred = model.predict(X_new)
        y_new_pred_proba = model.predict_proba(X_new)[:, 1] # 取 class 1 (離職) 的機率

        # 4. 計算評估指標
        acc = accuracy_score(y_new_actual, y_new_pred)
        recall = recall_score(y_new_actual, y_new_pred)
        f1 = f1_score(y_new_actual, y_new_pred)
        auc = roc_auc_score(y_new_actual, y_new_pred_proba)

        # 5. 計算混淆矩陣 (Confusion Matrix)
        # cm[0][0] = True Negative (真陰性)
        # cm[0][1] = False Positive (偽陽性)
        # cm[1][0] = False Negative (偽陰性)
        # cm[1][1] = True Positive (真陽性)
        cm = confusion_matrix(y_new_actual, y_new_pred)

        # 6. 回傳 JSON 結果
        return jsonify({
            "metrics": {
                "accuracy": f"{acc:.3f}",
                "recall": f"{recall:.3f}",
                "f1_score": f"{f1:.3f}",
                "auc": f"{auc:.3f}",
                "total_samples": len(df_new)
            },
            "confusion_matrix": cm.tolist() # 轉換為 list 才能 JSON 序列化
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500