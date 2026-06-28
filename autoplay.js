// --- HỆ THỐNG LƯỚT THẺ TỰ ĐỘNG RẢNH TAY (AUTO-PLAY MODE) ---

let autoPlayTimer = null;
let isAutoPlaying = false;
const STEP_DELAY = 3000; // Thời gian chờ giữa mỗi bước (3000ms = 3 giây)

function toggleAutoPlay() {
    const btn = document.getElementById("btn-autoplay");
    if (!btn) return;

    isAutoPlaying = !isAutoPlaying;

    if (isAutoPlaying) {
        btn.innerHTML = "⏹️ Dừng lướt";
        btn.style.background = "#ff6b6b";
        btn.style.color = "white";
        startAutoPlayLoop();
    } else {
        stopAutoPlay();
    }
}

function stopAutoPlay() {
    isAutoPlaying = false;
    if (autoPlayTimer) clearTimeout(autoPlayTimer);
    
    const btn = document.getElementById("btn-autoplay");
    if (btn) {
        btn.innerHTML = "⏱️ Lướt rảnh tay";
        btn.style.background = "var(--primary-light)";
        btn.style.color = "var(--primary)";
    }
}

function startAutoPlayLoop() {
    if (!isAutoPlaying || !currentCard) return;

    // BƯỚC 1: Phát âm từ tiếng Anh ở mặt trước
    playAudio(new Event('click'));

    // BƯỚC 2: Chờ 3 giây rồi lật mặt sau để hiện nghĩa
    autoPlayTimer = setTimeout(() => {
        if (!isAutoPlaying) return;
        
        const cardEl = document.getElementById("flashcard");
        if (cardEl && !cardEl.classList.contains("is-flipped")) {
            flipCard();
        }

        // BƯỚC 3: Chờ tiếp 3 giây nữa rồi tự động bấm "Nhớ (3 ngày)" để qua từ tiếp theo
        autoPlayTimer = setTimeout(async () => {
            if (!isAutoPlaying) return;
            
            // Tự động kích hoạt SRS "Nhớ" và chuyển sang từ kế tiếp
            await submitSRS(3); 
            
            // Đợi một chút cho thẻ lật lại mặt trước rồi tiếp tục vòng lặp
            autoPlayTimer = setTimeout(() => {
                if (isAutoPlaying) startAutoPlayLoop();
            }, 600);

        }, STEP_DELAY);

    }, STEP_DELAY);
}