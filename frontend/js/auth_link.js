// Toggle the auth link between Login and Logout based on /api/me
const API_BASE = "http://127.0.0.1:5000";

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function getFromAdminFlag() {
  const query = getQueryParam("fromAdmin");
  if (query === "1") return true;
  return localStorage.getItem("fromAdmin") === "1";
}

function clearFromAdminFlag() {
  localStorage.removeItem("fromAdmin");
}

async function updateAuthLink() {
  const link = document.getElementById("authLink");
  if (!link) return;
  let loggedIn = false;
  try {
    const resp = await fetch(API_BASE + "/api/me", { credentials: "include" });
    if (resp.ok) {
      const j = await resp.json();
      if (j && j.username) {
        loggedIn = true;
      }
    }
  } catch (e) {
    // ignore network errors, fallback to localStorage
  }

  if (!loggedIn) {
    loggedIn = !!localStorage.getItem("loggedInUser");
  }

  if (loggedIn) {
    const fromAdmin = getFromAdminFlag();
    const pathname = window.location.pathname;
    if (
      fromAdmin &&
      (pathname.endsWith("index.html") || pathname.endsWith("user.html"))
    ) {
      link.textContent = "Trang chủ";
      link.href = "index.html";
      link.onclick = null;
      clearFromAdminFlag();
      return;
    }
    link.textContent = "Đăng xuất";
    link.href = "#";
    link.onclick = async function (e) {
      e.preventDefault();
      const ok = confirm("Bạn có chắc muốn đăng xuất?");
      if (!ok) return;
      try {
        await fetch(API_BASE + "/api/logout", {
          method: "POST",
          credentials: "include",
        });
      } catch (err) {
        // ignore network errors
      }
      localStorage.removeItem("loggedInUser");
      localStorage.removeItem("isAdmin");
      clearFromAdminFlag();
      window.location.href = "index.html";
    };
  } else {
    setLoginState(link);
  }
}

function setLoginState(link) {
  link.textContent = "Đăng nhập";
  link.href = "login.html";
  link.onclick = null;
}

window.addEventListener("load", updateAuthLink);
