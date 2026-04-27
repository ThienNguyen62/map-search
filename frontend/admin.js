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
      contentArea.innerHTML = `
        <div class="users-section">
          <div class="section-header">
            <h3>Danh sách người dùng và lịch sử hoạt động</h3>
            <button class="refresh-btn" onclick="loadUserData()">🔄 Làm mới</button>
          </div>
          <div class="loading" id="usersLoading">Đang tải dữ liệu...</div>
          <div class="error-message" id="usersError"></div>
          <div id="usersContent"></div>
        </div>
      `;
      loadUserData();
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

// Load user data and login history
async function loadUserData() {
  const loading = document.getElementById("usersLoading");
  const error = document.getElementById("usersError");
  const content = document.getElementById("usersContent");

  if (!loading || !error || !content) return;

  loading.style.display = "block";
  error.style.display = "none";
  content.innerHTML = "";

  try {
    // Load users
    const usersResponse = await fetch("http://127.0.0.1:5000/api/auth/users");
    const usersData = await usersResponse.json();

    if (!usersResponse.ok) {
      throw new Error(usersData.error || "Không thể tải danh sách người dùng");
    }

    // Load login history (assuming this endpoint exists)
    const historyResponse = await fetch(
      "http://127.0.0.1:5000/api/auth/login-history",
    );
    const historyData = await historyResponse.json();

    loading.style.display = "none";

    renderUsersSection(usersData.users || [], historyData.history || []);
  } catch (err) {
    loading.style.display = "none";
    error.textContent = err.message || "Không thể kết nối tới server";
    error.style.display = "block";
  }
}

// Render users section with activity history
function renderUsersSection(users, loginHistory) {
  const content = document.getElementById("usersContent");
  if (!content) return;

  // Group login history by user
  const userActivity = {};
  loginHistory.forEach((entry) => {
    if (!userActivity[entry.username]) {
      userActivity[entry.username] = [];
    }
    userActivity[entry.username].push(entry);
  });

  const userRows = users
    .map((user) => {
      const userLogins = userActivity[user.username] || [];
      const lastLogin = userLogins.length > 0 ? userLogins[0] : null;
      const totalLogins = userLogins.length;

      return `
      <tr>
        <td>${user.id}</td>
        <td>${user.username}</td>
        <td>${user.email}</td>
        <td>${user.first_name} ${user.last_name}</td>
        <td>${user.phone || "-"}</td>
        <td><span class="status ${user.role}">${user.role}</span></td>
        <td>${totalLogins}</td>
        <td>${lastLogin ? new Date(lastLogin.timestamp).toLocaleString("vi-VN") : "Chưa đăng nhập"}</td>
        <td>${new Date(user.created_at).toLocaleString("vi-VN")}</td>
        <td>
          <button class="view-history-btn" onclick="showUserHistory('${user.username}')">
            📋 Xem lịch sử
          </button>
        </td>
      </tr>
    `;
    })
    .join("");

  content.innerHTML = `
    <div class="users-table-container">
      <table class="users-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Tên người dùng</th>
            <th>Email</th>
            <th>Họ tên</th>
            <th>Điện thoại</th>
            <th>Vai trò</th>
            <th>Tổng đăng nhập</th>
            <th>Đăng nhập cuối</th>
            <th>Ngày tạo</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${userRows}
        </tbody>
      </table>
    </div>

    <!-- User History Modal -->
    <div id="userHistoryModal" class="modal" style="display: none;">
      <div class="modal-content">
        <div class="modal-header">
          <h3 id="modalTitle">Lịch sử hoạt động</h3>
          <span class="close-modal" onclick="closeUserHistoryModal()">&times;</span>
        </div>
        <div id="modalBody" class="modal-body">
          <!-- History content will be loaded here -->
        </div>
      </div>
    </div>
  `;
}

// Show user login history in modal
function showUserHistory(username) {
  const modal = document.getElementById("userHistoryModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalBody = document.getElementById("modalBody");

  if (!modal || !modalTitle || !modalBody) return;

  modalTitle.textContent = `Lịch sử đăng nhập - ${username}`;
  modalBody.innerHTML = `<div class="loading">Đang tải lịch sử...</div>`;
  modal.style.display = "block";

  // Load user-specific history
  fetch(`http://127.0.0.1:5000/api/auth/user-history/${username}`)
    .then((response) => response.json())
    .then((data) => {
      if (data.history && data.history.length > 0) {
        const historyRows = data.history
          .map(
            (entry) => `
          <tr>
            <td>${new Date(entry.timestamp).toLocaleString("vi-VN")}</td>
            <td>${entry.ip_address || "N/A"}</td>
            <td>${entry.user_agent ? entry.user_agent.substring(0, 50) + "..." : "N/A"}</td>
            <td><span class="status success">Thành công</span></td>
          </tr>
        `,
          )
          .join("");

        modalBody.innerHTML = `
          <div class="history-table-container">
            <table class="history-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>IP Address</th>
                  <th>Thiết bị</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                ${historyRows}
              </tbody>
            </table>
          </div>
        `;
      } else {
        modalBody.innerHTML = `<p>Không có lịch sử đăng nhập nào cho người dùng này.</p>`;
      }
    })
    .catch((err) => {
      modalBody.innerHTML = `<div class="error-message">Không thể tải lịch sử: ${err.message}</div>`;
    });
}

// Close user history modal
function closeUserHistoryModal() {
  const modal = document.getElementById("userHistoryModal");
  if (modal) {
    modal.style.display = "none";
  }
}
