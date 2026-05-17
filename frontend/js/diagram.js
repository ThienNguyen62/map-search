// diagram.js — Interactive metro network schematic diagram
(function () {
    'use strict';

    const API_BASE = 'http://127.0.0.1:5000';
    const STATION_SOURCES = [
        API_BASE + '/api/stations',
        '../data/stations.json',
        '../../data/stations.json'
    ];
    const EDGE_SOURCES = [
        API_BASE + '/api/edges',
        '../data/edges.json',
        '../../data/edges.json'
    ];

    const LINE_COLORS = {
        U1: '#417AB4', U2: '#D4311E', U3: '#F5821F', U4: '#00A76D',
        U5: '#BF7F50', U6: '#0065A3', U7: '#8246AF', U8: '#C4071C',
        S1: '#1A9BD7', S2: '#76B82A', S3: '#951B81', S4: '#E2001A',
        S6: '#00A550', S7: '#964B00', S8: '#000000',
        U: '#417AB4', S: '#1A9BD7', US: '#888888'
    };

    let stations = [];
    let edges = [];
    let stationById = {};
    let adjacency = {};
    let currentView = 'interactive'; // or 'image'
    let highlightedLine = null;
    let highlightedStation = null;

    // ── SVG Pan/Zoom state ──
    let svgViewBox = { x: 0, y: 0, w: 1000, h: 800 };
    let isPanning = false;
    let panStart = { x: 0, y: 0 };
    let panViewBoxStart = { x: 0, y: 0 };

    // ── Image Pan/Zoom state ──
    let imgScale = 1;
    let imgPos = { x: 0, y: 0 };
    let imgPanning = false;
    let imgPanStart = { x: 0, y: 0 };
    let imgPosStart = { x: 0, y: 0 };

    // ── Load data ──
    async function tryFetch(sources) {
        for (const url of sources) {
            try {
                const resp = await fetch(url);
                if (!resp.ok) continue;
                const data = await resp.json();
                if (data) return data;
            } catch (e) { /* try next */ }
        }
        return null;
    }

    async function loadData() {
        const stationsData = await tryFetch(STATION_SOURCES);
        let edgesRaw = await tryFetch(EDGE_SOURCES);

        if (!stationsData || !edgesRaw) {
            document.getElementById('diagramSvg').innerHTML =
                '<text x="50%" y="50%" text-anchor="middle" fill="#999" font-size="16">Không thể tải dữ liệu. Hãy chạy backend.</text>';
            return;
        }

        stations = Array.isArray(stationsData) ? stationsData : [];

        // Normalize edges
        let edgesArray = Array.isArray(edgesRaw) ? edgesRaw
            : (edgesRaw.connections || edgesRaw.edges || edgesRaw.data || []);

        const inferLine = (fromId, toId) => {
            const fp = (fromId || '').split('_')[0];
            const tp = (toId || '').split('_')[0];
            if (fp === 'U') return 'U';
            if (fp === 'S') return 'S';
            if (fp === 'US') return tp === 'U' ? 'U' : tp === 'S' ? 'S' : 'US';
            return fp || 'U';
        };

        edges = edgesArray.map(e => ({
            from: e.from_id || e.from,
            to: e.to_id || e.to,
            time: e.time_min || e.time || 1,
            line: e.line || inferLine(e.from_id || e.from, e.to_id || e.to)
        }));

        // Build indexes
        stationById = {};
        adjacency = {};
        stations.forEach(s => { stationById[s.id] = s; });
        edges.forEach(e => {
            if (!adjacency[e.from]) adjacency[e.from] = [];
            adjacency[e.from].push(e);
            if (!adjacency[e.to]) adjacency[e.to] = [];
            adjacency[e.to].push({ from: e.to, to: e.from, time: e.time, line: e.line });
        });

        drawDiagram();
    }

    // ── Schematic Layout ──
    // Convert geographic coords to schematic positions
    function computeSchematicPositions() {
        if (!stations.length) return {};

        // Find bounds
        let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
        stations.forEach(s => {
            minLat = Math.min(minLat, s.lat);
            maxLat = Math.max(maxLat, s.lat);
            minLon = Math.min(minLon, s.lon);
            maxLon = Math.max(maxLon, s.lon);
        });

        const padding = 80;
        const width = 1800;
        const height = 1200;
        const positions = {};

        stations.forEach(s => {
            // Map lat/lon to x/y (lon→x, lat→y inverted)
            const x = padding + ((s.lon - minLon) / (maxLon - minLon || 1)) * (width - 2 * padding);
            const y = padding + ((maxLat - s.lat) / (maxLat - minLat || 1)) * (height - 2 * padding);
            positions[s.id] = { x, y };
        });

        return positions;
    }

    // ── Draw SVG Diagram ──
    function drawDiagram() {
        const svg = document.getElementById('diagramSvg');
        if (!svg) return;

        const positions = computeSchematicPositions();
        const w = 1800, h = 1200;
        svgViewBox = { x: 0, y: 0, w, h };
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

        let html = '';

        // Background
        html += `<rect x="0" y="0" width="${w}" height="${h}" fill="#f8f9fc"/>`;

        // Title
        html += `<text x="${w / 2}" y="35" text-anchor="middle" font-family="'Segoe UI',sans-serif" font-size="22" font-weight="700" fill="#1f2937">Sơ đồ mạng lưới Metro München</text>`;

        // Draw edges grouped by line
        const lineGroups = {};
        edges.forEach(e => {
            const key = e.line || 'U';
            if (!lineGroups[key]) lineGroups[key] = [];
            lineGroups[key].push(e);
        });

        Object.entries(lineGroups).forEach(([line, lineEdges]) => {
            const color = LINE_COLORS[line] || '#999';
            lineEdges.forEach(e => {
                const from = positions[e.from];
                const to = positions[e.to];
                if (!from || !to) return;
                html += `<line class="diagram-edge" data-line="${line}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${color}" stroke-width="4" opacity="0.85"/>`;
            });
        });

        // Draw stations
        // Determine which stations are interchange (multiple lines)
        const stationLines = {};
        edges.forEach(e => {
            [e.from, e.to].forEach(sid => {
                if (!stationLines[sid]) stationLines[sid] = new Set();
                stationLines[sid].add(e.line || 'U');
            });
        });

        stations.forEach(s => {
            const pos = positions[s.id];
            if (!pos) return;
            const lines = stationLines[s.id] || new Set();
            const isInterchange = lines.size > 1;
            const radius = isInterchange ? 6 : 4;
            const strokeWidth = isInterchange ? 2.5 : 1.5;
            const fillColor = isInterchange ? '#ffffff' : '#ffffff';
            const strokeColor = isInterchange ? '#333' : (LINE_COLORS[Array.from(lines)[0]] || '#666');

            html += `<g class="diagram-station" data-id="${s.id}" data-lines="${Array.from(lines).join(',')}">`;
            html += `<circle cx="${pos.x}" cy="${pos.y}" r="${radius}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`;

            // Label - offset based on position to avoid overlap
            const labelX = pos.x + 8;
            const labelY = pos.y - 8;
            html += `<text class="diagram-station-label" x="${labelX}" y="${labelY}" data-id="${s.id}">${escapeXml(s.name)}</text>`;
            html += `</g>`;
        });

        // Legend
        const legendX = w - 280;
        const legendY = h - 300;
        html += `<rect x="${legendX - 10}" y="${legendY - 25}" width="270" height="280" rx="12" fill="rgba(255,255,255,0.92)" stroke="#ddd" stroke-width="1"/>`;
        html += `<text x="${legendX}" y="${legendY}" font-family="'Segoe UI',sans-serif" font-size="13" font-weight="700" fill="#333">Chú thích tuyến</text>`;

        const allLines = Object.keys(LINE_COLORS).filter(l => l.length <= 3 && l !== 'U' && l !== 'S' && l !== 'US');
        allLines.forEach((line, i) => {
            const col = i < 8 ? 0 : 1;
            const row = i < 8 ? i : i - 8;
            const lx = legendX + col * 130;
            const ly = legendY + 20 + row * 28;
            html += `<circle cx="${lx + 8}" cy="${ly}" r="7" fill="${LINE_COLORS[line]}"/>`;
            html += `<text x="${lx + 22}" y="${ly + 4}" font-family="'Segoe UI',sans-serif" font-size="12" fill="#333" font-weight="600">Linie ${line}</text>`;
        });

        svg.innerHTML = html;

        // Attach station click events
        svg.querySelectorAll('.diagram-station').forEach(g => {
            g.addEventListener('click', () => {
                const id = g.getAttribute('data-id');
                highlightStation(id);
            });
        });

        // Setup pan/zoom
        setupSvgPanZoom(svg);
    }

    function escapeXml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ── Highlight Station ──
    function highlightStation(stationId) {
        highlightedStation = stationId;
        const s = stationById[stationId];
        if (!s) return;

        // Show station info
        const card = document.getElementById('stationInfoCard');
        const nameEl = document.getElementById('stationInfoName');
        const linesEl = document.getElementById('stationInfoLines');
        const connEl = document.getElementById('stationInfoConnections');

        if (card && nameEl) {
            card.style.display = 'block';
            nameEl.textContent = `📍 ${s.name}`;

            // Find lines through this station
            const stLines = new Set();
            (adjacency[stationId] || []).forEach(e => stLines.add(e.line));
            linesEl.innerHTML = `<strong>Tuyến:</strong> ${Array.from(stLines).map(l =>
                `<span style="display:inline-block;padding:2px 8px;border-radius:6px;background:${LINE_COLORS[l] || '#999'};color:#fff;font-weight:700;font-size:0.8rem;margin:2px">${l}</span>`
            ).join(' ')}`;

            // Find connected stations
            const neighbors = (adjacency[stationId] || []).map(e => {
                const neighbor = stationById[e.to];
                return neighbor ? neighbor.name : e.to;
            });
            connEl.textContent = `Kết nối: ${neighbors.join(', ')}`;
        }

        // Highlight in SVG
        const svg = document.getElementById('diagramSvg');
        if (!svg) return;

        // Remove previous highlights
        svg.querySelectorAll('.station-highlight-ring').forEach(el => el.remove());
        svg.querySelectorAll('.diagram-station-label.highlighted').forEach(el => el.classList.remove('highlighted'));

        // Add highlight
        const stationG = svg.querySelector(`.diagram-station[data-id="${stationId}"]`);
        if (stationG) {
            const circle = stationG.querySelector('circle');
            const cx = circle.getAttribute('cx');
            const cy = circle.getAttribute('cy');
            const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            ring.setAttribute('cx', cx);
            ring.setAttribute('cy', cy);
            ring.setAttribute('r', '12');
            ring.setAttribute('fill', 'none');
            ring.setAttribute('stroke', '#6d82ff');
            ring.setAttribute('stroke-width', '3');
            ring.setAttribute('class', 'station-highlight-ring');
            stationG.insertBefore(ring, stationG.firstChild);

            const label = stationG.querySelector('.diagram-station-label');
            if (label) label.classList.add('highlighted');
        }
    }

    // ── Highlight Line ──
    function highlightLine(lineName) {
        if (highlightedLine === lineName) {
            highlightedLine = null;
        } else {
            highlightedLine = lineName;
        }

        const svg = document.getElementById('diagramSvg');
        if (!svg) return;

        svg.querySelectorAll('.diagram-edge').forEach(el => {
            if (!highlightedLine) {
                el.classList.remove('dimmed');
            } else {
                el.classList.toggle('dimmed', el.getAttribute('data-line') !== highlightedLine);
            }
        });

        // Update legend UI
        document.querySelectorAll('.legend-item').forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-line') === highlightedLine);
        });
    }

    // ── SVG Pan/Zoom ──
    function setupSvgPanZoom(svg) {
        const container = document.getElementById('diagramContainer');

        container.addEventListener('wheel', e => {
            e.preventDefault();
            const scale = e.deltaY > 0 ? 1.1 : 0.9;
            const rect = container.getBoundingClientRect();
            const mx = (e.clientX - rect.left) / rect.width;
            const my = (e.clientY - rect.top) / rect.height;

            const newW = svgViewBox.w * scale;
            const newH = svgViewBox.h * scale;
            svgViewBox.x += (svgViewBox.w - newW) * mx;
            svgViewBox.y += (svgViewBox.h - newH) * my;
            svgViewBox.w = newW;
            svgViewBox.h = newH;
            svg.setAttribute('viewBox', `${svgViewBox.x} ${svgViewBox.y} ${svgViewBox.w} ${svgViewBox.h}`);
        });

        container.addEventListener('mousedown', e => {
            if (e.target.closest('.diagram-station')) return;
            isPanning = true;
            panStart = { x: e.clientX, y: e.clientY };
            panViewBoxStart = { x: svgViewBox.x, y: svgViewBox.y };
        });

        container.addEventListener('mousemove', e => {
            if (!isPanning) return;
            const rect = container.getBoundingClientRect();
            const dx = (e.clientX - panStart.x) / rect.width * svgViewBox.w;
            const dy = (e.clientY - panStart.y) / rect.height * svgViewBox.h;
            svgViewBox.x = panViewBoxStart.x - dx;
            svgViewBox.y = panViewBoxStart.y - dy;
            svg.setAttribute('viewBox', `${svgViewBox.x} ${svgViewBox.y} ${svgViewBox.w} ${svgViewBox.h}`);
        });

        container.addEventListener('mouseup', () => { isPanning = false; });
        container.addEventListener('mouseleave', () => { isPanning = false; });
    }

    // ── Image Pan/Zoom ──
    function setupImagePanZoom() {
        const container = document.getElementById('imageContainer');
        const img = document.getElementById('diagramImage');
        if (!container || !img) return;

        function updateImageTransform() {
            img.style.transform = `translate(calc(-50% + ${imgPos.x}px), calc(-50% + ${imgPos.y}px)) scale(${imgScale})`;
        }

        container.addEventListener('wheel', e => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            imgScale = Math.max(0.2, Math.min(5, imgScale + delta));
            updateImageTransform();
        });

        container.addEventListener('mousedown', e => {
            imgPanning = true;
            imgPanStart = { x: e.clientX, y: e.clientY };
            imgPosStart = { x: imgPos.x, y: imgPos.y };
        });

        container.addEventListener('mousemove', e => {
            if (!imgPanning) return;
            imgPos.x = imgPosStart.x + (e.clientX - imgPanStart.x);
            imgPos.y = imgPosStart.y + (e.clientY - imgPanStart.y);
            updateImageTransform();
        });

        container.addEventListener('mouseup', () => { imgPanning = false; });
        container.addEventListener('mouseleave', () => { imgPanning = false; });

        updateImageTransform();
    }

    // ── View Switching ──
    function switchView(view) {
        currentView = view;
        const svgContainer = document.getElementById('diagramContainer');
        const imgContainer = document.getElementById('imageContainer');
        const btnInteractive = document.getElementById('viewInteractive');
        const btnImage = document.getElementById('viewImage');

        if (view === 'interactive') {
            svgContainer.style.display = '';
            imgContainer.style.display = 'none';
            btnInteractive.classList.add('active');
            btnImage.classList.remove('active');
        } else {
            svgContainer.style.display = 'none';
            imgContainer.style.display = '';
            btnInteractive.classList.remove('active');
            btnImage.classList.add('active');
        }
    }

    // ── Station Search ──
    function setupSearch() {
        const input = document.getElementById('searchStation');
        const results = document.getElementById('searchResults');
        if (!input || !results) return;

        input.addEventListener('input', () => {
            const query = input.value.trim().toLowerCase();
            results.innerHTML = '';
            if (!query || query.length < 1) return;

            const matches = stations.filter(s => s.name.toLowerCase().includes(query)).slice(0, 10);
            matches.forEach(s => {
                const lines = new Set();
                (adjacency[s.id] || []).forEach(e => lines.add(e.line));
                const div = document.createElement('div');
                div.className = 'search-result-item';
                div.innerHTML = `<div class="station-name">${s.name}</div><div class="station-lines">${Array.from(lines).join(', ')}</div>`;
                div.addEventListener('click', () => {
                    highlightStation(s.id);
                    input.value = s.name;
                    results.innerHTML = '';

                    // Center SVG on this station if in interactive mode
                    if (currentView === 'interactive') {
                        const positions = computeSchematicPositions();
                        const pos = positions[s.id];
                        if (pos) {
                            svgViewBox.x = pos.x - svgViewBox.w / 2;
                            svgViewBox.y = pos.y - svgViewBox.h / 2;
                            const svg = document.getElementById('diagramSvg');
                            svg.setAttribute('viewBox', `${svgViewBox.x} ${svgViewBox.y} ${svgViewBox.w} ${svgViewBox.h}`);
                        }
                    }
                });
                results.appendChild(div);
            });
        });
    }

    // ── Legend Click ──
    function setupLegendClicks() {
        document.querySelectorAll('.legend-item').forEach(item => {
            const text = item.textContent.trim();
            item.setAttribute('data-line', text);
            item.addEventListener('click', () => highlightLine(text));
        });
    }

    // ── Control Buttons ──
    function setupControls() {
        const zoomIn = document.getElementById('zoomInBtn');
        const zoomOut = document.getElementById('zoomOutBtn');
        const resetView = document.getElementById('resetViewBtn');

        if (zoomIn) zoomIn.addEventListener('click', () => {
            if (currentView === 'interactive') {
                svgViewBox.x += svgViewBox.w * 0.1;
                svgViewBox.y += svgViewBox.h * 0.1;
                svgViewBox.w *= 0.8;
                svgViewBox.h *= 0.8;
                document.getElementById('diagramSvg').setAttribute('viewBox',
                    `${svgViewBox.x} ${svgViewBox.y} ${svgViewBox.w} ${svgViewBox.h}`);
            } else {
                imgScale = Math.min(5, imgScale + 0.2);
                const img = document.getElementById('diagramImage');
                img.style.transform = `translate(calc(-50% + ${imgPos.x}px), calc(-50% + ${imgPos.y}px)) scale(${imgScale})`;
            }
        });

        if (zoomOut) zoomOut.addEventListener('click', () => {
            if (currentView === 'interactive') {
                svgViewBox.x -= svgViewBox.w * 0.125;
                svgViewBox.y -= svgViewBox.h * 0.125;
                svgViewBox.w *= 1.25;
                svgViewBox.h *= 1.25;
                document.getElementById('diagramSvg').setAttribute('viewBox',
                    `${svgViewBox.x} ${svgViewBox.y} ${svgViewBox.w} ${svgViewBox.h}`);
            } else {
                imgScale = Math.max(0.2, imgScale - 0.2);
                const img = document.getElementById('diagramImage');
                img.style.transform = `translate(calc(-50% + ${imgPos.x}px), calc(-50% + ${imgPos.y}px)) scale(${imgScale})`;
            }
        });

        if (resetView) resetView.addEventListener('click', () => {
            if (currentView === 'interactive') {
                svgViewBox = { x: 0, y: 0, w: 1800, h: 1200 };
                document.getElementById('diagramSvg').setAttribute('viewBox', '0 0 1800 1200');
            } else {
                imgScale = 1;
                imgPos = { x: 0, y: 0 };
                const img = document.getElementById('diagramImage');
                img.style.transform = 'translate(-50%, -50%) scale(1)';
            }
        });

        // View switch buttons
        const btnInteractive = document.getElementById('viewInteractive');
        const btnImage = document.getElementById('viewImage');
        if (btnInteractive) btnInteractive.addEventListener('click', () => switchView('interactive'));
        if (btnImage) btnImage.addEventListener('click', () => switchView('image'));
    }

    // ── Init ──
    async function init() {
        await loadData();
        setupSearch();
        setupLegendClicks();
        setupControls();
        setupImagePanZoom();
    }

    window.addEventListener('load', init);
})();
