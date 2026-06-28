// --- HỆ THỐNG TÌM KIẾM & BỘ LỌC TỪ VỰNG NHANH ---

function handleSearchInput() {
    const keyword = document.getElementById("search-word-input").value.trim().toLowerCase();
    const listItems = document.querySelectorAll("#words-list li");

    if (listItems.length === 0) return;

    listItems.forEach(li => {
        // Lấy toàn bộ nội dung text bên trong thẻ li (gồm cả từ, phiên âm, nghĩa)
        const textContent = li.textContent.toLowerCase();

        // Nếu nội dung chứa từ khóa tìm kiếm thì hiện, không thì ẩn đi
        if (textContent.includes(keyword)) {
            li.style.display = ""; // Hiển thị lại bình quanh
        } else {
            li.style.display = "none"; // Ẩn khỏi giao diện
        }
    });
}

// Hàm bổ trợ xóa nhanh ô tìm kiếm (Clear Search)
function clearSearch() {
    const searchInput = document.getElementById("search-word-input");
    if (searchInput) {
        searchInput.value = "";
        handleSearchInput(); // Trả lại danh sách đầy đủ
    }
}