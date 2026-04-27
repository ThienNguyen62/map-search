// Kiểm tra xem có phải Admin đã đăng nhập không
window.addEventListener("load", function () {
  const isAdmin = true; // Thực tế bạn nên check Token ở localStorage
  if (!isAdmin) {
    alert("Bạn không có quyền truy cập!");
    window.location.href = "login.html";
  }
});

// Chuyển đổi nội dung các mục quản lý
function showSection(section) {
  const contentArea = document.getElementById("content-area");
  const sectionTitle = document.getElementById("section-title");

  // Cập nhật class Active cho sidebar
  document.querySelectorAll(".sidebar-nav li").forEach((li) => {
    li.classList.remove("active");
  });
  event.currentTarget.classList.add("active");

  switch (section) {
    case "overview":
      sectionTitle.innerText = "Tổng quan hệ thống";
      contentArea.innerHTML = `
                <div class="stats-grid">
                    <div class="stat-card"><h3>Tổng ga tàu</h3><p class="stat-number">150</p></div>
                    <div class="stat-card"><h3>Tuyến đang chạy</h3><p class="stat-number">8</p></div>
                    <div class="stat-card"><h3>Yêu cầu hỗ trợ</h3><p class="stat-number">2</p></div>
                </div>`;
      break;
    case "stations":
      sectionTitle.innerText = "Quản lý ga tàu";
      contentArea.innerHTML = `
                <div class="stat-card">
                    <p>Danh sách các ga tàu điện ngầm Munich sẽ hiển thị ở đây...</p>
                    <button style="margin-top:20px; padding: 10px; cursor:pointer;">+ Thêm ga mới</button>
                </div>`;
      break;
    case "users":
      sectionTitle.innerText = "Quản lý người dùng";
      contentArea.innerHTML = `<p>Đang tải danh sách người dùng...</p>`;
      // Gọi fetch API lấy user từ Flask tại đây
      break;
  }
}

// Đăng xuất
function handleLogout() {
  if (confirm("Bạn có chắc chắn muốn đăng xuất?")) {
    localStorage.removeItem("adminToken"); // Xóa dữ liệu phiên làm việc
    window.location.href = "login.html";
  }
}
