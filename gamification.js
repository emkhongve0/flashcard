// --- CẤU HÌNH HỆ THỐNG STREAK & NOTIFICATION (OFFLINE 100%) ---

document.addEventListener("DOMContentLoaded", () => {
    initGamification();
});

function initGamification() {
    checkAndUpdateStreak();
    renderStreakUI();
    setupReminderBtn();
}

// 1. LOGIC XỬ LÝ STREAK (Lưu vào LocalStorage)
function checkAndUpdateStreak() {
    const todayStr = new Date().toDateString();
    const lastActiveDay = localStorage.getItem("lastActiveDay");
    let currentStreak = parseInt(localStorage.getItem("studyStreak")) || 0;

    if (!lastActiveDay) {
        // Lần đầu tiên sử dụng app
        localStorage.setItem("studyStreak", 1);
        localStorage.setItem("lastActiveDay", todayStr);
    } else if (lastActiveDay !== todayStr) {
        const lastActiveDate = new Date(lastActiveDay);
        const todayDate = new Date(todayStr);
        
        // Tính khoảng cách ngày giữa lần học cuối và hôm nay
        const diffTime = Math.abs(todayDate - lastActiveDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            // Học liên tiếp ngày hôm sau -> Tăng streak
            currentStreak += 1;
            localStorage.setItem("studyStreak", currentStreak);
            localStorage.setItem("lastActiveDay", todayStr);
        } else if (diffDays > 1) {
            // Quá 1 ngày không học -> Bị đứt Streak, reset về 1
            localStorage.setItem("studyStreak", 1);
            localStorage.setItem("lastActiveDay", todayStr);
        }
    }
}

// Hiển thị biểu tượng ngọn lửa Streak lên màn hình
function renderStreakUI() {
    const streakCount = localStorage.getItem("studyStreak") || 1;
    const statsContainer = document.querySelector("header .stats");
    
    if (statsContainer) {
        // Tạo một thẻ span mới cho Streak nếu chưa có
        let streakEl = document.getElementById("streak-display");
        if (!streakEl) {
            streakEl = document.createElement("span");
            streakEl.id = "streak-display";
            statsContainer.insertBefore(streakEl, statsContainer.firstChild);
        }
        streakEl.innerHTML = `🔥 <strong style="color: #e67e22;">${streakCount} ngày</strong>`;
    }
}

// 2. LOGIC NHẮC NHỞ HỌC TẬP (Web Notification API)
function setupReminderBtn() {
    // Tìm vùng chứa trong ô cài đặt mới
    const container = document.getElementById("reminder-item-container");
    if (container && !document.getElementById("btn-notification")) {
        const notifyBtn = document.createElement("button");
        notifyBtn.id = "btn-notification";
        notifyBtn.onclick = toggleNotification;
        
        if (Notification.permission === "granted") {
            notifyBtn.innerHTML = "🔔 Đã bật";
            notifyBtn.style.background = "#e8f8f5";
        } else {
            notifyBtn.innerHTML = "🔕 Bật nhắc";
        }
        container.appendChild(notifyBtn); // Đẩy nút vào thẳng dòng cấu hình nhắc nhở
    }
}

function toggleNotification() {
    if (!("Notification" in window)) {
        alert("Trình duyệt này không hỗ trợ thông báo đẩy!");
        return;
    }

    if (Notification.permission === "granted") {
        alert("Ứng dụng đã được cấp quyền thông báo. Hệ thống sẽ nhắc bạn học mỗi ngày!");
        triggerSampleNotification(); // Gửi thử 1 thông báo demo
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            const notifyBtn = document.getElementById("btn-notification");
            if (permission === "granted") {
                if (notifyBtn) notifyBtn.innerHTML = "🔔 Đã bật nhắc";
                triggerSampleNotification();
            }
        });
    } else {
        alert("Bạn đã chặn quyền thông báo của trang web. Vui lòng vào Cài đặt trình duyệt (hoặc Cài đặt iPhone) để cấp lại quyền!");
    }
}

// Hàm giả lập gửi thông báo nhắc nhở (Sẽ kích hoạt ngay khi bấm bật để test)
function triggerSampleNotification() {
    if (Notification.permission === "granted") {
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification("⚡ SRS Flashcard", {
                body: "Đã đến giờ ôn tập từ vựng hôm nay rồi bạn ơi! 🔥",
                icon: "icon.png", // Bạn có thể thêm link ảnh icon nếu có
                badge: "icon.png",
                tag: "srs-reminder"
            });
        });
    }
}