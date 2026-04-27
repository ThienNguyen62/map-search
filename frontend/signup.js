// Bắt sự kiện nộp form
document.getElementById("signupForm").addEventListener("submit", function (e) {
  e.preventDefault();
  handleSignUp();
});

// Kiểm tra độ mạnh mật khẩu khi người dùng gõ
document.getElementById("password").addEventListener("input", function () {
  checkPasswordStrength(this.value);
});

function checkPasswordStrength(password) {
  const strengthDiv = document.getElementById("passwordStrength");

  if (password.length === 0) {
    strengthDiv.classList.remove("show");
    return;
  }

  let strength = 0;
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[a-z]/.test(password)) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^a-zA-Z0-9]/.test(password)) strength++;

  strengthDiv.classList.add("show");

  if (strength < 3) {
    strengthDiv.textContent = "🔴 Mật khẩu yếu";
    strengthDiv.className = "password-strength show strength-weak";
  } else if (strength < 5) {
    strengthDiv.textContent = "🟡 Mật khẩu trung bình";
    strengthDiv.className = "password-strength show strength-medium";
  } else {
    strengthDiv.textContent = "🟢 Mật khẩu mạnh";
    strengthDiv.className = "password-strength show strength-strong";
  }
}

function handleSignUp() {
  const firstName = document.getElementById("firstName").value.trim();
  const lastName = document.getElementById("lastName").value.trim();
  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const agreeTerms = document.getElementById("agreeTerms").checked;

  clearMessages();

  // Validate phía client
  if (!firstName || !lastName) {
    showError("Vui lòng nhập đầy đủ họ và tên");
    return;
  }

  if (username.length < 3 || !/^[a-zA-Z0-9_]+$/.test(username)) {
    showError(
      "Tên người dùng không hợp lệ (tối thiểu 3 ký tự, không ký tự đặc biệt)",
    );
    return;
  }

  if (!isValidEmail(email)) {
    showError("Vui lòng nhập email hợp lệ");
    return;
  }

  if (password.length < 8) {
    showError("Mật khẩu phải có ít nhất 8 ký tự");
    return;
  }

  if (password !== confirmPassword) {
    showError("Mật khẩu xác nhận không khớp");
    return;
  }

  if (!agreeTerms) {
    showError("Bạn phải đồng ý với điều khoản dịch vụ");
    return;
  }

  showLoading(true);

  // Gửi yêu cầu tới Backend
  fetch("http://127.0.0.1:5000/api/auth/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      first_name: firstName,
      last_name: lastName,
      username: username,
      email: email,
      phone: phone,
      password: password,
    }),
  })
    .then(async (response) => {
      const data = await response.json();
      showLoading(false);

      if (!response.ok) {
        showError(data.error || "Đăng ký thất bại");
        return;
      }

      showSuccess(
        "Đăng ký thành công! Đang chuyển hướng tới trang đăng nhập...",
      );
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1500);
    })
    .catch(() => {
      showLoading(false);
      showError("Không thể kết nối tới server. Vui lòng kiểm tra Backend.");
    });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showError(message) {
  const errorDiv = document.getElementById("errorMessage");
  errorDiv.textContent = message;
  errorDiv.classList.add("show");
  window.scrollTo({ top: 0, behavior: "smooth" });
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
  const button = document.querySelector(".signup-btn");
  if (show) {
    loading.classList.add("show");
    button.disabled = true;
  } else {
    loading.classList.remove("show");
    button.disabled = false;
  }
}
