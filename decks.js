// --- HỆ THỐNG QUẢN LÝ BỘ TỪ / CHỦ ĐỀ (DECKS) ---

let currentSelectedDeck = localStorage.getItem("saved_deck_context") || "all";

document.addEventListener("DOMContentLoaded", () => {
    // Lắng nghe sự kiện khi database IndexedDB đã sẵn sàng để quét danh sách bộ từ
    setTimeout(refreshDeckSelector, 500); 
});

// Hàm quét toàn bộ kho từ để tìm ra các Tên chủ đề duy nhất và nạp vào thanh chọn + ô đề xuất
async function refreshDeckSelector() {
    const cards = await getAllCards();
    const selector = document.getElementById("deck-selector");
    const datalist = document.getElementById("existing-decks-list"); // Lấy thẻ datalist mới
    
    if (!selector) return;

    // Lấy danh sách các chủ đề không trùng lặp
    const decks = new Set();
    cards.forEach(card => {
        if (card.deck) decks.add(card.deck.trim());
    });

    // ƯU TIÊN KIỂM TRA BỘ NHỚ ĐỆM LOCALSTORAGE XEM TRƯỚC KHI REFRESH ĐANG CHỌN CHỦ ĐỀ NÀO
    const savedDeckContext = localStorage.getItem("saved_deck_context") || "all";
    const previousSelection = selector.value && selector.value !== "all" ? selector.value : savedDeckContext;

    // 1. Nạp dữ liệu cho thanh chọn bộ lọc trên Header
    selector.innerHTML = `<option value="all">🌐 Tất cả chủ đề</option>`;
    decks.forEach(deckName => {
        const option = document.createElement("option");
        option.value = deckName;
        option.innerText = `📁 ${deckName}`;
        selector.appendChild(option);
    });

    // 2. NẠP DỮ LIỆU ĐỀ XUẤT CHO Ô NHẬP FORM (DATALIST)
    if (datalist) {
        datalist.innerHTML = ""; // Xóa dữ liệu cũ
        decks.forEach(deckName => {
            const option = document.createElement("option");
            option.value = deckName; // Khi người dùng bấm, giá trị này sẽ tự điền vào ô input
            datalist.appendChild(option);
        });
    }

    // Khôi phục lại lựa chọn và đồng bộ biến toàn cục
    if (Array.from(decks).includes(previousSelection)) {
        selector.value = previousSelection;
        currentSelectedDeck = previousSelection;
    } else {
        selector.value = "all";
        currentSelectedDeck = "all";
    }
}

// Hàm kích hoạt khi người dùng thay đổi Bộ từ trên Header
function onDeckChange() {
    // CHỦ ĐỘNG XÓA TIẾN TRÌNH CŨ TRONG BỘ NHỚ KHI ĐỔI CHỦ ĐỀ
    localStorage.removeItem("saved_review_queue");
    localStorage.removeItem("saved_current_card_id");

    const selector = document.getElementById("deck-selector");
    if (!selector) return;
    currentSelectedDeck = selector.value;
    
    // Ép các Tab đang mở tải lại dữ liệu theo bộ lọc mới
    const activeTabBtn = document.querySelector(".actions button.active");
    if (!activeTabBtn) return;
    const activeTab = activeTabBtn.id;
    
    if (activeTab === "nav-study") {
        // Tự động úp thẻ về mặt trước và giấu thanh điều khiển SRS khi đổi chủ đề
        const cardEl = document.getElementById("flashcard");
        if (cardEl) cardEl.classList.remove("is-flipped");
        const controls = document.getElementById("controls");
        if (controls) controls.classList.add("hidden");
        
        refreshQueue();
    }
    if (activeTab === "nav-quiz") {
        if (typeof initQuiz === "function") initQuiz();
    }
    if (activeTab === "nav-manage") {
        if (typeof renderWordsList === "function") renderWordsList();
    }
    if (activeTab === "nav-starred") {
        if (typeof renderStarredList === "function") renderStarredList();
    }
    if (activeTab === "nav-analytics") {
        if (typeof initAnalytics === "function") initAnalytics();
    }
}