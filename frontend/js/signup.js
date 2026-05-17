// Handle form submission
document.getElementById("signupForm").addEventListener("submit", function (e) {
  e.preventDefault();
  handleSignUp();
});

// Password strength checker
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

  // Length check
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;

  // Character variety check
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

  // Clear messages
  clearMessages();

  // Validation
  if (!firstName) {
    showError("Vui lòng nhập họ");
    return;
  }

  if (!lastName) {
    showError("Vui lòng nhập tên");
    return;
  }

  if (!username || username.length < 3) {
    showError("Tên người dùng phải có ít nhất 3 ký tự");
    return;
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    showError("Tên người dùng chỉ được chứa chữ cái, số và dấu gạch dưới");
    return;
  }

  if (!email || !isValidEmail(email)) {
    showError("Vui lòng nhập email hợp lệ");
    return;
  }

  if (!password || password.length < 8) {
    showError("Mật khẩu phải có ít nhất 8 ký tự");
    return;
  }

  if (password !== confirmPassword) {
    showError("Mật khẩu xác nhận không khớp");
    return;
  }

  if (!agreeTerms) {
    showError("Vui lòng đồng ý với Điều khoản dịch vụ");
    return;
  }

  showLoading(true);

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
      showSuccess("Đăng ký thành công! Đang chuyển hướng tới trang chủ...");
      setTimeout(() => {
        window.location.href = "index.html";
      }, 1500);
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
  errorDiv.style.display = "block";
  errorDiv.classList.add("show");
  window.scrollTo(0, 0);
}

function showSuccess(message) {
  const successDiv = document.getElementById("successMessage");
  successDiv.textContent = message;
  successDiv.style.display = "block";
  successDiv.classList.add("show");
}

function clearMessages() {
  const errorDiv = document.getElementById("errorMessage");
  const successDiv = document.getElementById("successMessage");
  errorDiv.classList.remove("show");
  successDiv.classList.remove("show");
  errorDiv.style.display = "none";
  successDiv.style.display = "none";
}

function showLoading(show) {
  const loading = document.getElementById("loading");
  const button = document.querySelector(".signup-btn");

  if (show) {
    loading.style.display = "block";
    button.disabled = true;
  } else {
    loading.style.display = "none";
    button.disabled = false;
  }
}