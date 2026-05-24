(function () {
    'use strict';

    const API_BASE = 'http://127.0.0.1:5000';

    function escapeHtml(value) {
        const div = document.createElement('div');
        div.textContent = value == null ? '' : String(value);
        return div.innerHTML;
    }

    function nowIso() {
        return new Date().toISOString();
    }

    function formatSavedAt(iso) {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return 'Không rõ thời gian';
        return d.toLocaleString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    class LocalFavoriteStore {
        constructor(storageKey) {
            this.storageKey = storageKey;
        }

        load() {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return [];
            try {
                const parsed = JSON.parse(raw);
                return Array.isArray(parsed) ? parsed : [];
            } catch (error) {
                console.warn('Invalid favorite routes payload in localStorage:', error);
                return [];
            }
        }

        save(routes) {
            localStorage.setItem(this.storageKey, JSON.stringify(routes));
        }

        remove(id) {
            const routes = this.load().filter(item => item.id !== id);
            this.save(routes);
            return routes;
        }

        rename(id, newName) {
            const routes = this.load().map(item => item.id === id ? { ...item, routeName: newName } : item);
            this.save(routes);
            return routes;
        }
    }

    class FavoriteRoutesApi {
        async request(path, options) {
            const resp = await fetch(`${API_BASE}${path}`, {
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                ...options,
            });
            let body = null;
            try {
                body = await resp.json();
            } catch (error) {
                body = null;
            }
            return { ok: resp.ok, status: resp.status, body };
        }

        async list() {
            return this.request('/api/favorites', { method: 'GET' });
        }

        async add(route) {
            return this.request('/api/favorites', { method: 'POST', body: JSON.stringify(route) });
        }

        async rename(id, routeName) {
            return this.request(`/api/favorites/${encodeURIComponent(id)}`, {
                method: 'PUT',
                body: JSON.stringify({ routeName }),
            });
        }

        async remove(id) {
            return this.request(`/api/favorites/${encodeURIComponent(id)}`, { method: 'DELETE' });
        }
    }

    // Repository bridges backend API and local fallback.
    class FavoriteRoutesRepository {
        constructor(user) {
            this.user = user;
            this.api = new FavoriteRoutesApi();
            this.local = new LocalFavoriteStore(`favorite_routes_${user}`);
            this.anon = new LocalFavoriteStore('favorite_routes_anonymous');
            this.useApi = false;
            this.routes = [];
        }

        isDuplicate(target, routes) {
            const haystack = routes || this.routes;
            const sCoord = target.sourceCoord ? `${Number(target.sourceCoord.lat).toFixed(6)},${Number(target.sourceCoord.lon).toFixed(6)}` : '';
            const tCoord = target.targetCoord ? `${Number(target.targetCoord.lat).toFixed(6)},${Number(target.targetCoord.lon).toFixed(6)}` : '';
            const signature = `${target.sourceId||''}|${target.targetId||''}|${sCoord}|${tCoord}|${(target.path || []).join('>')}`;
            return haystack.some(item => {
                const iS = item.sourceCoord ? `${Number(item.sourceCoord.lat).toFixed(6)},${Number(item.sourceCoord.lon).toFixed(6)}` : '';
                const iT = item.targetCoord ? `${Number(item.targetCoord.lat).toFixed(6)},${Number(item.targetCoord.lon).toFixed(6)}` : '';
                const itemSignature = `${item.sourceId||''}|${item.targetId||''}|${iS}|${iT}|${(item.path || []).join('>')}`;
                return itemSignature === signature;
            });
        }

        async init() {
            const listResp = await this.api.list();
            if (listResp.ok && listResp.body && Array.isArray(listResp.body.favorites)) {
                this.useApi = true;
                this.routes = listResp.body.favorites;
                this.local.save(this.routes);
                await this.migrateAnonymousFavorites();
                await this.refresh();
                return this.routes;
            }

            this.useApi = false;
            this.routes = this.local.load();
            return this.routes;
        }

        async refresh() {
            if (this.useApi) {
                const resp = await this.api.list();
                if (resp.ok && resp.body && Array.isArray(resp.body.favorites)) {
                    this.routes = resp.body.favorites;
                    this.local.save(this.routes);
                    return this.routes;
                }
            }
            this.routes = this.local.load();
            return this.routes;
        }

        async migrateAnonymousFavorites() {
            if (!this.useApi || this.user === 'anonymous') return;
            const pending = this.anon.load();
            if (!pending.length) return;

            for (const item of pending) {
                if (this.isDuplicate(item, this.routes)) continue;
                try {
                    const resp = await this.api.add(item);
                    if (resp.ok && resp.body && Array.isArray(resp.body.favorites)) {
                        this.routes = resp.body.favorites;
                    }
                } catch (error) {
                    console.warn('Cannot migrate anonymous favorite:', error);
                }
            }
            this.anon.save([]);
        }

        async add(route) {
            const current = await this.refresh();
            if (this.isDuplicate(route, current)) {
                return { ok: false, reason: 'duplicate', routes: current };
            }

            if (this.useApi) {
                const resp = await this.api.add(route);
                if (resp.ok && resp.body && Array.isArray(resp.body.favorites)) {
                    this.routes = resp.body.favorites;
                    this.local.save(this.routes);
                    return { ok: true, routes: this.routes };
                }
                if (resp.status === 409) {
                    return { ok: false, reason: 'duplicate', routes: current };
                }
                return { ok: false, reason: 'server', routes: current };
            }

            const merged = [route, ...current];
            this.routes = merged;
            this.local.save(merged);
            return { ok: true, routes: merged };
        }

        async rename(id, newName) {
            if (this.useApi) {
                const resp = await this.api.rename(id, newName);
                if (resp.ok && resp.body && Array.isArray(resp.body.favorites)) {
                    this.routes = resp.body.favorites;
                    this.local.save(this.routes);
                    return this.routes;
                }
                return this.routes;
            }

            this.routes = this.local.rename(id, newName);
            return this.routes;
        }

        async remove(id) {
            if (this.useApi) {
                const resp = await this.api.remove(id);
                if (resp.ok && resp.body && Array.isArray(resp.body.favorites)) {
                    this.routes = resp.body.favorites;
                    this.local.save(this.routes);
                    return this.routes;
                }
                return this.routes;
            }

            this.routes = this.local.remove(id);
            return this.routes;
        }
    }

    class FavoriteButton {
        constructor(mountEl, onSave) {
            this.mountEl = mountEl;
            this.onSave = onSave;
            this.button = null;
            this.statusEl = null;
            this.render();
        }

        render() {
            this.mountEl.innerHTML = `
                <div class="favorite-action-wrap">
                    <button id="favoriteSaveBtn" class="favorite-save-btn" type="button" title="Lưu tuyến yêu thích">
                        <span class="favorite-icon" aria-hidden="true">⭐</span>
                        <span>Lưu tuyến</span>
                    </button>
                    <div id="favoriteSaveStatus" class="favorite-save-status" aria-live="polite"></div>
                </div>
            `;
            this.button = this.mountEl.querySelector('#favoriteSaveBtn');
            this.statusEl = this.mountEl.querySelector('#favoriteSaveStatus');
            this.button.addEventListener('click', () => {
                Promise.resolve(this.onSave()).catch(error => {
                    console.error('Save favorite failed:', error);
                    this.setStatus('Không thể lưu tuyến yêu thích.', 'warn');
                });
            });
            this.setEnabled(false);
        }

        setEnabled(enabled) {
            if (this.button) this.button.disabled = !enabled;
        }

        setStatus(message, type) {
            if (!this.statusEl) return;
            this.statusEl.textContent = message || '';
            this.statusEl.className = `favorite-save-status ${type ? `is-${type}` : ''}`;
        }
    }

    class FavoriteRouteCard {
        constructor(route, handlers) {
            this.route = route;
            this.handlers = handlers;
        }

        render() {
            const card = document.createElement('article');
            card.className = 'favorite-route-card';
            card.innerHTML = `
                <div class="favorite-card-head">
                    <button class="favorite-route-open" type="button" title="Tìm lại tuyến này">
                        <strong>${escapeHtml(this.route.routeName)}</strong>
                        <span>${escapeHtml(this.route.sourceName)} → ${escapeHtml(this.route.targetName)}</span>
                    </button>
                    <div class="favorite-card-actions">
                        <button class="favorite-card-btn favorite-edit" type="button" title="Đổi tên">Sửa</button>
                        <button class="favorite-card-btn favorite-delete" type="button" title="Xóa">Xóa</button>
                    </div>
                </div>
                <div class="favorite-card-meta">
                    <span>⏱ ${Number(this.route.metroTime || 0)} phút</span>
                    <span>🔁 ${Number(this.route.transferCount || 0)} chuyển tuyến</span>
                    <span>🚉 ${Array.isArray(this.route.path) ? this.route.path.length : 0} ga</span>
                </div>
                <div class="favorite-card-sub">Lưu lúc: ${escapeHtml(formatSavedAt(this.route.savedAt))}</div>
            `;

            card.querySelector('.favorite-route-open').addEventListener('click', () => {
                this.handlers.onOpen(this.route);
            });

            card.querySelector('.favorite-edit').addEventListener('click', () => {
                this.handlers.onEdit(this.route);
            });

            card.querySelector('.favorite-delete').addEventListener('click', () => {
                this.handlers.onDelete(this.route);
            });

            return card;
        }
    }

    class FavoriteRoutesPanel {
        constructor(mountEl, handlers) {
            this.mountEl = mountEl;
            this.handlers = handlers;
            this.query = '';
            this.routes = [];
            this.renderShell();
        }

        renderShell() {
            this.mountEl.innerHTML = `
                <div class="favorite-panel-header">
                    <h3>❤️ Tuyến yêu thích</h3>
                    <span id="favoriteCountBadge" class="favorite-count-badge">0</span>
                </div>
                <div class="favorite-panel-search">
                    <input id="favoriteSearchInput" type="text" placeholder="Tìm theo tên tuyến, điểm đi, điểm đến..." />
                </div>
                <div id="favoritePanelBody" class="favorite-panel-body"></div>
            `;

            const input = this.mountEl.querySelector('#favoriteSearchInput');
            input.addEventListener('input', () => {
                this.query = input.value.trim().toLowerCase();
                this.renderCards();
            });
        }

        setRoutes(routes) {
            this.routes = Array.isArray(routes) ? routes : [];
            this.renderCards();
        }

        renderCards() {
            const body = this.mountEl.querySelector('#favoritePanelBody');
            const badge = this.mountEl.querySelector('#favoriteCountBadge');
            if (!body || !badge) return;

            const filtered = this.routes.filter(item => {
                if (!this.query) return true;
                const text = [item.routeName, item.sourceName, item.targetName].join(' ').toLowerCase();
                return text.includes(this.query);
            });

            badge.textContent = String(this.routes.length);

            if (!this.routes.length) {
                body.innerHTML = '<p class="favorite-empty">Bạn chưa có tuyến yêu thích nào.</p>';
                return;
            }

            if (!filtered.length) {
                body.innerHTML = '<p class="favorite-empty">Không tìm thấy tuyến phù hợp.</p>';
                return;
            }

            body.innerHTML = '';
            filtered.forEach(route => {
                const card = new FavoriteRouteCard(route, {
                    onOpen: this.handlers.onOpen,
                    onEdit: this.handlers.onEdit,
                    onDelete: this.handlers.onDelete,
                }).render();
                body.appendChild(card);
            });
        }
    }

    class FavoriteRoutesFeature {
        constructor(options) {
            this.buttonMount = options.buttonMount;
            this.panelMount = options.panelMount;
            this.onOpenRoute = options.onOpenRoute;
            this.getCurrentRoute = options.getCurrentRoute;
            this.currentUser = 'anonymous';
            this.repo = null;
            this.favoriteButton = null;
            this.favoritePanel = null;
        }

        async init() {
            this.currentUser = await this.resolveUser();
            this.repo = new FavoriteRoutesRepository(this.currentUser);

            this.favoriteButton = new FavoriteButton(this.buttonMount, () => this.handleSave());
            this.favoritePanel = new FavoriteRoutesPanel(this.panelMount, {
                onOpen: route => this.onOpenRoute(route),
                onEdit: route => this.handleEdit(route),
                onDelete: route => this.handleDelete(route),
            });

            const routes = await this.repo.init();
            this.favoritePanel.setRoutes(routes);
            this.favoriteButton.setStatus('Chọn một tuyến rồi bấm Lưu tuyến.', 'info');
        }

        async resolveUser() {
            try {
                const resp = await fetch(`${API_BASE}/api/me`, { credentials: 'include' });
                if (resp.ok) {
                    const data = await resp.json();
                    if (data && data.username) return data.username;
                }
            } catch (error) {
                console.warn('Cannot resolve user from /api/me:', error);
            }
            return localStorage.getItem('user_name') || 'anonymous';
        }

        setCurrentRoute(route) {
            this._currentRoute = route || null;
            this.favoriteButton.setEnabled(Boolean(route));
            if (!route) {
                this.favoriteButton.setStatus('Chưa có tuyến để lưu.', 'info');
            }
        }

        async handleSave() {
            const route = this.getCurrentRoute ? this.getCurrentRoute() : this._currentRoute;
            if (!route) {
                this.favoriteButton.setStatus('Chưa có tuyến để lưu.', 'info');
                return;
            }

            if (this.repo.isDuplicate(route, this.repo.routes)) {
                this.favoriteButton.setStatus('Tuyến này đã có trong danh sách yêu thích.', 'warn');
                return;
            }

            const defaultName = `${route.sourceName} → ${route.targetName}`;
            const customName = prompt('Đặt tên cho tuyến yêu thích:', defaultName);
            if (customName == null) return;
            const trimmedName = customName.trim();
            if (!trimmedName) {
                this.favoriteButton.setStatus('Tên tuyến không được để trống.', 'warn');
                return;
            }

            const payload = {
                ...route,
                id: `fav_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                routeName: trimmedName,
                savedAt: nowIso(),
            };

            const result = await this.repo.add(payload);
            if (!result.ok && result.reason === 'duplicate') {
                this.favoriteButton.setStatus('Tuyến này đã có trong danh sách yêu thích.', 'warn');
                return;
            }
            if (!result.ok) {
                this.favoriteButton.setStatus('Không thể lưu tuyến. Vui lòng thử lại.', 'warn');
                return;
            }

            this.favoritePanel.setRoutes(result.routes);
            this.favoriteButton.setStatus('Đã lưu tuyến yêu thích thành công.', 'success');
        }

        async handleDelete(route) {
            const ok = confirm(`Xóa tuyến "${route.routeName}" khỏi yêu thích?`);
            if (!ok) return;
            const routes = await this.repo.remove(route.id);
            this.favoritePanel.setRoutes(routes);
            this.favoriteButton.setStatus('Đã xóa tuyến yêu thích.', 'info');
        }

        async handleEdit(route) {
            const newName = prompt('Nhập tên tuyến mới:', route.routeName);
            if (newName == null) return;
            const trimmed = newName.trim();
            if (!trimmed) {
                this.favoriteButton.setStatus('Tên tuyến không được để trống.', 'warn');
                return;
            }
            const routes = await this.repo.rename(route.id, trimmed);
            this.favoritePanel.setRoutes(routes);
            this.favoriteButton.setStatus('Đã cập nhật tên tuyến.', 'success');
        }
    }

    window.FavoriteRoutesFeature = FavoriteRoutesFeature;
})();
