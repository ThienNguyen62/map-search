// user.js — User page settings menu and account modal
(function () {
  'use strict';

  const API_BASE = 'http://127.0.0.1:5000';

  function $(id) {
    return document.getElementById(id);
  }

  function safeJsonParse(value, fallback = null) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async function resolveLoginRedirect() {
    try {
      const resp = await fetch('login.html', { method: 'HEAD', cache: 'no-store' });
      if (resp.ok) return 'login.html';
    } catch (e) {
      // ignore and fallback
    }
    return 'index.html';
  }

  function setHidden(el, hidden) {
    if (!el) return;
    el.hidden = hidden;
  }

  function closeMenu() {
    setHidden($("settingsMenu"), true);
    const link = $("authLink");
    if (link) link.setAttribute('aria-expanded', 'false');
  }

  function closeModal() {
    setHidden($("settingsBackdrop"), true);
    setHidden($("accountModal"), true);
  }

  function openModal() {
    setHidden($("settingsBackdrop"), false);
    setHidden($("accountModal"), false);
    closeMenu();
  }

  function openMenu() {
    setHidden($("settingsMenu"), false);
    const link = $("authLink");
    if (link) link.setAttribute('aria-expanded', 'true');
  }

  function toggleMenu() {
    const menu = $("settingsMenu");
    if (!menu) return;
    if (menu.hidden) openMenu();
    else closeMenu();
  }

  function showToast(message) {
    let toast = $("userToast");
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'userToast';
      toast.className = 'user-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => {
      toast.classList.remove('show');
    }, 2600);
  }

  function readProfileFromStorage() {
    const profile = safeJsonParse(localStorage.getItem('currentUserProfile'), {});
    const remember = safeJsonParse(localStorage.getItem('rememberMe'), {});
    return {
      username: profile.username || localStorage.getItem('loggedInUser') || '',
      email: profile.email || remember.email || '',
      password: profile.password || '',
    };
  }

  async function fetchCurrentProfile() {
    let profile = readProfileFromStorage();
    try {
      const resp = await fetch(API_BASE + '/api/me', { credentials: 'include' });
      if (resp.ok) {
        const data = await resp.json();
        profile.username = data.username || profile.username;
        profile.email = data.email || profile.email;
      }
    } catch (e) {
      // ignore network issues and use local cache
    }

    if (!profile.email && profile.username && profile.username.includes('@')) {
      profile.email = profile.username;
    }

    return profile;
  }

  function renderProfile(profile) {
    const usernameEl = $('accountUsername');
    const passwordEl = $('accountPassword');
    const emailEl = $('accountEmail');

    if (usernameEl) usernameEl.textContent = profile.username || '—';
    if (passwordEl) passwordEl.textContent = profile.password || 'Chưa lưu trong phiên này';
    if (emailEl) emailEl.textContent = profile.email || 'Chưa có email';
  }

  function saveProfile(profile) {
    localStorage.setItem('currentUserProfile', JSON.stringify(profile));
    if (profile.email) {
      localStorage.setItem('rememberMe', JSON.stringify({
        username: profile.username || '',
        email: profile.email,
      }));
    }
  }

  async function handleLogout() {
    const ok = window.confirm('Bạn có chắc muốn đăng xuất?');
    if (!ok) return;

    try {
      await fetch(API_BASE + '/api/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (e) {
      // ignore network errors
    }

    localStorage.removeItem('loggedInUser');
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('currentUserProfile');

    const redirectTo = await resolveLoginRedirect();
    window.location.href = redirectTo;
  }

  async function openInfoModal() {
    const profile = await fetchCurrentProfile();
    saveProfile(profile);
    renderProfile(profile);
    openModal();
  }

  function bindEvents() {
    const link = $('authLink');
    const menu = $('settingsMenu');
    const backdrop = $('settingsBackdrop');
    const modal = $('accountModal');

    if (!link || !menu || !backdrop || !modal) return;

    link.setAttribute('role', 'button');
    link.setAttribute('aria-haspopup', 'menu');
    link.setAttribute('aria-expanded', 'false');

    document.querySelectorAll('.settings-menu-item').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const action = btn.getAttribute('data-action');
        closeMenu();
        if (action === 'info') {
          await openInfoModal();
        } else if (action === 'logout') {
          await handleLogout();
        }
      });
    });

    link.addEventListener('click', async (ev) => {
      const isSettingsState = link.classList.contains('settings-trigger') || (link.textContent || '').includes('Cài đặt');
      if (!isSettingsState) return;
      ev.preventDefault();
      toggleMenu();
    });

    backdrop.addEventListener('click', closeModal);

    const closeModalBtn = $('closeAccountModal');
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);

    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        closeMenu();
        closeModal();
      }
    });

    document.addEventListener('click', (ev) => {
      const clickedInside = ev.target.closest('#settingsMenu') || ev.target.closest('#authLink');
      if (!clickedInside) closeMenu();
    });

    const changeEmailBtn = $('changeEmailBtn');
    if (changeEmailBtn) {
      changeEmailBtn.addEventListener('click', async () => {
        const profile = await fetchCurrentProfile();
        const nextEmail = window.prompt('Nhập email mới', profile.email || '');
        if (nextEmail === null) return;
        const trimmed = nextEmail.trim();
        if (!trimmed || !isValidEmail(trimmed)) {
          showToast('Email không hợp lệ');
          return;
        }
        profile.email = trimmed;
        saveProfile(profile);
        renderProfile(profile);
        showToast('Đã cập nhật email trong trình duyệt');
      });
    }

    const changePasswordBtn = $('changePasswordBtn');
    if (changePasswordBtn) {
      changePasswordBtn.addEventListener('click', async () => {
        const profile = await fetchCurrentProfile();
        const nextPassword = window.prompt('Nhập mật khẩu mới');
        if (nextPassword === null) return;
        if (nextPassword.trim().length < 6) {
          showToast('Mật khẩu phải có ít nhất 6 ký tự');
          return;
        }
        profile.password = nextPassword;
        saveProfile(profile);
        renderProfile(profile);
        showToast('Đã cập nhật mật khẩu trong trình duyệt');
      });
    }
  }

  async function init() {
    const link = $('authLink');
    const menu = $('settingsMenu');
    const backdrop = $('settingsBackdrop');
    const modal = $('accountModal');
    if (!link || !menu || !backdrop || !modal) return;

    if (link.textContent && link.textContent.trim() === 'Trang chủ') {
      setHidden(menu, true);
      setHidden(backdrop, true);
      setHidden(modal, true);
      return;
    }

    const resp = await fetch(API_BASE + '/api/me', { credentials: 'include' }).catch(() => null);
    let loggedIn = false;
    if (resp && resp.ok) {
      const data = await resp.json();
      loggedIn = !!data.username;
    }
    if (!loggedIn) {
      loggedIn = !!localStorage.getItem('loggedInUser');
    }

    if (!loggedIn) {
      setHidden(menu, true);
      setHidden(backdrop, true);
      setHidden(modal, true);
      return;
    }

    link.textContent = '⚙️ Cài đặt';
    link.href = '#';
    link.onclick = null;
    link.classList.add('settings-trigger');
    setHidden(menu, true);
    setHidden(backdrop, true);
    setHidden(modal, true);

    bindEvents();
  }

  window.addEventListener('load', init);
})();
