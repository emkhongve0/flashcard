// ==========================================
// ☁️ KHỞI TẠO ĐỒNG BỘ CLOUD FIREBASE TRỰC TUYẾN
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCT3kTdui6BAuMLmOw0dQYZ7i0lpHYXw5k",
  authDomain: "flashcardsrs-75036.firebaseapp.com",
  databaseURL: "https://flashcardsrs-75036-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "flashcardsrs-75036",
  storageBucket: "flashcardsrs-75036.firebasestorage.app",
  messagingSenderId: "433045822063",
  appId: "1:433045822063:web:09362659c1e580872acb9a",
  measurementId: "G-9H2GQJKN8S"
};

// Khởi tạo Firebase bằng SDK Compat nhúng từ CDN index.html
firebase.initializeApp(firebaseConfig);
const rtdb = firebase.database();

// Hàm đẩy dữ liệu tự động từ IndexedDB lên Cloud (Âm thầm chạy nền khi Thêm/Sửa/Xóa)
async function syncLocalToCloud() {
    try {
        if (typeof getAllCards === "function") {
            const localCards = await getAllCards();
            await rtdb.ref("my_flashcards").set(localCards);
            console.log("☁️ Đã sao lưu đồng bộ lên Cloud Firebase thành công!");
        }
    } catch (error) {
        console.error("Lỗi đồng bộ Cloud:", error);
    }
}

// Hàm khôi phục dữ liệu từ đám mây về máy (Chỉ chạy khi người dùng chủ động bấm nút)
async function pullCloudToLocal() {
    try {
        const snapshot = await rtdb.ref("my_flashcards").once("value");
        const cloudCards = snapshot.val();
        if (cloudCards && Array.isArray(cloudCards)) {
            if (confirm(`Tìm thấy ${cloudCards.length} từ vựng trên đám mây. Bạn có chắc muốn ghi đè lên thiết bị này không?`)) {
                const tx = db.transaction("cards", "readwrite");
                const store = tx.objectStore("cards");
                store.clear();
                
                for (let card of cloudCards) {
                    if (card) store.add(card);
                }
                
                alert("🎉 Đã khôi phục thành công " + cloudCards.length + " từ vựng từ đám mây!");
                window.location.reload();
            }
        } else {
            alert("Không tìm thấy dữ liệu sao lưu nào trên đám mây.");
        }
    } catch (error) {
        alert("Lỗi tải dữ liệu từ đám mây: " + error.message);
    }
}

// ==========================================
// 1. KHỞI TẠO CƠ SỞ DỮ LIỆU INDEXEDDB OFFLINE (GIỮ NGUYÊN GIÁ TRỊ GỐC)
// ==========================================
const DB_NAME = "FlashcardSRS_DB";
let db;

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
    await refreshQueue();
    await renderWordsList();
}

// ==========================================
// 2. LOGIC ĐIỀU HƯỚNG TABS (BẢO TOÀN TẤT CẢ LIÊN KẾT NGOÀI)
// ==========================================
function switchTab(tabName) {
    if (typeof stopAutoPlay === "function") stopAutoPlay();
    
    document.getElementById("tab-study").classList.toggle("hidden", tabName !== 'study');
    document.getElementById("tab-manage").classList.toggle("hidden", tabName !== 'manage');
    document.getElementById("tab-starred").classList.toggle("hidden", tabName !== 'starred');
    document.getElementById("tab-analytics").classList.toggle("hidden", tabName !== 'analytics');
    document.getElementById("tab-quiz").classList.toggle("hidden", tabName !== 'quiz');
    
    document.getElementById("nav-study").classList.toggle("active", tabName === 'study');
    document.getElementById("nav-starred").classList.toggle("active", tabName === 'starred');
    document.getElementById("nav-manage").classList.toggle("active", tabName === 'manage');
    document.getElementById("nav-analytics").classList.toggle("active", tabName === 'analytics');
    document.getElementById("nav-quiz").classList.toggle("active", tabName === 'quiz');
    
    if (tabName === 'manage') renderWordsList();
    if (tabName === 'starred') renderStarredList();
    if (tabName === 'analytics') initAnalytics();
    if (tabName === 'quiz') initQuiz(); 
    if (tabName === 'study') refreshQueue();
    
    document.getElementById("settings-panel").classList.add("hidden");
}

function toggleSettingsPanel() {
    const panel = document.getElementById("settings-panel");
    panel.classList.toggle("hidden");
}

// ==========================================
// 3. TÍNH TOÁN HÀNG ĐỢI HỌC TỪ (ĐÃ ĐỒNG BỘ CHỦ ĐỀ VÀ TIẾN TRÌNH)
// ==========================================
async function refreshQueue() {
    let cards = await getAllCards();
    const now = Date.now();
    
    if (typeof currentSelectedDeck !== "undefined" && currentSelectedDeck !== "all") {
        cards = cards.filter(c => c.deck === currentSelectedDeck);
    }

    const savedQueue = localStorage.getItem("saved_review_queue");
    const savedCurrentCardId = localStorage.getItem("saved_current_card_id");
    const savedDeckContext = localStorage.getItem("saved_deck_context") || "all";

    if (savedQueue && savedDeckContext === (currentSelectedDeck || "all")) {
        try {
            reviewQueue = JSON.parse(savedQueue);
            isReviewMode = localStorage.getItem("saved_review_mode") === "true";
            
            if (savedCurrentCardId) {
                const numericId = Number(savedCurrentCardId);
                currentCard = cards.find(c => c.id === numericId || c.id === savedCurrentCardId) || reviewQueue[0];
            } else {
                currentCard = reviewQueue[0];
            }

            document.getElementById("review-count").innerText = isReviewMode ? reviewQueue.length : `Tự do (${reviewQueue.length})`;
            const masteredCount = cards.filter(c => c.interval >= 14).length;
            document.getElementById("mastered-count").innerText = masteredCount;

            renderCurrentCardState(); 
            return; 
        } catch (e) {
            console.error("Lỗi đồng bộ bộ nhớ, khởi tạo hàng đợi mới:", e);
        }
    }
    
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

function saveCurrentProgress() {
    localStorage.setItem("saved_review_queue", JSON.stringify(reviewQueue));
    localStorage.setItem("saved_current_card_id", currentCard ? currentCard.id : "");
    localStorage.setItem("saved_review_mode", isReviewMode);
    localStorage.setItem("saved_deck_context", currentSelectedDeck || "all");
}

// ==========================================
// 4. HIỂN THỊ TỪ TIẾP THEO LÊN GIAO DIỆN (CHẾ ĐỘ THƯỜNG / GÕ / ĐẢO CHIỀU)
// ==========================================
function showNextCard() {
    // 1. ÉP THẺ FLASHCARD XOAY VỀ MẶT TRƯỚC (TIẾNG ANH) TRƯỚC KHI HIỆN TỪ MỚI
    const cardEl = document.getElementById("flashcard");
    if (cardEl) {
        cardEl.classList.remove("is-flipped");
    }
    
    // 2. ẨN THANH ĐIỀU KHIỂN SRS (CHỈ HIỆN LẠI KHI NGƯỜI DÙNG BẤM LẬT THẺ)
    const controls = document.getElementById("controls");
    if (controls) {
        controls.classList.add("hidden");
    }
    if (reviewQueue.length === 0) {
        currentCard = null;
        localStorage.removeItem("saved_review_queue");
        localStorage.removeItem("saved_current_card_id");
    } else {
        currentCard = reviewQueue[0];
    }
    
    renderCurrentCardState();
    saveCurrentProgress(); 
}

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
    
    if (starBtn) {
        starBtn.style.display = "block";
        starBtn.innerText = currentCard.isStarred ? "★" : "☆";
        starBtn.className = currentCard.isStarred ? "star-icon active" : "star-icon";
    }

    if (document.getElementById("typing-input")) document.getElementById("typing-input").value = "";
    if (document.getElementById("typing-result")) document.getElementById("typing-result").innerText = "";

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
        if (typingArea) typingArea.classList.add("hidden");

        if (typeof isReverseMode !== "undefined" && isReverseMode === true) {
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

// ==========================================
// 5. ĐÁNH DẤU SAO VÀ LOGIC PHÁT ÂM (GIỌNG MỸ)
// ==========================================
async function toggleStar(event) {
    event.stopPropagation(); 
    if (!currentCard) return;
    currentCard.isStarred = !currentCard.isStarred;
    await updateCardInDB(currentCard);
    document.getElementById("star-btn").innerText = currentCard.isStarred ? "★" : "☆";
    document.getElementById("star-btn").className = currentCard.isStarred ? "star-icon active" : "star-icon";
}

function playAudio(event) {
    event.stopPropagation();
    if (!currentCard || !currentCard.word) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentCard.word);
    
    utterance.lang = 'en-US';
    utterance.rate = 0.9;  
    utterance.pitch = 1.0; 

    if (typeof window.speechSynthesis.getVoices === "function") {
        const voices = window.speechSynthesis.getVoices();
        let selectedVoice = voices.find(v => v.lang.includes('en-US') && (v.name.includes('Samantha') || v.name.includes('Siri')));
        
        if (!selectedVoice) {
            selectedVoice = voices.find(v => v.lang.includes('en-US'));
        }
        if (!selectedVoice) {
            selectedVoice = voices.find(v => v.lang.startsWith('en-'));
        }
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }
    }
    window.speechSynthesis.speak(utterance);
}

async function submitSRS(days) {
    if (!currentCard) return;
    
    currentCard.interval = days;
    currentCard.nextReview = Date.now() + (days * 24 * 60 * 60 * 1000);
    await updateCardInDB(currentCard);

    if (isReviewMode) {
        reviewQueue.shift(); 
    } else {
        const shifted = reviewQueue.shift();
        reviewQueue.push(shifted);
    }

    if (reviewQueue.length === 0) {
        await refreshQueue();
    } else {
        if (typeof currentSelectedDeck !== "undefined" && currentSelectedDeck !== "all" && reviewQueue[0].deck !== currentSelectedDeck) {
            await refreshQueue();
        } else {
            showNextCard();
        }
    }
}

// ==========================================
// 6. THAO TÁC QUẢN LÝ TỪ VỰNG (FORM THÊM / SỬA / XÓA)
// ==========================================
async function saveFormCard() {
    const id = document.getElementById("form-id").value;
    const word = document.getElementById("form-word").value.trim();
    const ipa = document.getElementById("form-ipa").value.trim();
    const meaning = document.getElementById("form-meaning").value.trim();
    const example = document.getElementById("form-example").value.trim();
    const deck = document.getElementById("form-deck").value.trim() || "Chung"; 

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
    document.querySelector(".form-container").scrollIntoView({ behavior: 'smooth' });
    document.getElementById("form-deck").value = card.deck || "";
}

async function deleteCard(id) {
    if (confirm("Bạn có chắc chắn muốn xóa từ này khỏi kho dữ liệu không?")) {
        await deleteCardFromDB(id);
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

let currentPage = 1;
const CARDS_PER_PAGE = 30; // Mỗi trang hiển thị tối đa 30 từ giúp điện thoại chạy siêu mượt

async function renderWordsList(resetToPageOne = false) {
    if (resetToPageOne) {
        currentPage = 1; // Khởi động lại về trang đầu nếu người dùng gõ tìm kiếm hoặc đổi bộ lọc
    }

    const searchInput = document.getElementById("search-word-input");
    const keyword = searchInput ? searchInput.value.trim().toLowerCase() : "";
    
    let cards = await getAllCards();
    const listEl = document.getElementById("words-list");
    const paginationEl = document.getElementById("pagination-container");
    
    if (!listEl) return;
    listEl.innerHTML = "";

    // 1. ÁP DỤNG BỘ LỌC CHỦ ĐỀ CŨ CỦA BẠN
    if (typeof currentSelectedDeck !== "undefined" && currentSelectedDeck !== "all") {
        cards = cards.filter(c => c.deck === currentSelectedDeck);
    }

    // 2. ÁP DỤNG BỘ LỌC TÌM KIẾM THEO TỪ KHÓA CŨ CỦA BẠN
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

    // Nếu không có từ nào, ẩn thanh phân trang đi và báo trống
    if (cards.length === 0) {
        listEl.innerHTML = `<li style="text-align: center; color: var(--text-sub); justify-content: center; padding: 20px;">🔍 Không tìm thấy từ vựng nào khớp với từ khóa.</li>`;
        if (paginationEl) paginationEl.innerHTML = "";
        return;
    }

    // 3. LOGIC XỬ LÝ PHÂN TRANG (PAGINATION CORNER)
    const totalCards = cards.length;
    const totalPages = Math.ceil(totalCards / CARDS_PER_PAGE);

    // Đảm bảo số trang hiện tại không vượt quá tổng số trang khi dữ liệu bị xóa bớt
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    // Cắt danh sách từ để chỉ lấy đúng số lượng của trang hiện tại
    const startIndex = (currentPage - 1) * CARDS_PER_PAGE;
    const endIndex = startIndex + CARDS_PER_PAGE;
    const cardsToDisplay = cards.slice(startIndex, endIndex);

    // 4. HIỂN THỊ CÁC TỪ VỰNG TRÊN TRANG HIỆN TẠI (ĐÃ TỐI ƯU CỐ ĐỊNH CHỦ ĐỀ DÀI)
    cardsToDisplay.forEach(card => {
        // Tối ưu tag chủ đề: cố định độ rộng tối đa, nếu dài quá tự động chuyển thành dấu 3 chấm (...)
        const deckTag = card.deck 
            ? `<span style="
                display: inline-block;
                max-width: 100px; 
                vertical-align: middle;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                font-size: 0.7rem; 
                background: #e1bee7; 
                color: #6a1b9a; 
                padding: 2px 6px; 
                border-radius: 4px; 
                margin-left: 5px; 
                font-weight: bold;
               " title="${card.deck}">${card.deck}</span>` 
            : '';

        const li = document.createElement("li");
        
        // Cấu hình flexbox cho dòng để chữ bên trái và nút bấm bên phải luôn cân xứng, không bị đẩy lệch
        li.style = "display: flex; justify-content: space-between; align-items: center; width: 100%; box-sizing: border-box;";
        
        li.innerHTML = `
            <div style="flex: 1; min-width: 0; padding-right: 10px;">
                <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 2px;">
                    <strong style="font-size: 1.05rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">${card.word}</strong>
                    <small style="color: var(--text-sub); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;">${card.ipa || ''}</small>
                    ${deckTag}
                </div>
                <div style="font-size: 0.9rem; color: var(--text-sub); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${card.meaning}</div>
            </div>
            <div class="list-actions" style="flex-shrink: 0; display: flex; gap: 5px;">
                <button class="btn-edit" onclick="editCard(${card.id})">✏️</button>
                <button class="btn-delete" onclick="deleteCard(${card.id})">🗑️</button>
            </div>
        `;
        listEl.appendChild(li);
    });

    // 5. TỰ ĐỘNG SINH GIAO DIỆN ĐIỀU HƯỚNG PHÂN TRANG (NÚT TRƯỚC/SAU VÀ SỐ TRANG)
    if (paginationEl) {
        paginationEl.innerHTML = "";
        if (totalPages <= 1) return; // Nếu chỉ có 1 trang thì không cần hiện thanh chuyển trang

        // Nút lùi lại (Trang trước)
        const prevBtn = document.createElement("button");
        prevBtn.innerText = "◀";
        prevBtn.disabled = currentPage === 1;
        prevBtn.style = `padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border); background: ${currentPage === 1 ? '#ccc' : 'var(--card-bg)'}; color: var(--text-main); cursor: pointer;`;
        prevBtn.onclick = () => { currentPage--; renderWordsList(); };
        paginationEl.appendChild(prevBtn);

        // Chữ hiển thị thông số trang (ví dụ: Trang 2 / 10)
        const pageInfo = document.createElement("span");
        pageInfo.innerText = `Trang ${currentPage} / ${totalPages}`;
        pageInfo.style = "font-weight: bold; color: var(--text-main); font-size: 0.95rem;";
        paginationEl.appendChild(pageInfo);

        // Nút tiến lên (Trang sau)
        const nextBtn = document.createElement("button");
        nextBtn.innerText = "▶";
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.style = `padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border); background: ${currentPage === totalPages ? '#ccc' : 'var(--card-bg)'}; color: var(--text-main); cursor: pointer;`;
        nextBtn.onclick = () => { currentPage++; renderWordsList(); };
        paginationEl.appendChild(nextBtn);
    }
}

// ==========================================
// 7. QUẢN LÝ DANH SÁCH TỪ ĐÃ ĐÁNH DẤU SAO
// ==========================================
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

// ==========================================
// 8. TƯƠNG TÁC INDEXEDDB CORE - TÍCH HỢP ĐẨY TỰ ĐỘNG LÊN CLOUD
// ==========================================
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
        db.transaction("cards", "readwrite").objectStore("cards").add(card).onsuccess = () => {
            syncLocalToCloud(); // <-- Tự động đồng bộ lên mạng khi Thêm từ
            r();
        };
    });
}
function updateCardInDB(card) {
    return new Promise(r => {
        db.transaction("cards", "readwrite").objectStore("cards").put(card).onsuccess = () => {
            syncLocalToCloud(); // <-- Tự động đồng bộ lên mạng khi Sửa/Ôn tập từ
            r();
        };
    });
}
function deleteCardFromDB(id) {
    return new Promise(r => {
        db.transaction("cards", "readwrite").objectStore("cards").delete(id).onsuccess = () => {
            syncLocalToCloud(); // <-- Tự động đồng bộ lên mạng khi Xóa từ
            r();
        };
    });
}

// ==========================================
// 9. IMPORT / EXPORT DỮ LIỆU FILE JSON TRUYỀN THỐNG
// ==========================================
function triggerImport() { document.getElementById("import-file").click(); }
async function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const cards = JSON.parse(e.target.result);
            for (let card of cards) {
                delete card.id; 
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

// ==========================================
// 10. LOGIC CHUYỂN ĐỔI GIAO DIỆN SÁNG / TỐI (DARK MODE)
// ==========================================
function toggleTheme() {
    const isDark = document.body.classList.toggle("dark-theme");
    localStorage.setItem("theme", isDark ? "dark" : "light");
}

function applySavedTheme() {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
        document.body.classList.add("dark-theme");
    }
}
applySavedTheme();

// ==========================================
// 11. LOGIC TỰ ĐỘNG TRA TỪ VÀ ĐIỀN NHANH (QUICK FILL / SERVICE WORKER)
// ==========================================
async function autoSuggestWord() {
    const wordInput = document.getElementById("form-word").value.trim();
    const btnSearch = document.querySelector(".btn-search");

    if (!wordInput) {
        alert("Vui lòng nhập từ tiếng Anh cần tra trước!");
        return;
    }

    btnSearch.innerText = "⏳ Đang tra...";
    btnSearch.disabled = true;

    try {
        const dictResponse = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(wordInput)}`);
        const transResponse = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(wordInput)}&langpair=en|vi`);

        let ipa = "";
        let example = "";
        let meaning = "";

        if (dictResponse.ok) {
            const dictData = await dictResponse.json();
            const entry = dictData[0];

            if (entry.phonetic) {
                ipa = entry.phonetic;
            } else if (entry.phonetics && entry.phonetics.length > 0) {
                const validIpa = entry.phonetics.find(p => p.text);
                if (validIpa) ipa = validIpa.text;
            }

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

        if (transResponse.ok) {
            const transData = await transResponse.json();
            if (transData.responseData && transData.responseData.translatedText) {
                meaning = transData.responseData.translatedText;
                meaning = meaning.replace(/^\w/, c => c.toLowerCase());
            }
        }

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
        btnSearch.innerText = "🔍 Tra nhanh";
        btnSearch.disabled = false;
    }

    // Thay thế đoạn đăng ký Service Worker cũ ở cuối file bằng đoạn này:
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => {
                console.log('Service Worker đã sẵn sàng!', reg.scope);
                
                // 🔥 LOGIC TỰ ĐỘNG PHÁT HIỆN CODE MỚI TRÊN GITHUB VÀ ÉP REFRESH TRÊN IPHONE
                reg.onupdatefound = () => {
                    const installingWorker = reg.installing;
                    if (installingWorker == null) return;
                    installingWorker.onstatechange = () => {
                        if (installingWorker.state === 'installed') {
                            if (navigator.serviceWorker.controller) {
                                // Nếu phát hiện có code mới vừa được deploy lên GitHub
                                console.log('Đã có phiên bản mới, đang tự động cập nhật...');
                                setTimeout(() => {
                                    window.location.reload(); // Tự động làm mới trang để ăn code mới
                                }, 500);
                            }
                        }
                    };
                };
            })
            .catch(err => console.log('Lỗi đăng ký Service Worker:', err));
        });
    
    }
}
