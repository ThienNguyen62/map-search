// Toggle the auth link between Login and Logout based on /api/me
const API_BASE = 'http://127.0.0.1:5000';

async function updateAuthLink() {
    const link = document.getElementById('authLink');
    if (!link) return;
    const localUser = localStorage.getItem('user_name');
    const currentPage = (window.location.pathname || '').toLowerCase();
    const isUserPage = currentPage.endsWith('/user.html') || currentPage.endsWith('user.html');

    const applyLogoutState = () => {
        link.textContent = 'Đăng xuất';
        link.href = '#';
        link.onclick = async function (e) {
            e.preventDefault();
            const ok = confirm('Bạn có chắc muốn đăng xuất?');
            if (!ok) return;
            try {
                await fetch(API_BASE + '/api/logout', {
                    method: 'POST',
                    credentials: 'include'
                });
            } catch (err) {
                // ignore network errors
            }
            localStorage.removeItem('user_name');
            window.location.href = 'index.html';
        };
    };

    try {
        const resp = await fetch(API_BASE + '/api/me', { credentials: 'include' });
        if (!resp.ok) {
            if (isUserPage && localUser) applyLogoutState();
            else setLoginState(link);
            return;
        }
        const j = await resp.json();
        if (j && j.username) {
            localStorage.setItem('user_name', j.username);
            applyLogoutState();
        } else {
            if (isUserPage && localUser) applyLogoutState();
            else setLoginState(link);
        }
    } catch (e) {
        if (isUserPage && localUser) applyLogoutState();
        else setLoginState(link);
    }
}

function setLoginState(link) {
    link.textContent = 'Đăng nhập';
    link.href = 'login.html';
    link.onclick = null;
}

window.addEventListener('load', updateAuthLink);
