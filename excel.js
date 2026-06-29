// --- HỆ THỐNG XUẤT/NHẬP DỮ LIỆU BẰNG EXCEL (CSV SUPPORT) ---

// 1. HÀM NHẬP FILE EXCEL (CSV)
function handleCSVImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
        const text = e.target.result;
        const lines = text.split("\n");
        let addedCount = 0;

        // Bỏ qua dòng tiêu đề đầu tiên (Từ, Phiên âm, Nghĩa, Ví dụ, Chủ đề)
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Tách các cột dựa trên dấu phẩy (Cơ chế phân tách CSV đơn giản)
            // Hỗ trợ xử lý nếu các cột được bọc trong dấu ngoặc kép ""
            const columns = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);

            if (columns.length >= 3) {
                const word = columns[0].replace(/^"|"$/g, '').trim();
                const ipa = columns[1].replace(/^"|"$/g, '').trim();
                const meaning = columns[2].replace(/^"|"$/g, '').trim();
                const example = columns[3] ? columns[3].replace(/^"|"$/g, '').trim() : "";
                const deck = columns[4] ? columns[4].replace(/^"|"$/g, '').trim() : "Chung";

                if (word && meaning) {
                    const newCard = {
                        id: "word_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
                        word: word,
                        ipa: ipa,
                        meaning: meaning,
                        example: example,
                        deck: deck,
                        interval: 0,
                        nextReview: Date.now(),
                        isStarred: false
                    };
                    
                    // Thêm vào cơ sở dữ liệu IndexedDB
                    await updateCardInDB(newCard);
                    addedCount++;
                }
            }
        }

        alert(`🎉 Đã nhập thành công ${addedCount} từ vựng từ file Excel!`);
        
        // Tải lại toàn bộ giao diện app để cập nhật dữ liệu mới
        if (typeof refreshQueue === "function") refreshQueue();
        if (typeof initDecks === "function") initDecks();
    };
    
    reader.readAsText(file, "UTF-8");
}

// 2. HÀM XUẤT FILE EXCEL (CSV)
async function exportToCSV() {
    if (typeof getAllCards !== "function") return;
    const cards = await getAllCards();

    if (cards.length === 0) {
        alert("Kho từ vựng của bạn đang trống, không có gì để xuất!");
        return;
    }

    // Tạo tiêu đề cột cho file Excel (Bổ sung dấu BOM \uFEFF để Excel không lỗi font tiếng Việt)
    let csvContent = "\uFEFFTừ,Phiên âm,Định nghĩa,Ví dụ câu,Chủ đề\n";

    cards.forEach(card => {
        // Bọc dữ liệu trong dấu ngoặc kép để tránh lỗi nếu nội dung chứa dấu phẩy ngẫu nhiên
        const word = `"${card.word.replace(/"/g, '""')}"`;
        const ipa = `"${(card.ipa || '').replace(/"/g, '""')}"`;
        const meaning = `"${card.meaning.replace(/"/g, '""')}"`;
        const example = `"${(card.example || '').replace(/"/g, '""')}"`;
        const deck = `"${(card.deck || 'Chung').replace(/"/g, '""')}"`;

        csvContent += `${word},${ipa},${meaning},${example},${deck}\n`;
    });

    // Tạo file tải về
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `Kho_Tu_Vung_SRS_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}