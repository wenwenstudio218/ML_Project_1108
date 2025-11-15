// lesson13_expanded/static/js/random_forest.js (修改後)
document.addEventListener('DOMContentLoaded', () => {

    // *** 唯一的修改 ***
    const PREDICT_API_URL = '/rf/predict'; // (不同)
    const CHART_DATA_URL = '/rf/chart-data'; // (不同)
    const INFO_API_URL = '/rf/info'; // (不同)
    // *****************

    const evalButton = document.getElementById('run-evaluation-btn');
    const resultsDiv = document.getElementById('evaluation-results');

    if (evalButton) {
        evalButton.addEventListener('click', runNewDataEvaluation);
    }

    const chartCtx = document.getElementById('scatterChart').getContext('2d');
    let scatterChart;
    let originalDataNo = [];
    let originalDataYes = [];

    /**
 * 觸發後端 API 進行新資料評估
 */
    async function runNewDataEvaluation() {
        const evalButton = document.getElementById('run-evaluation-btn');
        const resultsDiv = document.getElementById('evaluation-results');

        evalButton.textContent = '評估中...';
        evalButton.disabled = true;

        try {
            const response = await fetch('/rf/evaluate-new-data');

            if (!response.ok) {
                throw new Error(`HTTP 錯誤! 狀態: ${response.status}`);
            }

            const data = await response.json();

            if (data.error) {
                alert(`評估失敗: ${data.error}`);
                return;
            }

            // 填充指標
            document.getElementById('eval-total-samples').textContent = data.metrics.total_samples;
            document.getElementById('eval-accuracy').textContent = data.metrics.accuracy;
            document.getElementById('eval-recall').textContent = data.metrics.recall;
            document.getElementById('eval-f1').textContent = data.metrics.f1_score;
            document.getElementById('eval-auc').textContent = data.metrics.auc;

            // 填充混淆矩陣
            const [tn, fp, fn, tp] = data.confusion_matrix.flat();
            document.getElementById('cm-tn').textContent = tn;
            document.getElementById('cm-fp').textContent = fp;
            document.getElementById('cm-fn').textContent = fn;
            document.getElementById('cm-tp').textContent = tp;

            // 顯示結果
            resultsDiv.classList.remove('hidden');
            evalButton.textContent = '評估完成';

        } catch (error) {
            console.error('評估新資料時發生錯誤:', error);
            alert('評估新資料時發生錯誤，請查看 console。');
            evalButton.textContent = '評估失敗，請重試';
            evalButton.disabled = false;
        }
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
    drawChart();
    setupChartFilters();
    loadModelInfo(); // 【要求 3】頁面載入時取得資訊
});