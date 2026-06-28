// --- HỆ THỐNG ĐẢO CHIỀU LẬT THẺ (VIỆT -> ANH) ---

let isReverseMode = false; // Mặc định là Tắt (Học Anh -> Việt)

function toggleReverseMode() {
    const checkbox = document.getElementById("reverse-toggle-checkbox");
    if (!checkbox) return;

    isReverseMode = checkbox.checked;
    
    // Lưu lựa chọn của người dùng vào LocalStorage để lần sau mở app tự nhớ
    localStorage.setItem("reverseMode", isReverseMode ? "on" : "off");

    // Nếu đang đứng ở Tab Học thì ép tải lại thẻ để áp dụng chiều lật mới ngay lập tức
    const activeTab = document.querySelector(".actions button.active")?.id;
    if (activeTab === "nav-study") {
        // Úp thẻ về mặt trước trước khi đổi dữ liệu
        const cardEl = document.getElementById("flashcard");
        if (cardEl) cardEl.classList.remove("is-flipped");
        const controls = document.getElementById("controls");
        if (controls) controls.classList.add("hidden");

        showNextCard();
    }
}

// Hàm tự động kiểm tra trạng thái đảo chiều cũ khi vừa mở App
function applySavedReverseMode() {
    const saved = localStorage.getItem("reverseMode");
    const checkbox = document.getElementById("reverse-toggle-checkbox");
    
    if (saved === "on") {
        isReverseMode = true;
        if (checkbox) checkbox.checked = true;
    }
}

// Gọi kiểm tra khi load file
document.addEventListener("DOMContentLoaded", () => {
    setTimeout(applySavedReverseMode, 300);
});