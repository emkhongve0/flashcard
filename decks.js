// --- HỆ THỐNG QUẢN LÝ BỘ TỪ / CHỦ ĐỀ (DECKS) ---

let currentSelectedDeck = "all"; // Mặc định là xem tất cả các từ

document.addEventListener("DOMContentLoaded", () => {
    // Lắng nghe sự kiện khi database IndexedDB đã sẵn sàng để quét danh sách bộ từ
    setTimeout(refreshDeckSelector, 500); 
});

// Hàm quét toàn bộ kho từ để tìm ra các Tên chủ đề duy nhất và nạp vào thanh chọn
async function refreshDeckSelector() {
    const cards = await getAllCards();
    const selector = document.getElementById("deck-selector");
    if (!selector) return;

    // Lấy danh sách các chủ đề không trùng lặp
    const decks = new Set();
    cards.forEach(card => {
        if (card.deck) decks.add(card.deck.trim());
    });

    // Giữ lại lựa chọn hiện tại của người dùng trước khi vẽ lại
    const previousSelection = selector.value || "all";

    selector.innerHTML = `<option value="all">🌐 Tất cả chủ đề</option>`;
    decks.forEach(deckName => {
        const option = document.createElement("option");
        option.value = deckName;
        option.innerText = `📁 ${deckName}`;
        selector.appendChild(option);
    });

    // Khôi phục lại lựa chọn cũ nếu bộ từ đó vẫn tồn tại
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
    const selector = document.getElementById("deck-selector");
    currentSelectedDeck = selector.value;
    
    // Ép các Tab đang mở tải lại dữ liệu theo bộ lọc mới
    const activeTab = document.querySelector(".actions button.active").id;
    if (activeTab === "nav-study") {
        // Tự động úp thẻ về mặt trước và giấu thanh điều khiển SRS khi đổi chủ đề
        const cardEl = document.getElementById("flashcard");
        if (cardEl) cardEl.classList.remove("is-flipped");
        const controls = document.getElementById("controls");
        if (controls) controls.classList.add("hidden");
        
        refreshQueue();
    }
    if (activeTab === "nav-quiz") initQuiz();
    if (activeTab === "nav-manage") renderWordsList();
    if (activeTab === "nav-starred") renderStarredList();
    if (activeTab === "nav-analytics") initAnalytics();
}