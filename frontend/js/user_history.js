// user_history.js
// Manages per-user search history. Auto-detects logged-in user from session.
// Must be loaded BEFORE script.js so it can wrap findRoute.

(function () {
    'use strict';

    // ── State ──
    let _currentUser = null;
    let _isLoggedIn = false;

    // ── API: get current logged-in user ──
    async function fetchCurrentUser() {
        try {
            const resp = await fetch('http://127.0.0.1:5000/api/me', { credentials: 'include' });
            if (resp.ok) {
                const j = await resp.json();
                if (j && j.username) {
                    _currentUser = j.username;
                    _isLoggedIn = true;
                    return j.username;
                }
            }
        } catch (e) {
            // server offline – fall back to localStorage
        }
        // fallback: check localStorage
        const stored = localStorage.getItem('user_name');
        if (stored) {
            _currentUser = stored;
            _isLoggedIn = false;
            return stored;
        }
        _currentUser = null;
        _isLoggedIn = false;
        return null;
    }

    // ── localStorage helpers ──
    function historyKey(user) {
        return 'search_history_' + (user || 'anonymous');
    }

    function loadHistory(user) {
        const raw = localStorage.getItem(historyKey(user));
        if (!raw) return [];
        try { return JSON.parse(raw); } catch (e) { return []; }
    }

    function saveHistoryEntry(user, entry) {
        const key = historyKey(user);
        const arr = loadHistory(user);
        arr.unshift(entry);
        // keep latest 200
        if (arr.length > 200) arr.length = 200;
        localStorage.setItem(key, JSON.stringify(arr));
    }

    function clearHistory(user) {
        localStorage.removeItem(historyKey(user));
    }

    // ── UI rendering ──
    function renderHistoryStats(user) {
        const el = document.getElementById('historyStats');
        if (!el) return;
        const arr = loadHistory(user);
        if (!arr.length) {
            el.innerHTML = '';
            return;
        }
        const uniqueRoutes = new Set(arr.map(i => `${i.from}→${i.to}`)).size;
        el.innerHTML = `<span>Tổng: <strong>${arr.length}</strong> lần tìm</span><span>Tuyến khác nhau: <strong>${uniqueRoutes}</strong></span>`;
    }

    function renderHistoryList(user) {
        const container = document.getElementById('historyList');
        if (!container) return;
        const arr = loadHistory(user);

        if (!arr.length) {
            container.innerHTML = '<div class="history-empty"><span class="history-empty-icon">🔍</span><p>Chưa có lịch sử tìm kiếm.</p><p class="history-empty-hint">Bấm "Tìm đường" để bắt đầu!</p></div>';
            return;
        }

        container.innerHTML = '';
        const ul = document.createElement('ul');
        ul.className = 'history-ul';

        arr.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = 'history-item';
            const date = new Date(item.ts);
            const timeStr = date.toLocaleString('vi-VN', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });

            li.innerHTML = `
                <div class="history-item-header">
                    <div class="history-route">
                        <span class="history-from">${escapeHtml(item.from)}</span>
                        <span class="history-arrow">→</span>
                        <span class="history-to">${escapeHtml(item.to)}</span>
                    </div>
                    <button class="history-delete-btn" data-index="${index}" title="Xóa mục này">✕</button>
                </div>
                <div class="history-meta">
                    <span class="history-time">🕐 ${timeStr}</span>
                    <span class="history-summary">${escapeHtml(item.summary || '')}</span>
                </div>
            `;

            // Click to re-run route
            li.addEventListener('click', (e) => {
                if (e.target.closest('.history-delete-btn')) return;
                const fromInput = document.getElementById('fromStation');
                const toInput = document.getElementById('toStation');
                if (fromInput) fromInput.value = item.from;
                if (toInput) toInput.value = item.to;
                // Clear selected IDs so lookup by name works
                if (typeof selectedStationIds !== 'undefined') {
                    selectedStationIds.from = null;
                    selectedStationIds.to = null;
                }
                // Switch to map tab
                switchToTab('map');
                // Trigger search
                const btn = document.getElementById('findRouteBtn');
                if (btn) btn.click();
            });

            ul.appendChild(li);
        });

        container.appendChild(ul);

        // Attach delete handlers
        container.querySelectorAll('.history-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.getAttribute('data-index'), 10);
                deleteHistoryItem(user, idx);
            });
        });
    }

    function deleteHistoryItem(user, index) {
        const arr = loadHistory(user);
        if (index >= 0 && index < arr.length) {
            arr.splice(index, 1);
            localStorage.setItem(historyKey(user), JSON.stringify(arr));
            renderHistoryList(user);
            renderHistoryStats(user);
        }
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

    // ── Tab switching ──
    function switchToTab(tabName) {
        // Activate the tab button
        document.querySelectorAll('.sidebar-tabs .tab').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
        });
        // Show the corresponding content
        const tabMap = { map: 'tabMap', history: 'tabHistory', diagram: 'tabDiagram', info: 'tabInfo' };
        Object.entries(tabMap).forEach(([key, id]) => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.toggle('active', key === tabName);
            }
        });
    }

    // ── Initialize ──
    async function init() {
        const user = await fetchCurrentUser();

        // Update user badge UI
        const userNameEl = document.getElementById('userName');
        const userAvatarEl = document.getElementById('userAvatar');
        const userInfoDetail = document.getElementById('userInfoDetail');

        if (user) {
            if (userNameEl) userNameEl.textContent = user;
            if (userAvatarEl) userAvatarEl.textContent = user.charAt(0).toUpperCase();
            if (userInfoDetail) userInfoDetail.textContent = `Đăng nhập với: ${user}`;
        } else {
            if (userNameEl) userNameEl.textContent = 'Khách';
            if (userInfoDetail) userInfoDetail.textContent = 'Chưa đăng nhập. Lịch sử sẽ lưu theo trình duyệt.';
        }

        const displayUser = user || 'anonymous';
        renderHistoryList(displayUser);
        renderHistoryStats(displayUser);

        // Clear all history button
        const clearBtn = document.getElementById('clearHistoryBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (confirm('Bạn có chắc muốn xóa toàn bộ lịch sử tìm kiếm?')) {
                    clearHistory(displayUser);
                    renderHistoryList(displayUser);
                    renderHistoryStats(displayUser);
                }
            });
        }

        // Tab switching
        document.querySelectorAll('.sidebar-tabs .tab').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-tab');
                if (tab) switchToTab(tab);
            });
        });
    }

    // ── Wrap findRoute to save history ──
    window._originalFindRoute = null;

    window.findRoute = async function () {
        // Call the real computeAndShowFullRoute (defined in script.js)
        try {
            if (typeof computeAndShowFullRoute === 'function') {
                await computeAndShowFullRoute();
            } else if (window._originalFindRoute) {
                await window._originalFindRoute();
            }
        } catch (e) {
            console.error('computeAndShowFullRoute failed', e);
            return;
        }

        // Build history entry from globals set by script.js
        const from = (typeof lastFromDisplay !== 'undefined' ? lastFromDisplay : '') || (document.getElementById('fromStation') ? document.getElementById('fromStation').value : '');
        const to = (typeof lastToDisplay !== 'undefined' ? lastToDisplay : '') || (document.getElementById('toStation') ? document.getElementById('toStation').value : '');

        if (!from && !to) return; // nothing to save

        let summary = '';
        if (typeof lastRoutesList !== 'undefined' && lastRoutesList && lastRoutesList.length) {
            const best = lastRoutesList[0];
            const time = best.metro_time != null ? best.metro_time : '?';
            const stops = best.stops != null ? best.stops : (best.path ? best.path.length : '?');
            const transfers = best.transfers != null ? best.transfers : '?';
            summary = `${time} phút, ${stops} ga, ${transfers} lần chuyển`;
        } else {
            summary = 'Không tìm thấy lộ trình';
        }

        const entry = { ts: Date.now(), from, to, summary };

        const user = await fetchCurrentUser();
        const displayUser = user || 'anonymous';
        saveHistoryEntry(displayUser, entry);
        renderHistoryList(displayUser);
        renderHistoryStats(displayUser);
    };

    // Expose switchToTab globally
    window.switchToTab = switchToTab;

    // Initialize when DOM is ready
    window.addEventListener('load', init);
})();
