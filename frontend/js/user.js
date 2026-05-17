// Manage profile panel and local profile storage

const profileBtn = document.getElementById('profileBtn');
const profilePanel = document.getElementById('profilePanel');
const closeProfileBtn = document.getElementById('closeProfileBtn');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const profileMessage = document.getElementById('profileMessage');

function openProfile() {
    profilePanel.setAttribute('aria-hidden', 'false');
}

function closeProfile() {
    profilePanel.setAttribute('aria-hidden', 'true');
}

profileBtn.addEventListener('click', function () {
    const hidden = profilePanel.getAttribute('aria-hidden') === 'true';
    if (hidden) openProfile(); else closeProfile();
});

closeProfileBtn.addEventListener('click', function () {
    closeProfile();
});

// Load profile from localStorage
function loadProfile() {
    const raw = localStorage.getItem('userProfile');
    if (!raw) return {};
    try {
        return JSON.parse(raw);
    } catch (e) {
        return {};
    }
}

const logoutBtn = document.getElementById('logoutBtn');

function saveProfileToStorage(profile) {
    localStorage.setItem('userProfile', JSON.stringify(profile));
}

function showProfileMessage(msg, success = true) {
    profileMessage.textContent = msg;
    profileMessage.style.color = success ? '#d1d1f3' : '#ff6961';
}

function populateProfileForm() {
    const p = loadProfile();
    document.getElementById('profileUsername').value = p.username || '';
    document.getElementById('favStations').value = (p.favStations || []).join(', ');
    document.getElementById('favRoutes').value = (p.favRoutes || []).join('\n');
}

saveProfileBtn.addEventListener('click', function () {
    const username = document.getElementById('profileUsername').value.trim();
    const password = document.getElementById('profilePassword').value;
    const confirm = document.getElementById('profilePasswordConfirm').value;
    const favStationsRaw = document.getElementById('favStations').value.trim();
    const favRoutesRaw = document.getElementById('favRoutes').value.trim();

    if (!username || username.length < 3) {
        showProfileMessage('Tên đăng nhập phải có ít nhất 3 ký tự', false);
        return;
    }

    if (password) {
        if (password.length < 6) {
            showProfileMessage('Mật khẩu phải có ít nhất 6 ký tự', false);
            return;
        }
        if (password !== confirm) {
            showProfileMessage('Mật khẩu xác nhận không khớp', false);
            return;
        }
    }

    const favStations = favStationsRaw ? favStationsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
    const favRoutes = favRoutesRaw ? favRoutesRaw.split('\n').map(s => s.trim()).filter(Boolean) : [];

    const profile = loadProfile();
    profile.username = username;
    if (password) profile.password = password; // note: stored in plain localStorage; consider hashing if persisted server-side
    profile.favStations = favStations;
    profile.favRoutes = favRoutes;

    saveProfileToStorage(profile);
    showProfileMessage('Đã lưu hồ sơ');

    // clear password fields
    document.getElementById('profilePassword').value = '';
    document.getElementById('profilePasswordConfirm').value = '';
});

if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
        localStorage.removeItem('userProfile');
        // nếu muốn xóa dữ liệu session khác, thêm ở đây
        window.location.href = 'index.html';
    });
}

// Initialize
window.addEventListener('load', function () {
    // populate profile
    populateProfileForm();
    // ensure panel hidden
    profilePanel.setAttribute('aria-hidden', 'true');
});
