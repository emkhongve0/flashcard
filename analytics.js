// --- HỆ THỐNG PHÂN TÍCH & VẼ BIỂU ĐỒ TIẾN ĐỘ THÔNG MINH ---

// Hàm khởi tạo khi Tab Thống Kê được kích hoạt
async function initAnalytics() {
    const cards = await getAllCards();

    // LỌC THEO BỘ TỪ ĐANG CHỌN
    if (typeof currentSelectedDeck !== "undefined" && currentSelectedDeck !== "all") {
        cards = cards.filter(c => c.deck === currentSelectedDeck);
    }
    
    // 1. Tính toán số liệu cho Biểu đồ Tròn (Tỷ lệ phân phối từ vựng)
    const total = cards.length;
    const mastered = cards.filter(c => c.interval >= 14).length;
    const learning = cards.filter(c => c.interval > 0 && c.interval < 14).length;
    const newCards = total - mastered - learning;

    // Cập nhật số liệu chữ
    document.getElementById("ana-total").innerText = total;
    document.getElementById("ana-mastered").innerText = mastered;

    // Vẽ biểu đồ tròn bằng Chart.js
    renderPieChart(newCards, learning, mastered);
}

let pieChartInstance = null; // Biến giữ bản quyền biểu đồ để không bị vẽ đè lỗi

function renderPieChart(newCount, learningCount, masteredCount) {
    const ctx = document.getElementById('progressPieChart').getContext('2d');
    
    // Nếu đã có biểu đồ cũ, xóa đi để vẽ lại dữ liệu mới nhất
    if (pieChartInstance) {
        pieChartInstance.destroy();
    }

    // Lấy trạng thái giao diện để đổi màu chữ biểu đồ cho hợp Dark/Light mode
    const isDark = document.body.classList.contains("dark-theme");
    const textColor = isDark ? "#f5f6fa" : "#2c3e50";

    pieChartInstance = new Chart(ctx, {
        type: 'doughnut', // Biểu đồ dạng vòng xoắn (Donut) nhìn rất hiện đại
        data: {
            labels: ['Từ mới (Chưa học)', 'Đang ôn tập', 'Đã thuộc lòng'],
            datasets: [{
                data: [newCount, learningCount, masteredCount],
                backgroundColor: ['#a4b0be', '#54a0ff', '#1dd1a1'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: textColor,
                        font: { weight: '600', size: 12 }
                    }
                }
            }
        }
    });
}