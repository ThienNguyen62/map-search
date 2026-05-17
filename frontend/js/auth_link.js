// Toggle the auth link between Login and Logout based on /api/me
const API_BASE = 'http://127.0.0.1:5000';

async function updateAuthLink() {
    const link = document.getElementById('authLink');
    if (!link) return;
    try {
        const resp = await fetch(API_BASE + '/api/me', { credentials: 'include' });
        if (!resp.ok) {
            setLoginState(link);
            return;
        }
        const j = await resp.json();
        if (j && j.username) {
            // logged in → show "Đăng xuất"
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
                // always redirect to index
                window.location.href = 'index.html';
            };
        } else {
            setLoginState(link);
        }
    } catch (e) {
        setLoginState(link);
    }
}

function setLoginState(link) {
    link.textContent = 'Đăng nhập';
    link.href = 'login.html';
    link.onclick = null;
}

window.addEventListener('load', updateAuthLink);
