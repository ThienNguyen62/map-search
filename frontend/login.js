let currentRole = "user"; // 'user' or 'admin'

// Khởi tạo sự kiện Submit cho form
document.getElementById("loginForm").addEventListener("submit", function (e) {
  e.preventDefault();
  handleLogin();
});

// Chuyển đổi giữa chế độ Người dùng và Admin
function switchRole(role) {
  currentRole = role;

  // Cập nhật giao diện nút tab
  document.querySelectorAll(".role-tab-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  document.querySelector(`[data-role="${role}"]`).classList.add("active");

  // Ẩn/Hiện các trường thông tin tùy theo role
  const emailGroup = document.getElementById("emailGroup");
  const emailInput = document.getElementById("email");
  const signupLink = document.querySelector(".signup-link");

  if (role === "admin") {
    emailGroup.style.display = "none";
    emailInput.removeAttribute("required");
    signupLink.style.display = "none";
  } else {
    emailGroup.style.display = "block";
    emailInput.setAttribute("required", "");
    signupLink.style.display = "block";
  }

  // Reset form và xóa thông báo cũ
  document.getElementById("loginForm").reset();
  clearMessages();
}

// Xử lý logic đăng nhập
function handleLogin() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  clearMessages();

  // Validate cơ bản
  if (!username) {
    showError("Vui lòng nhập tên người dùng");
    return;
  }

  if (password.length < 6) {
    showError("Mật khẩu phải có ít nhất 6 ký tự");
    return;
  }

  if (currentRole === "user") {
    const email = document.getElementById("email").value.trim();
    if (!email) {
      showError("Vui lòng nhập email");
      return;
    }
    if (!isValidEmail(email)) {
      showError("Email không hợp lệ");
      return;
    }
  }

  showLoading(true);

  const payload = {
    username: username,
    password: password,
    role: currentRole,
  };

  if (currentRole === "user") {
    payload.email = document.getElementById("email").value.trim();
  }

  // Gọi API tới Backend Flask
  fetch("http://127.0.0.1:5000/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
    .then(async (response) => {
      const data = await response.json();
      showLoading(false);

      if (!response.ok) {
        showError(data.error || "Đăng nhập thất bại");
        return;
      }

      // Xử lý khi đăng nhập thành công
      if (currentRole === "user") {
        const rememberMe = document.getElementById("rememberMe").checked;
        if (rememberMe) {
          localStorage.setItem(
            "rememberMe",
            JSON.stringify({
              username: username,
              email: payload.email,
            }),
          );
        } else {
          localStorage.removeItem("rememberMe");
        }
        showSuccess("Đăng nhập thành công! Đang chuyển hướng...");
        setTimeout(() => {
          window.location.href = "index.html"; // Chuyển sang trang bản đồ
        }, 1500);
      } else {
        localStorage.removeItem("rememberMe");
        showSuccess("Đăng nhập Admin thành công!");
        setTimeout(() => {
          window.location.href = "admin.html";
        }, 1500);
      }
    })
    .catch(() => {
      showLoading(false);
      showError(
        "Không thể kết nối tới server. Hãy kiểm tra backend đang chạy cổng 5000.",
      );
    });
}

// Kiểm tra định dạng email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Hiển thị thông báo lỗi
function showError(message) {
  const errorDiv = document.getElementById("errorMessage");
  errorDiv.textContent = message;
  errorDiv.classList.add("show");
}

// Hiển thị thông báo thành công
function showSuccess(message) {
  const successDiv = document.getElementById("successMessage");
  successDiv.textContent = message;
  successDiv.classList.add("show");
}

// Xóa các thông báo
function clearMessages() {
  document.getElementById("errorMessage").classList.remove("show");
  document.getElementById("successMessage").classList.remove("show");
}

// Hiệu ứng loading cho nút bấm
function showLoading(show) {
  const loading = document.getElementById("loading");
  const button = document.querySelector(".login-btn");

  if (show) {
    loading.classList.add("show");
    button.disabled = true;
  } else {
    loading.classList.remove("show");
    button.disabled = false;
  }
}

function handleForgotPassword(e) {
  e.preventDefault();
  alert('Tính năng "Quên mật khẩu" sẽ được triển khai sớm!');
}

function handleSignUp(e) {
  e.preventDefault();
  window.location.href = "signup.html";
}

// Tự động điền thông tin nếu trước đó có chọn "Nhớ mật khẩu"
window.addEventListener("load", function () {
  const saved = localStorage.getItem("rememberMe");
  if (saved) {
    const data = JSON.parse(saved);
    document.getElementById("username").value = data.username;
    document.getElementById("email").value = data.email;
    document.getElementById("rememberMe").checked = true;
  }
});
