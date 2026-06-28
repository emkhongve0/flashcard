// --- HỆ THỐNG TRẮC NGHIỆM ĐÁP ÁN NGẪU NHIÊN (QUIZ MODE) ---

let quizCurrentCard = null;
let quizOptions = [];

async function initQuiz() {
    const cards = await getAllCards();

    // LỌC THEO BỘ TỪ ĐANG CHỌN
    if (typeof currentSelectedDeck !== "undefined" && currentSelectedDeck !== "all") {
        cards = cards.filter(c => c.deck === currentSelectedDeck);
    }
    
    // Điều kiện: Phải có ít nhất 4 từ trong máy mới chơi trắc nghiệm được
    if (cards.length < 4) {
        document.getElementById("quiz-question-container").classList.add("hidden");
        document.getElementById("quiz-msg").innerHTML = `
            <p style='text-align:center; color: var(--text-sub); padding: 20px;'>
                ⚠️ Bạn cần nhập ít nhất <strong>4 từ vựng</strong> ở tab "Thêm từ" mới có thể chơi chế độ Trắc nghiệm nhé!
            </p>`;
        return;
    }

    document.getElementById("quiz-question-container").classList.remove("hidden");
    document.getElementById("quiz-msg").innerHTML = "";

    // 1. Chọn ngẫu nhiên 1 từ làm câu hỏi chính
    const randomIndex = Math.floor(Math.random() * cards.length);
    quizCurrentCard = cards[randomIndex];

    // 2. Tạo danh sách 3 đáp án nhiễu (Lọc bỏ từ chính ra trước)
    const wrongCards = cards.filter(c => c.id !== quizCurrentCard.id);
    // Xáo trộn danh sách từ sai và bốc lấy 3 từ đầu tiên
    wrongCards.sort(() => Math.random() - 0.5);
    const selectedWrongMeanings = wrongCards.slice(0, 3).map(c => c.meaning);

    // 3. Gom từ đúng và 3 từ sai thành mảng 4 đáp án rồi xáo trộn tiếp
    quizOptions = [quizCurrentCard.meaning, ...selectedWrongMeanings];
    quizOptions.sort(() => Math.random() - 0.5);

    // 4. Hiển thị lên giao diện
    document.getElementById("quiz-word").innerText = quizCurrentCard.word;
    document.getElementById("quiz-ipa").innerText = quizCurrentCard.ipa || "";
    
    const optionsContainer = document.getElementById("quiz-options");
    optionsContainer.innerHTML = "";

    quizOptions.forEach((option, index) => {
        const btn = document.createElement("button");
        btn.className = "quiz-opt-btn";
        btn.innerText = `${String.fromCharCode(65 + index)}. ${option}`; // Hiện kiểu A. Nghĩa, B. Nghĩa...
        btn.onclick = () => checkQuizAnswer(option, btn);
        optionsContainer.appendChild(btn);
    });
}

function checkQuizAnswer(selectedMeaning, clickedButton) {
    const allButtons = document.querySelectorAll(".quiz-opt-btn");
    
    // Khóa không cho bấm chọn tiếp sau khi đã có kết quả
    allButtons.forEach(btn => btn.disabled = true);

    if (selectedMeaning === quizCurrentCard.meaning) {
        // Trả lời ĐÚNG -> Đổi nút thành màu xanh lá
        clickedButton.style.background = "linear-gradient(135deg, #1dd1a1, #10ac84)";
        clickedButton.style.color = "white";
    } else {
        // Trả lời SAI -> Đổi nút bấm thành màu đỏ
        clickedButton.style.background = "linear-gradient(135deg, #ff6b6b, #e74c3c)";
        clickedButton.style.color = "white";

        // Đồng thời tìm và highlight nút có đáp án đúng lên cho người dùng thấy
        allButtons.forEach(btn => {
            if (btn.innerText.substring(3) === quizCurrentCard.meaning) {
                btn.style.background = "linear-gradient(135deg, #1dd1a1, #10ac84)";
                btn.style.color = "white";
            }
        });
    }

    // Tự động đổi câu hỏi mới sau 1.5 giây
    setTimeout(() => {
        initQuiz();
    }, 1500);
}