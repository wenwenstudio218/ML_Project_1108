// lesson13_expanded/static/js/logistic.js (修改後)
document.addEventListener('DOMContentLoaded', () => {

    const PREDICT_API_URL = '/logistic/predict';
    const CHART_DATA_URL = '/logistic/chart-data';
    const INFO_API_URL = '/logistic/info';

    // --- 1. 更新 DOM 元素選擇器 ---
    const slider1 = document.getElementById('feature1');
    const slider1Value = document.getElementById('feature1-value');
    const slider2 = document.getElementById('feature2');
    const slider2Value = document.getElementById('feature2-value');

    // (新) 預測結果的元素
    const circleProgress = document.getElementById('circle-progress');
    const riskPercentageValue = document.getElementById('risk-percentage-value');
    const riskLabel = document.getElementById('risk-label');
    const riskInterpretation = document.getElementById('risk-interpretation');

    const chartCtx = document.getElementById('scatterChart').getContext('2d');
    let scatterChart;
    let originalDataNo = [];
    let originalDataYes = [];

    // --- 2. 更新預測函式 ---
    async function updatePrediction() {
        const f1 = slider1.value;
        const f2 = slider2.value;

        try {
            const response = await fetch(`${PREDICT_API_URL}?f1=${f1}&f2=${f2}`);
            if (!response.ok) throw new Error('Network response was not ok');

            const data = await response.json();
            const prob = data.prediction_probability; // 假設回傳 0-100

            // 【要求 2】更新圓形圖
            // 1. 更新 CSS 變數 --p (驅動圓環)
            circleProgress.style.setProperty('--p', prob.toFixed(1));
            // 2. 更新圓心數字 (取整數)
            riskPercentageValue.textContent = prob.toFixed(0);

            let color, label, interpretation;

            if (prob >= 70) {
                color = '#dc3545'; // Red
                label = "高風險";
                interpretation = "建議立即進行關懷訪談";
            } else if (prob >= 40) {
                color = '#ffc107'; // Yellow
                label = "中度風險";
                interpretation = "建議列入觀察名單";
            } else {
                color = '#28a745'; // Green
                label = "低風險";
                interpretation = "目前狀態穩定";
            }

            // 【要求 2】更新圓形圖顏色
            circleProgress.style.setProperty('--c', color);
            circleProgress.querySelector('.circle-progress-inner').style.color = color;

            // 更新文字
            riskLabel.style.color = color;
            riskLabel.textContent = label;
            riskInterpretation.textContent = interpretation;

        } catch (error) {
            console.error('Fetch error:', error);
            riskLabel.textContent = '預測失敗';
            riskInterpretation.textContent = '請檢查網路連線或後端服務';
        }
    }

    // --- 3. 滑桿事件監聽 (更新) ---
    function setupSliders() {
        slider1.addEventListener('input', () => {
            slider1Value.textContent = slider1.value;
            updatePrediction();
        });

        slider2.addEventListener('input', () => {
            slider2Value.textContent = slider2.value;
            updatePrediction();
        });
    }

    // --- 4. 繪製圖表 (修改) ---
    async function drawChart() {
        try {
            const response = await fetch(CHART_DATA_URL);
            const chartData = await response.json();

            const dataPoints = chartData.data;

            originalDataNo = dataPoints.filter(d => d.turnover_numeric === 0)
                .map(d => ({ x: d.stress_workload_amount, y: d.stress_org_climate_grievance }));

            originalDataYes = dataPoints.filter(d => d.turnover_numeric === 1)
                .map(d => ({ x: d.stress_workload_amount, y: d.stress_org_climate_grievance }));

            scatterChart = new Chart(chartCtx, {
                type: 'scatter',
                data: {
                    datasets: [
                        {
                            label: '未離職 (0)',
                            data: originalDataNo,
                            backgroundColor: 'rgba(0, 123, 255, 0.6)',
                            borderColor: 'rgba(0, 123, 255, 1)',
                            pointRadius: 5
                        },
                        {
                            label: '離職 (1)',
                            data: originalDataYes,
                            backgroundColor: 'rgba(220, 53, 69, 0.6)',
                            borderColor: 'rgba(220, 53, 69, 1)',
                            pointRadius: 5
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false, // <-- 關鍵：允許圖表填充 500px 的容器
                    scales: {
                        x: {
                            title: { display: true, text: chartData.x_label },
                            beginAtZero: true,
                            max: 6.0
                        },
                        y: {
                            title: { display: true, text: chartData.y_label },
                            beginAtZero: true,
                            max: 6.0
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    let label = context.dataset.label || '';
                                    if (label) label += ': ';
                                    label += `(${context.parsed.x}, ${context.parsed.y})`;
                                    return label;
                                }
                            }
                        }
                    }
                }
            });

        } catch (error) {
            console.error('Chart fetch error:', error);
        }
    }

    // --- 5. 【要求 2】(新增) 設定圖表過濾按鈕 ---
    function setupChartFilters() {
        const btnAll = document.getElementById('chart-filter-all');
        const btnNo = document.getElementById('chart-filter-no');
        const btnYes = document.getElementById('chart-filter-yes');
        const allBtns = [btnAll, btnNo, btnYes];

        // 幫所有按鈕加上 .active 管理
        allBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                allBtns.forEach(b => b.classList.remove('active')); // 移除所有
                btn.classList.add('active'); // 加上當前

                // 更新圖表
                updateChartVisibility(btn.id);
            });
        });
    }

    // --- 6. 【要求 2】(新增) 更新圖表可見度函式 ---
    function updateChartVisibility(filterId) {
        if (!scatterChart) return;

        switch (filterId) {
            case 'chart-filter-all':
                scatterChart.data.datasets[0].data = originalDataNo;
                scatterChart.data.datasets[1].data = originalDataYes;
                break;
            case 'chart-filter-no':
                scatterChart.data.datasets[0].data = originalDataNo;
                scatterChart.data.datasets[1].data = []; // 隱藏紅點
                break;
            case 'chart-filter-yes':
                scatterChart.data.datasets[0].data = []; // 隱藏藍點
                scatterChart.data.datasets[1].data = originalDataYes;
                break;
        }

        scatterChart.update(); // 重新繪製圖表
    }

    // --- 5. 【要求 3】(新增) 載入模型資訊 ---
    async function loadModelInfo() {
        try {
            const response = await fetch(INFO_API_URL);
            if (!response.ok) throw new Error('Info API response was not ok');
            const info = await response.json();

            // 填充評估指標
            document.getElementById('metric-recall').textContent = info.evaluation.recall;
            document.getElementById('metric-f1').textContent = info.evaluation.f1_score;
            document.getElementById('metric-auc').textContent = info.evaluation.auc;

            // 填充模型資訊
            document.getElementById('info-dataset-name').textContent = info.dataset.name;
            document.getElementById('info-total-samples').textContent = info.dataset.total_samples;
            document.getElementById('info-train-size').textContent = info.dataset.train_size;
            document.getElementById('info-test-size').textContent = info.dataset.test_size;
            document.getElementById('info-target').textContent = info.dataset.target;

            // 填充圖表說明
            document.getElementById('chart-info-title').textContent = info.chart_info.title;
            // 使用 .innerHTML 才能渲染 <span class='legend-no'>
            document.getElementById('chart-info-description').innerHTML = info.chart_info.description;

        } catch (error) {
            console.error('Failed to load model info:', error);
            // 可以在此處顯示錯誤訊息
            document.getElementById('metric-recall').textContent = '錯誤';
            document.getElementById('info-dataset-name').textContent = '錯誤';
            document.getElementById('chart-info-description').textContent = '載入資訊失敗';
        }
    }

    // --- 6. 初始化 ---
    setupSliders();
    drawChart();
    setupChartFilters();
    updatePrediction(); // 頁面載入時立即預測一次
    loadModelInfo(); // 【要求 3】頁面載入時取得資訊
});