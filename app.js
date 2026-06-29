const DB_NAME = "FlashcardSRS_DB";
let db;

// 1. KHỞI TẠO CƠ SỞ DỮ LIỆU INDEXEDDB OOFFLINE
const request = indexedDB.open(DB_NAME, 1);
request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("cards")) {
        db.createObjectStore("cards", { keyPath: "id", autoIncrement: true });
    }
};
request.onsuccess = (e) => {
    db = e.target.result;
    initApp();
};

let currentCard = null;
let reviewQueue = [];
let isReviewMode = true; // true: Ôn tập đúng hạn SRS | false: Học tự do lặp vòng

async function initApp() {
    // Đã loại bỏ hoàn toàn dữ liệu mẫu ban đầu (Hello, PWA) giúp app trống sạch 100%
    await refreshQueue();
    await renderWordsList();
}

// 2. LOGIC ĐIỀU HƯỚNG TABS
function switchTab(tabName) {

    // Tự động tắt chế độ lướt rảnh tay nếu người dùng chuyển Tab
    if (typeof stopAutoPlay === "function") stopAutoPlay();
    // Ẩn hiện các Tab nội dung
    document.getElementById("tab-study").classList.toggle("hidden", tabName !== 'study');
    document.getElementById("tab-manage").classList.toggle("hidden", tabName !== 'manage');
    document.getElementById("tab-starred").classList.toggle("hidden", tabName !== 'starred');
    document.getElementById("tab-analytics").classList.toggle("hidden", tabName !== 'analytics');
    document.getElementById("tab-quiz").classList.toggle("hidden", tabName !== 'quiz'); // Thêm dòng này
    
    // Cập nhật trạng thái bật sáng (Active) trên thanh Menu điều hướng
    document.getElementById("nav-study").classList.toggle("active", tabName === 'study');
    document.getElementById("nav-starred").classList.toggle("active", tabName === 'starred');
    document.getElementById("nav-manage").classList.toggle("active", tabName === 'manage');
    document.getElementById("nav-analytics").classList.toggle("active", tabName === 'analytics');
    document.getElementById("nav-quiz").classList.toggle("active", tabName === 'quiz'); // Thêm dòng này
    
    if (tabName === 'manage') renderWordsList();
    if (tabName === 'starred') renderStarredList();
    if (tabName === 'analytics') initAnalytics();
    if (tabName === 'quiz') initQuiz(); // Thêm dòng này để khởi tạo câu hỏi trắc nghiệm
    if (tabName === 'study') refreshQueue();
    
    // Tự động đóng panel cài đặt lại nếu người dùng chuyển tab
    document.getElementById("settings-panel").classList.add("hidden");
}

// Logic đóng mở Panel cài đặt phụ
function toggleSettingsPanel() {
    const panel = document.getElementById("settings-panel");
    panel.classList.toggle("hidden");
}

// 3. TÍNH TOÁN HÀNG ĐỢI HỌC TỪ (ĐÃ ĐỒNG BỘ CHỦ ĐỀ)
async function refreshQueue() {
    let cards = await getAllCards();
    const now = Date.now();
    
    // BỘ LỌC CHỦ ĐỀ: Nếu đang chọn một chủ đề cụ thể, chỉ lấy từ của chủ đề đó
    if (typeof currentSelectedDeck !== "undefined" && currentSelectedDeck !== "all") {
        cards = cards.filter(c => c.deck === currentSelectedDeck);
    }

    // ĐỌC TIẾN TRÌNH CŨ TỪ LOCALSTORAGE
    const savedQueue = localStorage.getItem("saved_review_queue");
    const savedCurrentCardId = localStorage.getItem("saved_current_card_id");
    const savedDeckContext = localStorage.getItem("saved_deck_context") || "all";

    // Khôi phục lại nếu có hàng đợi cũ đang học dở và cùng đúng Chủ đề (Deck) đang chọn
    if (savedQueue && savedDeckContext === (currentSelectedDeck || "all")) {
        try {
            reviewQueue = JSON.parse(savedQueue);
            isReviewMode = localStorage.getItem("saved_review_mode") === "true";
            
            if (savedCurrentCardId) {
                // Ép kiểu ID về Number nếu ID trong DB của bạn là số tăng tự động
                const numericId = Number(savedCurrentCardId);
                currentCard = cards.find(c => c.id === numericId || c.id === savedCurrentCardId) || reviewQueue[0];
            } else {
                currentCard = reviewQueue[0];
            }

            // Cập nhật con số hiển thị lên giao diện thanh trạng thái
            document.getElementById("review-count").innerText = isReviewMode ? reviewQueue.length : `Tự do (${reviewQueue.length})`;
            const masteredCount = cards.filter(c => c.interval >= 14).length;
            document.getElementById("mastered-count").innerText = masteredCount;

            renderCurrentCardState(); 
            return; // Dừng lại tại đây, lấy tiến trình cũ học tiếp
        } catch (e) {
            console.error("Lỗi đồng bộ bộ nhớ, khởi tạo hàng đợi mới:", e);
        }
    }
    
    // NẾU KHÔNG CÓ TIẾN TRÌNH CŨ: Tiến hành tính toán hàng đợi mới từ đầu như cũ
    reviewQueue = cards.filter(c => c.nextReview <= now);
    
    const masteredCount = cards.filter(c => c.interval >= 14).length;
    document.getElementById("mastered-count").innerText = masteredCount;

    if (reviewQueue.length > 0) {
        isReviewMode = true;
        document.getElementById("review-count").innerText = reviewQueue.length;
    } else {
        isReviewMode = false;
        reviewQueue = [...cards];
        reviewQueue.sort(() => Math.random() - 0.5); 
        document.getElementById("review-count").innerText = cards.length > 0 ? `Tự do (${reviewQueue.length})` : "0";
    }

    if (reviewQueue.length > 0) {
        currentCard = reviewQueue[0];
    } else {
        currentCard = null;
    }

    saveCurrentProgress();
    renderCurrentCardState();
}

// Hàm bổ trợ: Ghi tiến trình hiện tại vào LocalStorage
function saveCurrentProgress() {
    localStorage.setItem("saved_review_queue", JSON.stringify(reviewQueue));
    localStorage.setItem("saved_current_card_id", currentCard ? currentCard.id : "");
    localStorage.setItem("saved_review_mode", isReviewMode);
    localStorage.setItem("saved_deck_context", currentSelectedDeck || "all");
}

// 4. HIỂN THỊ TỪ TIẾP THEO LÊN GIAO DIỆN (ĐÃ TÁCH BIỆT LOGIC HIỂN THỊ)
function showNextCard() {
    if (reviewQueue.length === 0) {
        currentCard = null;
        localStorage.removeItem("saved_review_queue");
        localStorage.removeItem("saved_current_card_id");
    } else {
        currentCard = reviewQueue[0];
    }
    
    renderCurrentCardState();
    saveCurrentProgress(); // Đồng bộ ngay sau khi đổi thẻ
}

    // Hàm chuyên trách xử lý giao diện thẻ (Lồng ghép chuẩn xác Chế độ gõ chữ và Đảo chiều)
function renderCurrentCardState() {
    const wordEl = document.getElementById("word-display");
    const ipaEl = document.getElementById("ipa-display");
    const audioBtn = document.querySelector(".audio-btn");
    const meaningEl = document.getElementById("meaning-display");
    const exampleEl = document.getElementById("example-display");
    const typingArea = document.getElementById("typing-area");
    const starBtn = document.getElementById("star-btn");

    if (!currentCard) {
        if (wordEl) wordEl.innerText = "🎉 Hoàn thành!";
        if (ipaEl) ipaEl.innerText = "Hẹn gặp lại ngày mai";
        if (meaningEl) meaningEl.innerText = "Bạn đã dọn sạch từ vựng cần ôn hôm nay.";
        if (exampleEl) exampleEl.innerText = "";
        if (audioBtn) audioBtn.style.display = "none";
        if (starBtn) starBtn.style.display = "none";
        if (typingArea) typingArea.classList.add("hidden");
        return;
    }
    
    // Hiển thị và xử lý ngôi sao từ khó
    if (starBtn) {
        starBtn.style.display = "block";
        starBtn.innerText = currentCard.isStarred ? "★" : "☆";
        starBtn.className = currentCard.isStarred ? "star-icon active" : "star-icon";
    }

    // Reset sạch ô nhập chính tả của phiên học trước
    if (document.getElementById("typing-input")) document.getElementById("typing-input").value = "";
    if (document.getElementById("typing-result")) document.getElementById("typing-result").innerText = "";

    // TRƯỜNG HỢP 1: ĐANG BẬT CHẾ ĐỘ GÕ CHỮ (TYPING MODE)
    if (typeof isTypingMode !== "undefined" && isTypingMode === true) {
        if (typingArea) typingArea.classList.remove("hidden");
        if (wordEl) wordEl.innerText = currentCard.meaning;
        if (ipaEl) ipaEl.innerText = "Hãy gõ từ tiếng Anh tương ứng chính xác...";
        if (audioBtn) audioBtn.style.display = "none";

        if (meaningEl) {
            meaningEl.innerHTML = `
                <span style="font-size: 2.2rem; font-weight: 800; color: var(--primary);">${currentCard.word}</span>
                <p class="ipa" style="margin-top: 5px;">${currentCard.ipa || ''}</p>
                <button class="audio-btn" onclick="playAudio(event)" style="display:inline-block; margin-top:8px; padding:6px 12px; font-size:0.8rem;">🔊 Nghe phát âm</button>
            `;
        }
        if (exampleEl) exampleEl.innerText = currentCard.example || "Không có ví dụ.";

    } else {
        // TRƯỜNG HỢP 2: KHÔNG BẬT GÕ CHỮ (HIỂN THỊ FLASHCARD THƯỜNG HOẶC ĐẢO CHIỀU)
        if (typingArea) typingArea.classList.add("hidden");

        if (typeof isReverseMode !== "undefined" && isReverseMode === true) {
            // Chế độ đảo chiều Việt -> Anh
            if (wordEl) wordEl.innerText = currentCard.meaning;
            if (ipaEl) ipaEl.innerText = "Nghĩ từ tiếng Anh tương ứng...";
            if (audioBtn) audioBtn.style.display = "none";

            if (meaningEl) {
                meaningEl.innerHTML = `
                    <span style="font-size: 2.2rem; font-weight: 800; color: var(--primary);">${currentCard.word}</span>
                    <p class="ipa" style="margin-top: 5px;">${currentCard.ipa || ''}</p>
                    <button class="audio-btn" onclick="playAudio(event)" style="display:inline-block; margin-top:8px; padding:6px 12px; font-size:0.8rem;">🔊 Nghe phát âm</button>
                `;
            }
            if (exampleEl) exampleEl.innerText = currentCard.example || "Không có ví dụ.";
        } else {
            // Chế độ mặc định Anh -> Việt
            if (wordEl) wordEl.innerText = currentCard.word;
            if (ipaEl) ipaEl.innerText = currentCard.ipa || "/.../";
            if (audioBtn) audioBtn.style.display = "inline-block";
            if (meaningEl) meaningEl.innerText = currentCard.meaning;
            if (exampleEl) exampleEl.innerText = currentCard.example || "Không có ví dụ.";
        }
    }
}

function flipCard() {
    if (!currentCard) return;
    const cardEl = document.getElementById("flashcard");
    if (!cardEl) return;
    cardEl.classList.toggle("is-flipped");
    
    const controls = document.getElementById("controls");
    if (controls) {
        controls.classList.toggle("hidden", !cardEl.classList.contains("is-flipped"));
    }
}
// 5. ĐÁNH DẤU SAO / TỪ KHÓ TRÊN THẺ
async function toggleStar(event) {
    event.stopPropagation(); // Ngăn hành vi lật thẻ khi bấm vào ngôi sao
    if (!currentCard) return;
    currentCard.isStarred = !currentCard.isStarred;
    await updateCardInDB(currentCard);
    document.getElementById("star-btn").innerText = currentCard.isStarred ? "★" : "☆";
    document.getElementById("star-btn").className = currentCard.isStarred ? "star-icon active" : "star-icon";
}

function playAudio(event) {
    event.stopPropagation();
    if (!currentCard) return;
    const utterance = new SpeechSynthesisUtterance(currentCard.word);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
}

// Gửi kết quả đánh giá khoảng cách SRS
async function submitSRS(days) {
    if (!currentCard) return;
    
    currentCard.interval = days;
    currentCard.nextReview = Date.now() + (days * 24 * 60 * 60 * 1000);
    await updateCardInDB(currentCard);

    if (isReviewMode) {
        reviewQueue.shift(); // Ôn xong thì xóa khỏi danh sách ôn hôm nay
    } else {
        // Chế độ tự do: Đẩy xuống cuối hàng đợi tạo vòng lặp vô tận
        const shifted = reviewQueue.shift();
        reviewQueue.push(shifted);
    }

    // Kiểm tra xem hàng đợi hiện tại có rỗng không
    if (reviewQueue.length === 0) {
        await refreshQueue();
    } else {
        // KIỂM TRA BẢO VỆ: Nếu người dùng vừa đổi chủ đề giữa chừng, đảm bảo từ tiếp theo phải thuộc đúng chủ đề đó
        if (typeof currentSelectedDeck !== "undefined" && currentSelectedDeck !== "all" && reviewQueue[0].deck !== currentSelectedDeck) {
            await refreshQueue();
        } else {
            showNextCard();
        }
    }
}

// 6. THAO TÁC QUẢN LÝ (CRUD - THÊM / SỬA / XÓA) - ĐÃ BỔ SUNG ĐỒNG BỘ GỢI Ý CHỦ ĐỀ
async function saveFormCard() {
    const id = document.getElementById("form-id").value;
    const word = document.getElementById("form-word").value.trim();
    const ipa = document.getElementById("form-ipa").value.trim();
    const meaning = document.getElementById("form-meaning").value.trim();
    const example = document.getElementById("form-example").value.trim();
    const deck = document.getElementById("form-deck").value.trim() || "Chung"; // Mặc định là nhóm Chung nếu bỏ trống

    if (!word || !meaning) {
        alert("Vui lòng điền ít nhất là Từ mới và Giải nghĩa!");
        return;
    }

    if (id) {
        const oldCard = await getCardById(Number(id));
        const updatedCard = { ...oldCard, deck, word, ipa, meaning, example };
        await updateCardInDB(updatedCard);
    } else {
        const newCard = { deck, word, ipa, meaning, example, isStarred: false, nextReview: Date.now(), interval: 0 };
        await addCardToDB(newCard);
    }

    // BƯỚC 3: CẬP NHẬT GỢI Ý THÔNG MINH CHO CẢ HEADER VÀ FORM DATALIST NGAY LẬP TỨC
    if (typeof refreshDeckSelector === "function") {
        await refreshDeckSelector();
    }

    clearForm();
    await renderWordsList();
    alert("Đã lưu từ vựng!");
}

async function editCard(id) {
    const card = await getCardById(id);
    if (!card) return;
    document.getElementById("form-id").value = card.id;
    document.getElementById("form-word").value = card.word;
    document.getElementById("form-ipa").value = card.ipa;
    document.getElementById("form-meaning").value = card.meaning;
    document.getElementById("form-example").value = card.example;
    // Tự động cuộn mượt lên khung nhập liệu để người dùng dễ thao tác
    document.querySelector(".form-container").scrollIntoView({ behavior: 'smooth' });
    document.getElementById("form-deck").value = card.deck || "";
}

async function deleteCard(id) {
    if (confirm("Bạn có chắc chắn muốn xóa từ này khỏi kho dữ liệu không?")) {
        await deleteCardFromDB(id);
        
        // CẬP NHẬT LẠI GỢI Ý (Nếu xóa từ cuối cùng của chủ đề đó, chủ đề sẽ biến mất khỏi gợi ý)
        if (typeof refreshDeckSelector === "function") {
            await refreshDeckSelector();
        }
        
        await renderWordsList();
    }
}

function clearForm() {
    document.getElementById("form-id").value = "";
    document.getElementById("form-word").value = "";
    document.getElementById("form-ipa").value = "";
    document.getElementById("form-meaning").value = "";
    document.getElementById("form-example").value = "";
    document.getElementById("form-deck").value = "";
}

async function editCard(id) {
    const card = await getCardById(id);
    if (!card) return;
    document.getElementById("form-id").value = card.id;
    document.getElementById("form-word").value = card.word;
    document.getElementById("form-ipa").value = card.ipa;
    document.getElementById("form-meaning").value = card.meaning;
    document.getElementById("form-example").value = card.example;
    // Tự động cuộn mượt lên khung nhập liệu để người dùng dễ thao tác
    document.querySelector(".form-container").scrollIntoView({ behavior: 'smooth' });
    document.getElementById("form-deck").value = card.deck || "";
}

async function deleteCard(id) {
    if (confirm("Bạn có chắc chắn muốn xóa từ này khỏi kho dữ liệu không?")) {
        await deleteCardFromDB(id);
        await renderWordsList();
    }
}

function clearForm() {
    document.getElementById("form-id").value = "";
    document.getElementById("form-word").value = "";
    document.getElementById("form-ipa").value = "";
    document.getElementById("form-meaning").value = "";
    document.getElementById("form-example").value = "";
    document.getElementById("form-deck").value = "";
}

async function renderWordsList() {
    // 1. Lấy chuỗi từ khóa tìm kiếm người dùng nhập vào (nếu có)
    const searchInput = document.getElementById("search-word-input");
    const keyword = searchInput ? searchInput.value.trim().toLowerCase() : "";
    
    // 2. Lấy toàn bộ kho từ vựng từ cơ sở dữ liệu IndexedDB
    let cards = await getAllCards();
    const listEl = document.getElementById("words-list");
    if (!listEl) return;
    listEl.innerHTML = "";

    // 3. BỘ LỌC CHỦ ĐỀ: Nếu đang chọn một chủ đề cụ thể, chỉ lấy từ của chủ đề đó
    if (typeof currentSelectedDeck !== "undefined" && currentSelectedDeck !== "all") {
        cards = cards.filter(c => c.deck === currentSelectedDeck);
    }

    // 4. BỘ LỌC TÌM KIẾM: Nếu người dùng có gõ từ khóa, lọc theo Từ gốc, Phiên âm hoặc Giải nghĩa
    if (keyword) {
        cards = cards.filter(card => {
            const word = (card.word || "").toLowerCase();
            const ipa = (card.ipa || "").toLowerCase();
            const meaning = (card.meaning || "").toLowerCase();
            const deck = (card.deck || "").toLowerCase();
            
            return word.includes(keyword) || 
                   ipa.includes(keyword) || 
                   meaning.includes(keyword) ||
                   deck.includes(keyword);
        });
    }

    // 5. Nếu sau khi lọc không tìm thấy từ nào, hiển thị thông báo
    if (cards.length === 0) {
        listEl.innerHTML = `<li style="text-align: center; color: var(--text-sub); justify-content: center; padding: 20px;">🔍 Không tìm thấy từ vựng nào khớp với từ khóa.</li>`;
        return;
    }

    // 6. Vẽ danh sách từ vựng ra giao diện HTML như cũ
    cards.forEach(card => {
        const deckTag = card.deck ? `<span style="font-size:0.7rem; background:#e1bee7; color:#6a1b9a; padding:2px 6px; border-radius:4px; margin-left:5px; font-weight: bold;">${card.deck}</span>` : '';
        const li = document.createElement("li");
        li.innerHTML = `
            <div>
                <strong>${card.word}</strong> <small>${card.ipa || ''}</small> ${deckTag}
                <div style="font-size: 0.9rem; color: var(--text-sub); margin-top: 2px;">${card.meaning}</div>
            </div>
            <div class="list-actions">
                <button class="btn-edit" onclick="editCard(${card.id})">✏️</button>
                <button class="btn-delete" onclick="deleteCard(${card.id})">🗑️</button>
            </div>
        `;
        listEl.appendChild(li);
    });
}

// 7. QUẢN LÝ DANH SÁCH TỪ ĐÃ ĐÁNH DẤU SAO
async function renderStarredList() {
    const cards = await getAllCards();
    const starredListEl = document.getElementById("starred-words-list");
    starredListEl.innerHTML = "";

    const starredCards = cards.filter(card => card.isStarred);

    if (starredCards.length === 0) {
        starredListEl.innerHTML = "<p style='color: var(--text-sub); text-align:center; padding: 20px;'>Bạn chưa có từ vựng nào được đánh dấu sao.</p>";
        return;
    }

    starredCards.forEach(card => {
        const li = document.createElement("li");
        li.innerHTML = `
            <div>
                <strong>${card.word}</strong> <small>${card.ipa || ''}</small>
                <div style="font-size:0.85rem; color:var(--text-sub); margin-top:2px;">${card.meaning}</div>
            </div>
            <div class="list-actions">
                <button class="btn-delete" style="background:#ffeaa7; color:#d35400;" onclick="unstarFromList(${card.id})">⭐ Bỏ sao</button>
            </div>
        `;
        starredListEl.appendChild(li);
    });
}

async function unstarFromList(id) {
    const card = await getCardById(id);
    if (card) {
        card.isStarred = false;
        await updateCardInDB(card);
        await renderStarredList();
    }
}

// 8. TƯƠNG TÁC INDEXEDDB CORE
function getAllCards() {
    return new Promise(r => {
        const store = db.transaction("cards", "readonly").objectStore("cards");
        store.getAll().onsuccess = e => r(e.target.result);
    });
}
function getCardById(id) {
    return new Promise(r => {
        const store = db.transaction("cards", "readonly").objectStore("cards");
        store.get(id).onsuccess = e => r(e.target.result);
    });
}
function addCardToDB(card) {
    return new Promise(r => {
        db.transaction("cards", "readwrite").objectStore("cards").add(card).onsuccess = () => r();
    });
}
function updateCardInDB(card) {
    return new Promise(r => {
        db.transaction("cards", "readwrite").objectStore("cards").put(card).onsuccess = () => r();
    });
}
function deleteCardFromDB(id) {
    return new Promise(r => {
        db.transaction("cards", "readwrite").objectStore("cards").delete(id).onsuccess = () => r();
    });
}

// 9. IMPORT / EXPORT DỮ LIỆU FILE JSON
function triggerImport() { document.getElementById("import-file").click(); }
async function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const cards = JSON.parse(e.target.result);
            for (let card of cards) {
                delete card.id; // Để DB tự cấp ID tăng tự động mới cho máy hiện tại
                card.nextReview = card.nextReview || Date.now();
                card.interval = card.interval || 0;
                await addCardToDB(card);
            }
            alert("Import kho dữ liệu thành công!");
            switchTab('study');
        } catch (err) { alert("File đính kèm JSON không đúng định dạng!"); }
    };
    reader.readAsText(file);
}
async function exportData() {
    const cards = await getAllCards();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cards, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "flashcards_backup.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

// --- LOGIC CHUYỂN ĐỔI GIAO DIỆN SÁNG / TỐI (DARK MODE) ---
function toggleTheme() {
    const isDark = document.body.classList.toggle("dark-theme");
    // Lưu lựa chọn của người dùng vào LocalStorage để lần sau mở app tự nhớ
    localStorage.setItem("theme", isDark ? "dark" : "light");
}

// Hàm tự động kiểm tra cài đặt giao diện cũ khi vừa mở App
function applySavedTheme() {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
        document.body.classList.add("dark-theme");
    }
}

// Gọi hàm kiểm tra giao diện ngay khi file JS được load
applySavedTheme();

// --- LOGIC TỰ ĐỘNG TRA TỪ VÀ ĐIỀN NHANH (QUICK FILL / AUTO-SUGGEST) ---
async function autoSuggestWord() {
    const wordInput = document.getElementById("form-word").value.trim();
    const btnSearch = document.querySelector(".btn-search");

    if (!wordInput) {
        alert("Vui lòng nhập từ tiếng Anh cần tra trước!");
        return;
    }

    // Hiển thị trạng thái đang tải dữ liệu để người dùng biết
    btnSearch.innerText = "⏳ Đang tra...";
    btnSearch.disabled = true;

    try {
        // 1. Gọi API lấy phát âm IPA và Ví dụ câu (Free Dictionary API)
        const dictResponse = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(wordInput)}`);
        
        // 2. Gọi API Dịch nghĩa sang Tiếng Việt (MyMemory Translate API - Tốc độ cao, miễn phí)
        const transResponse = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(wordInput)}&langpair=en|vi`);

        let ipa = "";
        let example = "";
        let meaning = "";

        // Xử lý dữ liệu từ điển (IPA & Ví dụ)
        if (dictResponse.ok) {
            const dictData = await dictResponse.json();
            const entry = dictData[0];

            // Lấy phiên âm IPA
            if (entry.phonetic) {
                ipa = entry.phonetic;
            } else if (entry.phonetics && entry.phonetics.length > 0) {
                // Tìm kiếm trong mảng phonetics nếu thuộc tính phonetic ở trên trống
                const validIpa = entry.phonetics.find(p => p.text);
                if (validIpa) ipa = validIpa.text;
            }

            // Tìm kiếm 1 câu ví dụ mẫu ngắn trong các tầng nghĩa
            if (entry.meanings) {
                for (let m of entry.meanings) {
                    if (m.definitions) {
                        const defWithExample = m.definitions.find(d => d.example);
                        if (defWithExample) {
                            example = defWithExample.example;
                            break;
                        }
                    }
                }
            }
        }

        // Xử lý dữ liệu dịch thuật (Nghĩa tiếng Việt)
        if (transResponse.ok) {
            const transData = await transResponse.json();
            if (transData.responseData && transData.responseData.translatedText) {
                meaning = transData.responseData.translatedText;
                // Chuẩn hóa chữ cái đầu thành chữ thường cho đẹp nếu cần
                meaning = meaning.replace(/^\w/, c => c.toLowerCase());
            }
        }

        // 3. Điền tự động vào các ô nhập liệu trên giao diện
        if (ipa) document.getElementById("form-ipa").value = ipa;
        if (meaning) document.getElementById("form-meaning").value = meaning;
        if (example) document.getElementById("form-example").value = example;

        if (!ipa && !meaning && !example) {
            alert("Không tìm thấy dữ liệu tự động cho từ này. Bạn hãy tự điền nhé!");
        }

    } catch (error) {
        console.error("Lỗi kết nối mạng hoặc API:", error);
        alert("Có lỗi xảy ra khi tra từ tự động. Vui lòng kiểm tra kết nối mạng!");
    } finally {
        // Trả lại trạng thái ban đầu cho nút bấm
        btnSearch.innerText = "🔍 Tra nhanh";
        btnSearch.disabled = false;
    }

    // Đăng ký Service Worker để chạy ứng dụng trên điện thoại (PWA)
    if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker đã sẵn sàng!', reg.scope))
            .catch(err => console.log('Lỗi đăng ký Service Worker:', err));
    });
    }
}