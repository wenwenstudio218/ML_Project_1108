// G-02: 使用 IIFE (立即執行函式) 來避免汙染全域變數
(function () {

    // G-03: 設定報告最大行數
    const MAX_REPORT_ROWS = 10;

    document.addEventListener('DOMContentLoaded', () => {

        // 載入頁面時，執行這些既有函式
        loadModelInfo();
        loadChartData();

        // G-02: --- 表單處理邏輯 ---
        const predictionForm = document.getElementById('prediction-form');
        const resetButton = document.getElementById('reset-form-btn');

        if (predictionForm) {
            predictionForm.addEventListener('submit', handleFormSubmit);
        }
        if (resetButton) {
            resetButton.addEventListener('click', resetForm);
        }

        // G-03: --- 報告控制按鈕邏輯 ---
        const downloadBtn = document.getElementById('download-pdf-btn');
        const clearBtn = document.getElementById('clear-report-btn');
        const tableBody = document.getElementById('report-table-body');

        if (downloadBtn) {
            downloadBtn.addEventListener('click', handleDownloadPDF);
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', handleClearReport);
        }

        // G-03: 新增刪除按鈕的事件委派
        if (tableBody) {
            tableBody.addEventListener('click', handleDeleteRow);
        }
    });

    /**
     * G-02: 處理表單提交事件
     */
    async function handleFormSubmit(event) {
        event.preventDefault(); // 防止頁面重新載入
        const formMessage = document.getElementById('form-message');
        formMessage.textContent = ''; // 清除上一次的訊息
        formMessage.classList.remove('error', 'success');

        // 1. 獲取表單資料
        const employeeIdInput = document.getElementById('employee_id');
        const f1Input = document.getElementById('feature1');
        const f2Input = document.getElementById('feature2');

        const employeeId = employeeIdInput.value;
        const f1 = f1Input.value;
        const f2 = f2Input.value;

        // 2. 驗證 (雖然 HTML 有 required, JS 再次檢查更保險)
        if (!employeeId || !f1 || !f2) {
            formMessage.textContent = '所有欄位均為必填。';
            formMessage.classList.add('error');
            return;
        }

        // 3. 呼叫後端 API 進行預測
        try {
            const response = await fetch(`/rf/predict?f1=${f1}&f2=${f2}`);
            if (!response.ok) throw new Error(`伺服器錯誤: ${response.status}`);
            const data = await response.json();
            if (data.error) throw new Error(data.error);

            // 4. 將預測結果添加到報告表格中
            addResultToReport(employeeId, f1, f2, data.prediction_class);

            // 5. 顯示成功訊息並清空表單
            formMessage.textContent = `員工 ${escapeHTML(employeeId)} 預測成功！`;
            formMessage.classList.add('success');
            resetForm(); // 呼叫 resetForm 來清空欄位

        } catch (error) {
            console.error('預測失敗:', error);
            formMessage.textContent = `預測失敗: ${error.message}`;
            formMessage.classList.add('error');
        }
    }

    /**
     * G-02 & G-03: 將預測結果動態新增到表格 (含10筆上限 和 刪除按鈕)
     */
    function addResultToReport(id, f1, f2, prediction) {
        const tableBody = document.getElementById('report-table-body');
        if (!tableBody) return; // 防呆

        // G-03: 檢查行數，如果 >= 10, 移除最後一筆
        while (tableBody.rows.length >= MAX_REPORT_ROWS) {
            tableBody.deleteRow(-1); // -1 代表最後一行
        }

        // G-03: 在第一行插入新資料
        const newRow = tableBody.insertRow(0);

        newRow.className = prediction === 1 ? 'result-positive' : 'result-negative';

        // G-03: 更新 innerHTML 以包含刪除按鈕
        newRow.innerHTML = `
            <td>${escapeHTML(id)}</td>
            <td>${escapeHTML(f1)}</td>
            <td>${escapeHTML(f2)}</td>
            <td>${prediction}</td>
            <td>
                <button class="btn-delete" type="button" title="刪除此筆資料">刪除</button>
            </td>
        `;
    }

    /**
     * G-02: 重設(清空)表單欄位
     */
    function resetForm() {
        const predictionForm = document.getElementById('prediction-form');
        if (predictionForm) {
            predictionForm.reset(); // 重設表單
        }
        // 將焦點移回第一個輸入框，方便使用者繼續輸入
        const employeeIdInput = document.getElementById('employee_id');
        if (employeeIdInput) {
            employeeIdInput.focus();
        }
    }

    /**
     * G-03: 處理刪除單一行
     */
    function handleDeleteRow(event) {
        // 檢查點擊的是否是 .btn-delete 按鈕
        if (event.target.classList.contains('btn-delete')) {
            const row = event.target.closest('tr'); // 找到最近的 <tr> 
            if (row) {
                row.remove(); // 刪除該行
            }
        }
    }

    /**
     * G-03: 處理清空報告
     */
    function handleClearReport() {
        const tableBody = document.getElementById('report-table-body');
        if (tableBody) {
            tableBody.innerHTML = ''; // 清空所有內容
        }
    }

    /**
     * G-03: 處理下載 PDF
     */
    async function handleDownloadPDF() {
        // 1. 檢查函式庫
        if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined') {
            console.error('PDF 匯出函式庫 (jsPDF or html2canvas) 未載入。');
            alert('匯出 PDF 失敗，請檢查網路連線並重試。');
            return;
        }

        // G-03: 擷取 #prediction-report-card (包含標題和表格)
        const reportCard = document.getElementById('prediction-report-card');
        if (!reportCard) return;

        const { jsPDF } = window.jspdf;

        // 顯示載入狀態
        const downloadBtn = document.getElementById('download-pdf-btn');
        const originalText = downloadBtn.textContent;
        downloadBtn.textContent = '產生中...';
        downloadBtn.disabled = true;

        try {
            // 2. 使用 html2canvas 擷取報告卡片
            const canvas = await html2canvas(reportCard, {
                scale: 2 // 提高解析度
            });

            const imgData = canvas.toDataURL('image/png');

            // 3. 計算 PDF 尺寸
            const pdf = new jsPDF('p', 'mm', 'a4'); // A4 (210mm x 297mm)
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;

            // 根據 PDF 寬度計算圖片高度 (保持長寬比)
            const imgHeight = (canvasHeight * pdfWidth) / canvasWidth;
            let finalImgHeight = imgHeight;
            let finalImgWidth = pdfWidth;
            let position = 10; // 頂部邊界

            // 如果圖片高度超過A4頁面高度 (減去邊界)，則縮小圖片以符合頁面
            if (imgHeight > (pdfHeight - position * 2)) {
                finalImgHeight = pdfHeight - position * 2;
                finalImgWidth = (canvasWidth * finalImgHeight) / canvasHeight;
            }

            // 計算置中
            const xOffset = (pdfWidth - finalImgWidth) / 2;

            // 4. 將圖片加入 PDF
            pdf.addImage(imgData, 'PNG', xOffset, position, finalImgWidth, finalImgHeight);

            // 5. 儲存檔案
            pdf.save('prediction-report.pdf');

        } catch (error) {
            console.error('產生 PDF 失敗:', error);
            alert('產生 PDF 失敗。');
        } finally {
            // 恢復按鈕
            downloadBtn.textContent = originalText;
            downloadBtn.disabled = false;
        }
    }

    /**
     * G-02: 輔助函式 - 防止簡易的 XSS 攻擊
     */
    function escapeHTML(str) {
        if (typeof str !== 'string') {
            str = String(str);
        }
        return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // --- G-02: 以下是您原本保留的函式 (G-03有修改 setupChartFilters) ---

    /**
     * 載入模型資訊 (保留)
     */
    async function loadModelInfo() {
        try {
            const response = await fetch('/rf/info');
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            if (data.error) throw new Error(data.error);

            // 評估指標
            document.getElementById('metric-recall').textContent = data.evaluation.recall;
            document.getElementById('metric-f1').textContent = data.evaluation.f1_score;
            document.getElementById('metric-auc').textContent = data.evaluation.auc;

            // 資料集資訊
            document.getElementById('info-dataset-name').textContent = data.dataset.name;
            document.getElementById('info-total-samples').textContent = data.dataset.total_samples;
            document.getElementById('info-train-size').textContent = data.dataset.train_size;
            document.getElementById('info-test-size').textContent = data.dataset.test_size;
            document.getElementById('info-target').textContent = data.dataset.target;

            // 圖表說明
            document.getElementById('chart-info-title').textContent = data.chart_info.title;
            // 使用 innerHTML 以便渲染 HTML 標籤 (例如 <span>)
            document.getElementById('chart-info-description').innerHTML = data.chart_info.description;

        } catch (error) {
            console.error('載入模型資訊時發生錯誤:', error);
            // 可以在此處顯示錯誤訊息
        }
    }

    /**
     * 載入並繪製圖表 (保留)
     */
    let scatterChart = null; // 儲存圖表實例
    let allDataPoints = []; // 儲存所有資料點

    async function loadChartData() {
        try {
            const response = await fetch('/rf/chart-data');
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            if (data.error) throw new Error(data.error);

            allDataPoints = data.data; // 儲存所有資料

            const datasets = [
                {
                    label: '無離職傾向 (0)',
                    data: allDataPoints.filter(d => d.turnover_numeric === 0).map(d => ({ x: d.stress_workload_amount, y: d.stress_org_climate_grievance })),
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    pointRadius: 5
                },
                {
                    label: '有離職傾向 (1)',
                    data: allDataPoints.filter(d => d.turnover_numeric === 1).map(d => ({ x: d.stress_workload_amount, y: d.stress_org_climate_grievance })),
                    backgroundColor: 'rgba(255, 99, 132, 0.6)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    pointRadius: 5
                }
            ];

            drawScatterChart(datasets, data.x_label, data.y_label);
            setupChartFilters();

        } catch (error) {
            console.error('載入圖表資料時發生錯誤:', error);
        }
    }

    /**
     * 繪製圖表 (保留)
     */
    function drawScatterChart(datasets, xLabel, yLabel) {
        const ctx = document.getElementById('scatterChart');
        if (!ctx) return; // 防呆

        if (scatterChart) {
            scatterChart.destroy(); // 銷毀舊圖表
        }

        scatterChart = new Chart(ctx.getContext('2d'), {
            type: 'scatter',
            data: {
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: xLabel
                        },
                        min: 0.5,
                        max: 5.5,
                        ticks: {
                            stepSize: 1
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: yLabel
                        },
                        min: 0.5,
                        max: 5.5,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false // 隱藏 Chart.js 的 legend, 使用自訂的
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
    }

    /**
     * G-03: 修改: 設定圖表篩選按鈕 (排除其他按鈕)
     */
    function setupChartFilters() {
        const buttons = document.querySelectorAll('.chart-filter-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                // 檢查按鈕是否在 .report-controls 內，如果是，則不執行篩選
                if (btn.closest('.report-controls')) {
                    return;
                }

                // 檢查是否為表單按鈕
                if (btn.closest('.form-buttons')) {
                    return;
                }

                // 移除所有按鈕的 'active' (僅限圖表控制按鈕)
                document.querySelectorAll('.chart-controls .chart-filter-btn').forEach(b => b.classList.remove('active'));
                // 為當前按鈕添加 'active'
                btn.classList.add('active');

                let filteredData = [];
                if (btn.id === 'chart-filter-all') {
                    filteredData = allDataPoints;
                } else if (btn.id === 'chart-filter-no') {
                    filteredData = allDataPoints.filter(d => d.turnover_numeric === 0);
                } else if (btn.id === 'chart-filter-yes') {
                    filteredData = allDataPoints.filter(d => d.turnover_numeric === 1);
                }

                if (!scatterChart) return; // 防呆

                // 根據篩選後的資料更新圖表
                const datasets = [
                    {
                        label: '無離職傾向 (0)',
                        data: filteredData.filter(d => d.turnover_numeric === 0).map(d => ({ x: d.stress_workload_amount, y: d.stress_org_climate_grievance })),
                        backgroundColor: 'rgba(54, 162, 235, 0.6)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        pointRadius: 5
                    },
                    {
                        label: '有離職傾向 (1)',
                        data: filteredData.filter(d => d.turnover_numeric === 1).map(d => ({ x: d.stress_workload_amount, y: d.stress_org_climate_grievance })),
                        backgroundColor: 'rgba(255, 99, 132, 0.6)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        pointRadius: 5
                    }
                ];

                // 只顯示有資料的 dataset
                scatterChart.data.datasets = datasets.filter(ds => ds.data.length > 0);
                scatterChart.update();
            });
        });
    }

})(); // G-03: IIFE 結束