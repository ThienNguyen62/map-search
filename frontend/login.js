let currentRole = "user"; // 'user' or 'admin'

// Handle form submission
document.getElementById("loginForm").addEventListener("submit", function (e) {
  e.preventDefault();
  handleLogin();
});

function switchRole(role) {
  currentRole = role;

  // Update button styling
  document.querySelectorAll(".role-tab-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  document.querySelector(`[data-role="${role}"]`).classList.add("active");

  // Update form fields visibility
  if (role === "admin") {
    document.getElementById("emailGroup").style.display = "none";
    document.getElementById("email").removeAttribute("required");
    document.querySelector(".signup-link").style.display = "none";
  } else {
    document.getElementById("emailGroup").style.display = "block";
    document.getElementById("email").setAttribute("required", "");
    document.querySelector(".signup-link").style.display = "block";
  }

  // Clear form
  document.getElementById("loginForm").reset();
  clearMessages();
}

function handleLogin() {
  console.log("handleLogin called, currentRole:", currentRole);
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  // Clear messages
  clearMessages();

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

  fetch("http://127.0.0.1:5000/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
    .then(async (response) => {
      const data = await response.json();
      console.log("Login response:", response.status, data);
      showLoading(false);
      if (!response.ok) {
        showError(data.error || "Đăng nhập thất bại");
        return;
      }

      if (currentRole === "user") {
        console.log("User login successful, redirecting to index.html");
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
        showSuccess("Đăng nhập thành công (Người dùng)! Đang chuyển hướng...");
        console.log("Redirecting to index.html now...");
        window.location.replace("index.html");
      } else {
        console.log("Admin login successful, redirecting to admin.html");
        localStorage.removeItem("rememberMe");
        showSuccess("Đăng nhập thành công (Admin)! Đang chuyển hướng...");
        console.log("Redirecting to admin.html now...");
        window.location.replace("admin.html");
      }
    })
    .catch(() => {
      showLoading(false);
      showError("Không thể kết nối tới server. Hãy kiểm tra backend.");
    });
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function showError(message) {
  const errorDiv = document.getElementById("errorMessage");
  errorDiv.textContent = message;
  errorDiv.classList.add("show");
}

function showSuccess(message) {
  const successDiv = document.getElementById("successMessage");
  successDiv.textContent = message;
  successDiv.classList.add("show");
}

function clearMessages() {
  document.getElementById("errorMessage").classList.remove("show");
  document.getElementById("successMessage").classList.remove("show");
}

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

// Load saved credentials if "Remember me" was checked before
window.addEventListener("load", function () {
  const saved = localStorage.getItem("rememberMe");
  if (saved) {
    const data = JSON.parse(saved);
    document.getElementById("username").value = data.username;
    document.getElementById("email").value = data.email;
    document.getElementById("rememberMe").checked = true;
  }
});
