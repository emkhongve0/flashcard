// --- HỆ THỐNG GÕ CHỮ KIỂM TRA CHÍNH TẢ (TYPING MODE) ---

let isTypingMode = false;

function toggleTypingMode() {
    const checkbox = document.getElementById("typing-toggle-checkbox");
    if (!checkbox) return;

    isTypingMode = checkbox.checked;
    
    // Lưu cấu hình vào LocalStorage
    localStorage.setItem("typingMode", isTypingMode ? "on" : "off");

    // Reset lại giao diện thẻ để áp dụng chế độ mới
    const cardEl = document.getElementById("flashcard");
    if (cardEl) cardEl.classList.remove("is-flipped");
    const controls = document.getElementById("controls");
    if (controls) controls.classList.add("hidden");

    showNextCard();
}

// Kiểm tra kết quả gõ chữ của người dùng
function checkSpelling() {
    if (!currentCard) return;

    const userInput = document.getElementById("typing-input").value.trim().toLowerCase();
    const correctWord = currentCard.word.trim().toLowerCase();
    const resultEl = document.getElementById("typing-result");

    if (!userInput) {
        alert("Vui lòng nhập từ trước khi kiểm tra!");
        return;
    }

    if (userInput === correctWord) {
        // Nếu gõ ĐÚNG: Hiện chữ xanh, phát âm tự động và lật thẻ sau 1 giây
        resultEl.innerHTML = `<span style="color: #2ecc71; font-weight: bold;">🎉 Chính xác!</span>`;
        playAudio(new Event('click'));
        
        setTimeout(() => {
            flipCard();
        }, 1000);
    } else {
        // Nếu gõ SAI: Hiện chữ đỏ chỉ lỗi sai và tự động lật thẻ để người học nhìn lại từ đúng
        resultEl.innerHTML = `<span style="color: #e74c3c; font-weight: bold;">❌ Chưa chính xác! Bạn gõ: "${userInput}"</span>`;
        
        setTimeout(() => {
            flipCard();
        }, 1200);
    }
}

// Tự động kiểm tra trạng thái khi vừa tải trang
document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        const saved = localStorage.getItem("typingMode");
        const checkbox = document.getElementById("typing-toggle-checkbox");
        if (saved === "on") {
            isTypingMode = true;
            if (checkbox) checkbox.checked = true;
        }
    }, 400);
});