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
  // Always show identifier field (username or email)
  document.getElementById("emailGroup").style.display = "block";
  document.getElementById("identifier").setAttribute("required", "");
  // hide signup link for admin
  document.querySelector(".signup-link").style.display = role === 'admin' ? 'none' : 'block';

  // Clear form
  document.getElementById("loginForm").reset();
  clearMessages();
}

function handleLogin() {
  console.log("handleLogin called, currentRole:", currentRole);
  const identifierEl = document.getElementById('identifier');
  const identifier = identifierEl ? identifierEl.value.trim() : '';
  let username = '';
  const password = document.getElementById("password").value;

  // Clear messages
  clearMessages();

  if (!identifier) {
    showError('Vui lòng nhập tên người dùng hoặc email');
    return;
  }

  if (currentRole === 'admin') {
    // use identifier as username for admin
    username = identifier;
  } else {
    // for normal users, if identifier is email use local-part as username, else use identifier as username
    if (identifier.includes('@')) {
      username = identifier.split('@')[0];
    } else {
      username = identifier;
    }
  }

  if (password.length < 6) {
    showError("Mật khẩu phải có ít nhất 6 ký tự");
    return;
  }

  let email = null;
  if (identifier && identifier.includes('@')) {
    email = identifier;
    if (!isValidEmail(email)) {
      showError('Email không hợp lệ');
      return;
    }
  } else if (currentRole !== 'admin') {
    // non-admin users should provide an email; if they didn't include @, ask them
    showError('Vui lòng nhập email dưới dạng example@domain');
    return;
  }

  showLoading(true);

  const payload = {
    username: username,
    password: password,
    role: currentRole,
  };

  if (email) payload.email = email;

  fetch("http://127.0.0.1:5000/api/login", {
    method: "POST",
    credentials: "include",
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
        console.log("User login successful, redirecting to user.html");
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
        console.log("Redirecting to user.html now...");
        window.location.replace("user.html");
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
    const idEl = document.getElementById('identifier');
    if (idEl) idEl.value = data.email || data.username || '';
    document.getElementById("rememberMe").checked = true;
  }
  // initialize UI according to currentRole
  try { switchRole(currentRole); } catch (e) { }
});
