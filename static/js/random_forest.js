// lesson13_expanded/static/js/random_forest.js
document.addEventListener('DOMContentLoaded', () => {

    // *** 唯一的修改 ***
    const PREDICT_API_URL = '/rf/predict';
    const CHART_DATA_URL = '/rf/chart-data';
    // *****************

    // 獲取 DOM 元素
    const slider1 = document.getElementById('feature1');
    const slider1Value = document.getElementById('feature1-value');
    const slider2 = document.getElementById('feature2');
    const slider2Value = document.getElementById('feature2-value');

    const predictionValue = document.getElementById('prediction-value');
    const probabilityFill = document.getElementById('probability-fill');
    const chartCtx = document.getElementById('scatterChart').getContext('2d');
    let scatterChart;

    // --- 1. 更新預測 ---
    async function updatePrediction() {
        const f1 = slider1.value;
        const f2 = slider2.value;

        try {
            // 發送 GET 請求
            const response = await fetch(`${PREDICT_API_URL}?f1=${f1}&f2=${f2}`);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();

            // 更新 UI
            const prob = data.prediction_probability;
            predictionValue.textContent = `${prob.toFixed(1)}%`;
            probabilityFill.style.width = `${prob}%`;

            // 根據機率改變顏色
            if (prob < 30) {
                probabilityFill.style.backgroundColor = '#28a745'; // Green
            } else if (prob < 60) {
                probabilityFill.style.backgroundColor = '#ffc107'; // Yellow
            } else {
                probabilityFill.style.backgroundColor = '#dc3545'; // Red
            }

        } catch (error) {
            console.error('Fetch error:', error);
            predictionValue.textContent = '錯誤';
        }
    }

    // --- 2. 滑桿事件監聽 ---
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

    // --- 3. 繪製圖表 ---
    async function drawChart() {
        try {
            const response = await fetch(CHART_DATA_URL);
            const chartData = await response.json();

            // 處理資料：分為 '有' (1) 和 '沒有' (0)
            const dataPoints = chartData.data;
            const turnoverNo = dataPoints.filter(d => d.turnover_numeric === 0)
                .map(d => ({ x: d.stress_workload_amount, y: d.stress_org_climate_grievance }));

            const turnoverYes = dataPoints.filter(d => d.turnover_numeric === 1)
                .map(d => ({ x: d.stress_workload_amount, y: d.stress_org_climate_grievance }));

            scatterChart = new Chart(chartCtx, {
                type: 'scatter',
                data: {
                    datasets: [
                        {
                            label: '未離職 (0)',
                            data: turnoverNo,
                            backgroundColor: 'rgba(0, 123, 255, 0.6)', // Blue
                            borderColor: 'rgba(0, 123, 255, 1)',
                            pointRadius: 5
                        },
                        {
                            label: '離職 (1)',
                            data: turnoverYes,
                            backgroundColor: 'rgba(220, 53, 69, 0.6)', // Red
                            borderColor: 'rgba(220, 53, 69, 1)',
                            pointRadius: 5
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: chartData.x_label
                            },
                            beginAtZero: true,
                            max: 5.5 // 假設最大 5
                        },
                        y: {
                            title: {
                                display: true,
                                text: chartData.y_label
                            },
                            beginAtZero: true,
                            max: 5.5 // 假設最大 5
                        }
                    },
                    plugins: {
                        legend: {
                            display: false // 我們使用自定義的 HTML legend
                        },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
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

    // --- 初始化 ---
    setupSliders();
    drawChart();
    updatePrediction(); // 頁面載入時立即預測一次
});