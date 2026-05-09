// Khoi tao ban do trung tam Munich.
const map = L.map("map", {
    center: [48.1371, 11.5754],
    zoom: 12,
    zoomControl: true
});

const osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
    subdomains: ["a", "b", "c"]
});

const satelliteLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19,
    attribution: "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye"
});

osmLayer.addTo(map);
map.addControl(L.control.scale());
map.addControl(L.control.zoom({ position: 'topright' }));

// graph: du lieu do thi metro sau khi nap tu stations.json va edges.json.
let graph = { stations: [], edges: [] };
let graphById = {};
let stationIdByName = {};
let stationMarkers = {};
let currentRouteLayer = null;
let networkLayer = L.layerGroup().addTo(map);
let stationLayerGroup = L.layerGroup().addTo(map);
let adjacency = {};
let selectingFrom = true;
let selectedStationMarkers = {
    from: null,
    to: null
};
let selectedStationLayer = L.layerGroup().addTo(map);
const lineColors = {
    // U-Bahn (màu chính thức MVV)
    U1: '#417AB4', // xanh dương
    U2: '#D4311E', // đỏ
    U3: '#F5821F', // cam
    U4: '#00A76D', // xanh lá
    U5: '#BF7F50', // nâu
    U6: '#0065A3', // xanh navy
    U7: '#8246AF', // tím (U7 = U1+U2 blend)
    U8: '#C4071C', // đỏ đậm (U8 = U2+U3 blend)
    // S-Bahn (màu chính thức MVV)
    S1: '#1A9BD7', // xanh nhạt
    S2: '#76B82A', // xanh lá nhạt
    S3: '#951B81', // tím hồng
    S4: '#E2001A', // đỏ tươi
    S6: '#00A550', // xanh lá đậm
    S7: '#964B00', // nâu đậm
    S8: '#000000', // đen (Flughafen)
    // Fallback
    U:  '#417AB4',
    S:  '#1A9BD7',
    US: '#888888',
};

function loadGraph() {
    // Thu tu fallback: API backend -> file local frontend -> file local root data.
    const stationsSources = [
        'http://127.0.0.1:5000/api/stations',
        './stations.json',
        '/data/stations.json',
        '../data/stations.json'
    ];
    
    const edgesSources = [
        'http://127.0.0.1:5000/api/edges',
        './edges.json',
        '/data/edges.json',
        '../data/edges.json'
    ];

    let stationsData = null;
    let edgesData = null;
    let stationsDone = false;
    let edgesDone = false;

    const tryLoadStations = index => {
        if (index >= stationsSources.length) {
            document.getElementById('result').innerHTML = '<p>Không thể tải dữ liệu stations.json. Hãy chạy backend hoặc đặt file stations.json trong thư mục frontend.</p>';
            return;
        }

        const url = stationsSources[index];
        console.log('Loading stations from:', url);
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok: ' + response.status);
                }
                return response.json();
            })
            .then(data => {
                if (!data || !Array.isArray(data)) {
                    throw new Error('Invalid stations payload');
                }
                console.log('Stations loaded:', data.length, 'stations');
                stationsData = data;
                stationsDone = true;
                if (stationsDone && edgesDone) {
                    graph = { stations: stationsData, edges: edgesData };
                    initGraph();
                }
            })
            .catch(error => {
                console.warn('Load failed from source:', url, error);
                tryLoadStations(index + 1);
            });
    };

const tryLoadEdges = index => {
    if (index >= edgesSources.length) {
        document.getElementById('result').innerHTML = '<p>Không thể tải dữ liệu edges.json. Hãy chạy backend hoặc đặt file edges.json trong thư mục frontend.</p>';
        return;
    }

    const url = edgesSources[index];
    console.log('Loading edges from:', url);
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok: ' + response.status);
            }
            return response.json();
        })
        .then(data => {
            console.log('Raw edges data:', data);
            
            // Kiểm tra nhiều cấu trúc dữ liệu khác nhau
            let edgesArray = null;
            
            if (Array.isArray(data)) {
                edgesArray = data;
                console.log('Data is array, length:', edgesArray.length);
            } 
            else if (data && typeof data === 'object') {
                if (Array.isArray(data.connections)) {
                    edgesArray = data.connections;
                    console.log('Found connections array, length:', edgesArray.length);
                }
                else if (Array.isArray(data.edges)) {
                    edgesArray = data.edges;
                    console.log('Found edges array, length:', edgesArray.length);
                }
                else if (data.data && Array.isArray(data.data)) {
                    edgesArray = data.data;
                    console.log('Found data array, length:', edgesArray.length);
                }
            }
            
            if (!edgesArray || edgesArray.length === 0) {
                console.error('Invalid edges payload:', data);
                throw new Error('Invalid edges payload: no connections/edges array found');
            }
            
            // Suy ra line từ prefix của station ID vì edges.json không có trường line.
            // US_ = ga dùng chung U+S, ưu tiên theo đầu kia.
            // U_ → U-Bahn, S_ → S-Bahn, US_ → xét đầu còn lại.
            const inferLine = (fromId, toId) => {
                const fromPrefix = (fromId || '').split('_')[0];
                const toPrefix = (toId || '').split('_')[0];
                if (fromPrefix === 'U') return 'U';
                if (fromPrefix === 'S') return 'S';
                if (fromPrefix === 'US') {
                    if (toPrefix === 'U') return 'U';
                    if (toPrefix === 'S') return 'S';
                    return 'US';
                }
                return fromPrefix || 'U';
            };

            // Transform dữ liệu
            edgesData = edgesArray.map(edge => {
                const fromId = edge.from_id || edge.from;
                const toId = edge.to_id || edge.to;
                return {
                    from: fromId,
                    to: toId,
                    time: edge.time_min || edge.time || 1,
                    line: edge.line || inferLine(fromId, toId)
                };
            });
            
            console.log('Transformed edges:', edgesData.length, 'edges');
            console.log('First edge sample:', edgesData[0]);
            
            edgesDone = true;
            if (stationsDone && edgesDone) {
                graph = { stations: stationsData, edges: edgesData };
                initGraph();
            }
        })
        .catch(error => {
            console.warn('Load failed from source:', url, error);
            tryLoadEdges(index + 1);
        });
};

    tryLoadStations(0);
    tryLoadEdges(0);
}

function initGraph() {
    // Tao cac index de tra cuu nhanh khi tim duong va ve ban do.
    graphById = {};
    stationIdByName = {};
    graph.stations.forEach(station => {
        graphById[station.id] = station;
        stationIdByName[station.name.trim().toLowerCase()] = station.id;
    });
    buildAdjacency();
    seedStationOptions();
    drawNetwork();
    drawStations();
    const markers = Object.values(stationMarkers);
    if (markers.length > 0) {
        const bounds = L.featureGroup(markers).getBounds();
        if (bounds.isValid()) {
            map.fitBounds(bounds.pad(0.2));
        }
    }
}

function buildAdjacency() {
    // Danh sach ke 2 chieu de chay Dijkstra tren do thi vo huong.
    adjacency = {};
    graph.edges.forEach(edge => {
        if (!adjacency[edge.from]) adjacency[edge.from] = [];
        adjacency[edge.from].push({ to: edge.to, cost: edge.time, line: edge.line });

        if (!adjacency[edge.to]) adjacency[edge.to] = [];
        adjacency[edge.to].push({ to: edge.from, cost: edge.time, line: edge.line });
    });
}

function seedStationOptions() {
    // Do danh sach ga vao datalist de ho tro goi y ten ga.
    const datalist = document.getElementById('stations');
    datalist.innerHTML = '';
    graph.stations
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'de'))
        .forEach(station => {
            const option = document.createElement('option');
            option.value = station.name;
            datalist.appendChild(option);
        });
}

function findStationIdByName(name) {
    // Uu tien tim exact match, fallback sang partial match de de su dung.
    const key = name.trim().toLowerCase();
    if (!key) return null;
    if (stationIdByName[key]) return stationIdByName[key];
    const exact = graph.stations.find(st => st.name.trim().toLowerCase() === key);
    if (exact) return exact.id;
    const partial = graph.stations.find(st => st.name.trim().toLowerCase().includes(key));
    return partial ? partial.id : null;
}

function dijkstra(startId, endId) {
    // Tim duong di ngan nhat theo tong thoi gian di chuyen giua cac ga.
    const costs = {};
    const previous = {};
    const visited = new Set();
    const nodes = Object.keys(graphById);
    nodes.forEach(node => {
        costs[node] = Infinity;
    });
    costs[startId] = 0;

    while (visited.size < nodes.length) {
        let current = null;
        nodes.forEach(node => {
            if (!visited.has(node) && (current === null || costs[node] < costs[current])) {
                current = node;
            }
        });
        if (!current || costs[current] === Infinity) break;
        if (current === endId) break;
        visited.add(current);

        const neighbors = adjacency[current] || [];
        neighbors.forEach(edge => {
            const alt = costs[current] + edge.cost;
            if (alt < costs[edge.to]) {
                costs[edge.to] = alt;
                previous[edge.to] = { id: current, line: edge.line, cost: edge.cost };
            }
        });
    }

    if (costs[endId] === Infinity) return null;
    const path = [];
    const edgeDetails = [];
    let node = endId;
    while (node && node !== startId) {
        const prev = previous[node];
        if (!prev) break;
        path.unshift(node);
        edgeDetails.unshift({ from: prev.id, to: node, line: prev.line, time: prev.cost });
        node = prev.id;
    }
    path.unshift(startId);
    return { path, cost: costs[endId], edges: edgeDetails };
}

function drawStations() {
    // Ve marker cho tung ga va cho phep click de gan ga di/den.
    console.log('Drawing stations, count:', graph.stations.length);
    stationLayerGroup.clearLayers();
    stationMarkers = {};
    graph.stations.forEach(station => {
        console.log('Drawing station:', station.name, station.lat, station.lon);
        const operationStatus = getStationOperationStatus(station.id);
        const statusColor = operationStatus.statusLabel === 'Đóng' ? '#b42318' : '#027a48';
        const statusText = operationStatus.statusLabel === 'Đóng'
            ? `Đóng${operationStatus.reason ? ` - ${operationStatus.reason}` : ''}`
            : 'Mở';
        const marker = L.circleMarker([station.lat, station.lon], {
            radius: 6,
            color: '#005b96',
            fillColor: '#ffffff',
            fillOpacity: 0.9,
            weight: 2
        }).addTo(stationLayerGroup);
        marker.bindPopup(`<strong>${station.name}</strong><br/>${station.id}<br/><span style="color:${statusColor};font-weight:700;">Trạng thái: ${statusText}</span>`);
        marker.on('click', () => selectStation(station));
        stationMarkers[station.id] = marker;
    });
    console.log('Stations drawn, markers count:', Object.keys(stationMarkers).length);
}

function createCustomPinIcon(markerType) {
    // Tạo SVG pin marker
    let color = markerType === 'from' ? '#4CAF50' : '#F44336';
    let strokeColor = markerType === 'from' ? '#2E7D32' : '#C62828';
    
    const svg = `
        <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 1 C28 1 35 8 35 15 C35 25 20 48 20 48 C20 48 5 25 5 15 C5 8 12 1 20 1 Z" 
                  fill="${color}" stroke="${strokeColor}" stroke-width="2"/>
            <circle cx="20" cy="15" r="6" fill="white" stroke="${strokeColor}" stroke-width="1.5"/>
        </svg>
    `;
    
    return L.icon({
        iconUrl: 'data:image/svg+xml;base64,' + btoa(svg),
        iconSize: [40, 50],
        iconAnchor: [20, 50],
        popupAnchor: [0, -40],
        className: `station-marker-${markerType}`
    });
}

function markStationOnMap(stationId, markerType = 'from') {
    // Xóa marker cũ nếu có
    if (selectedStationMarkers[markerType]) {
        selectedStationLayer.removeLayer(selectedStationMarkers[markerType]);
    }
    
    const station = graphById[stationId];
    if (!station) return;
    
    // Xác định tên loại ga
    const label = markerType === 'from' ? 'Ga đi' : 'Ga đến';
    
    // Tạo custom pin marker
    const marker = L.marker([station.lat, station.lon], {
        icon: createCustomPinIcon(markerType)
    });
    
    // Thêm popup hiển thị loại ga
    marker.bindPopup(`<strong>${label}</strong><br/>${station.name}`);
    marker.openPopup();
    
    marker.addTo(selectedStationLayer);
    selectedStationMarkers[markerType] = marker;
}

function clearStationMarker(markerType = 'from') {
    // Xóa marker của ga đã chọn
    if (selectedStationMarkers[markerType]) {
        selectedStationLayer.removeLayer(selectedStationMarkers[markerType]);
        selectedStationMarkers[markerType] = null;
    }
}

function drawNetwork() {
    networkLayer.clearLayers();
    graph.edges.forEach(edge => {
        const from = graphById[edge.from];
        const to = graphById[edge.to];
        if (!from || !to) return;
        const color = lineColors[edge.line] || '#7589a0';
        L.polyline(
            [[from.lat, from.lon], [to.lat, to.lon]],
            { color, weight: 2, opacity: 0.4 }
        ).addTo(networkLayer);
    });
}

function selectStation(station) {
    if (selectingFrom) {
        document.getElementById('fromStation').value = station.name;
        markStationOnMap(station.id, 'from');
    } else {
        document.getElementById('toStation').value = station.name;
        markStationOnMap(station.id, 'to');
    }
}

function renderRoute(edges) {
    // Ve tuyen ket qua voi do day lon hon va danh dau cac ga doi tuyen.
    if (currentRouteLayer) {
        map.removeLayer(currentRouteLayer);
    }
    currentRouteLayer = L.layerGroup().addTo(map);

    let transferStations = new Set();
    let previousLine = null;
    edges.forEach(edge => {
        const from = graphById[edge.from];
        const to = graphById[edge.to];
        if (!from || !to) return;

        // Vẽ polyline cho segment
        const polyline = L.polyline(
            [[from.lat, from.lon], [to.lat, to.lon]],
            { color: lineColors[edge.line] || '#d90429', weight: 6, opacity: 0.85 }
        );
        polyline.addTo(currentRouteLayer);

        // Đánh dấu transfer nếu line thay đổi
        if (previousLine && previousLine !== edge.line) {
            transferStations.add(edge.from);
        }
        previousLine = edge.line;
    });

    // Thêm markers cho transfer stations
    transferStations.forEach(stationId => {
        const station = graphById[stationId];
        const marker = L.circleMarker([station.lat, station.lon], {
            radius: 8,
            color: '#000000',
            fillColor: '#ffffff',
            fillOpacity: 1,
            weight: 3
        }).bindPopup(`<strong>Đổi tuyến tại: ${station.name}</strong>`);
        marker.addTo(currentRouteLayer);
    });

    // Fit bounds using featureGroup
    const layers = currentRouteLayer.getLayers();
    if (layers.length > 0) {
        try {
            const featureGroup = L.featureGroup(layers);
            const bounds = featureGroup.getBounds();
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [40, 40] });
            }
        } catch (error) {
            console.error('Error fitting bounds:', error);
        }
    }
}

function formatMinutes(value) {
    const totalSeconds = Math.round(value * 60);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return seconds === 0 ? `${minutes} phút` : `${minutes} phút ${seconds} giây`;
}

function haversineKm(lat1, lon1, lat2, lon2) {
    const earthRadiusKm = 6371;
    const toRadians = degrees => degrees * Math.PI / 180;
    const deltaLat = toRadians(lat2 - lat1);
    const deltaLon = toRadians(lon2 - lon1);
    const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLon / 2) ** 2;
    return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistanceKm(value) {
    if (value == null || Number.isNaN(value)) return 'không rõ khoảng cách';
    return `${value.toFixed(2)} km`;
}

function getStationDistanceKm(fromId, toId) {
    const from = graphById[fromId];
    const to = graphById[toId];
    if (!from || !to) return null;
    const fromLat = Number(from.lat);
    const fromLon = Number(from.lon);
    const toLat = Number(to.lat);
    const toLon = Number(to.lon);
    if ([fromLat, fromLon, toLat, toLon].some(Number.isNaN)) return null;
    return haversineKm(fromLat, fromLon, toLat, toLon);
}

function getBlockedLinesFromAdminState() {
    // Doc du lieu quan tri tu localStorage de biet tuyen nao dang bi cam.
    const storageKey = 'metroAdminStateV1';
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.lines)) return new Set();
        return new Set(
            parsed.lines
                .filter(line => line && line.blocked)
                .map(line => line.id)
        );
    } catch (error) {
        console.warn('Cannot parse admin state from localStorage:', error);
        return new Set();
    }
}

function getRouteOperationStatus(route) {
    // Mac dinh la "Mo". Neu co it nhat 1 tuyen trong lo trinh bi cam thi "Dong".
    const blockedLines = getBlockedLinesFromAdminState();
    if (blockedLines.size === 0 || !route || !Array.isArray(route.edges)) {
        return { statusLabel: 'Mở', blockedRouteLines: [] };
    }

    const blockedRouteLines = Array.from(
        new Set(route.edges.map(edge => edge.line).filter(line => blockedLines.has(line)))
    );

    return blockedRouteLines.length > 0
        ? { statusLabel: 'Đóng', blockedRouteLines }
        : { statusLabel: 'Mở', blockedRouteLines: [] };
}

function getStationOperationStatus(stationId) {
    // Mặc định là mở. Nếu admin đóng ga thì popup hiển thị Đóng.
    try {
        const raw = localStorage.getItem('metroAdminStateV1');
        if (!raw) return { statusLabel: 'Mở', reason: '' };

        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.stations)) {
            return { statusLabel: 'Mở', reason: '' };
        }

        const station = parsed.stations.find(item => item && item.id === stationId);
        if (!station || !station.closed) {
            return { statusLabel: 'Mở', reason: '' };
        }

        return {
            statusLabel: 'Đóng',
            reason: station.reason || 'Đang tạm dừng hoạt động'
        };
    } catch (error) {
        console.warn('Cannot parse station admin state from localStorage:', error);
        return { statusLabel: 'Mở', reason: '' };
    }
}

function centerMapToStation(stationId) {
    // Định tâm bản đồ đến vị trí ga và phóng to để xem rõ.
    const station = graphById[stationId];
    if (!station) return;
    map.setView([station.lat, station.lon], 15);
    // Hiển thị popup của marker ga
    if (stationMarkers[stationId]) {
        stationMarkers[stationId].openPopup();
    }
}

function showResult(route, fromName, toName) {
    // Gom cac canh lien tiep cung line thanh segment de hien thi de doc.
    const result = document.getElementById('result');
    if (!route) {
        result.innerHTML = `<p>Không tìm thấy lộ trình giữa <strong>${fromName}</strong> và <strong>${toName}</strong>.</p>`;
        return;
    }
    let segments = [];
    let currentSegment = null;
    route.edges.forEach(edge => {
        const distance = getStationDistanceKm(edge.from, edge.to);
        if (!currentSegment || currentSegment.line !== edge.line) {
            if (currentSegment) segments.push(currentSegment);
            currentSegment = { line: edge.line, from: edge.from, to: edge.to, time: edge.time, distance: distance || 0 };
        } else {
            currentSegment.to = edge.to;
            currentSegment.time += edge.time;
            currentSegment.distance += distance || 0;
        }
    });
    if (currentSegment) segments.push(currentSegment);

    const totalDistance = segments.reduce((sum, seg) => sum + (seg.distance || 0), 0);

    const segmentHtml = segments.map((seg, index) => {
        const from = graphById[seg.from];
        const to = graphById[seg.to];
        const stops = route.path.slice(route.path.indexOf(seg.from), route.path.indexOf(seg.to) + 1).length;
        return `<li><strong>Đoạn ${index + 1} - Tuyến ${seg.line}</strong>: ${from.name} → ${to.name} (${formatMinutes(seg.time)}, ${formatDistanceKm(seg.distance)})<br><small>${stops} ga trên tuyến</small></li>`;
    }).join('');

    const listItems = route.path.map((id, index) => {
        const station = graphById[id];
        return `<li><span class="station-link" data-station-id="${id}" style="cursor: pointer; color: #0066cc; text-decoration: underline;">${index + 1}. ${station.name}</span></li>`;
    }).join('');

    const transferCount = Math.max(0, segments.length - 1);
    const operationStatus = getRouteOperationStatus(route);
    const blockedLinesText = operationStatus.blockedRouteLines.length > 0
        ? ` (${operationStatus.blockedRouteLines.join(', ')} đang bị cấm)`
        : '';

    result.innerHTML = `
        <p>Lộ trình từ <strong>${fromName}</strong> đến <strong>${toName}</strong>:</p>
        <p><strong>Trạng thái vận hành:</strong> ${operationStatus.statusLabel}${blockedLinesText}</p>
        <p><strong>Tổng thời gian dự kiến:</strong> ${formatMinutes(route.cost)}</p>
        <p><strong>Tổng khoảng cách ước tính:</strong> ${formatDistanceKm(totalDistance)}</p>
        <p><strong>Số ga đi qua:</strong> ${route.path.length}</p>
        <p><strong>Số lần chuyển tuyến:</strong> ${transferCount}</p>
        <p><strong>Thời gian từng đoạn trước khi chuyển trạm:</strong></p>
        <ol>${segmentHtml}</ol>
        <p><strong>Danh sách ga:</strong></p>
        <ol>${listItems}</ol>
    `;

    // Thêm event listeners cho các ga trong danh sách để điều hướng bản đồ
    document.querySelectorAll('.station-link').forEach(link => {
        link.addEventListener('click', () => {
            const stationId = link.getAttribute('data-station-id');
            centerMapToStation(stationId);
        });
        // Thêm hiệu ứng hover
        link.addEventListener('mouseenter', () => {
            link.style.fontWeight = 'bold';
            link.style.textDecoration = 'underline double';
        });
        link.addEventListener('mouseleave', () => {
            link.style.fontWeight = 'normal';
            link.style.textDecoration = 'underline';
        });
    });
}

async function findRoute() {
    const fromInput = document.getElementById('fromStation').value;
    const toInput = document.getElementById('toStation').value;

    if (!fromInput || !toInput) {
        document.getElementById('result').innerHTML = '<p>Vui lòng chọn ga hợp lệ từ danh sách gợi ý.</p>';
        return;
    }
    if (fromInput === toInput) {
        document.getElementById('result').innerHTML = '<p>Ga đi và ga đến phải khác nhau.</p>';
        return;
    }

    try {
        console.log('Calling API with:', { source: fromInput, target: toInput });
        const response = await fetch('http://127.0.0.1:5000/api/path', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: fromInput, target: toInput })
        });

        console.log('Response status:', response.status);
        const result = await response.json();
        console.log('Response data:', result);

        if (!response.ok || result.error) {
            throw new Error(result.error || 'Backend path API failed');
        }

        // Rebuild edges từ path
        const edgeDetails = [];
        for (let i = 0; i < result.path.length - 1; i++) {
            const fromId = result.path[i];
            const toId = result.path[i + 1];
            const neighbors = adjacency[fromId] || [];
            const edge = neighbors.find(e => e.to === toId);
            if (edge) {
                edgeDetails.push({ from: fromId, to: toId, line: edge.line, time: edge.cost });
            }
        }

        const route = { path: result.path, cost: result.cost, edges: edgeDetails };
        showResult(route, fromInput, toInput);
        renderRoute(route.edges);
    } catch (error) {
        console.warn('Backend unavailable, switching to local Dijkstra:', error);
        const fromId = findStationIdByName(fromInput);
        const toId = findStationIdByName(toInput);
        if (!fromId || !toId) {
            document.getElementById('result').innerHTML = '<p>Không tìm thấy ga trong dữ liệu hiện có.</p>';
            return;
        }
        const route = dijkstra(fromId, toId);
        showResult(route, fromInput, toInput);
        if (route) {
            renderRoute(route.edges);
        }
    }
}

function setMapMode(mode) {
    // Chuyen qua lai giua nen ban do thuong va nen ve tinh.
    if (mode === 'satellite') {
        map.removeLayer(osmLayer);
        satelliteLayer.addTo(map);
    } else {
        map.removeLayer(satelliteLayer);
        osmLayer.addTo(map);
    }
    document.querySelectorAll('.map-switch button').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.trim() === (mode === 'satellite' ? 'Vệ tinh' : 'Bản đồ'));
    });
}

loadGraph();
setMapMode('map');

window.addEventListener('load', () => {
    // Dam bao map tinh lai kich thuoc sau khi layout render xong.
    setTimeout(() => {
        map.invalidateSize(true);
    }, 200);
});

document.getElementById('findRouteBtn').addEventListener('click', findRoute);
document.querySelectorAll('.map-switch button').forEach(button => {
    button.addEventListener('click', () => {
        const mode = button.textContent.trim() === 'Vệ tinh' ? 'satellite' : 'map';
        setMapMode(mode);
    });
});

const selectFromBtn = document.getElementById('selectFromBtn');
const selectToBtn = document.getElementById('selectToBtn');
const fromInput = document.getElementById('fromStation');
const toInput = document.getElementById('toStation');

if (selectFromBtn) {
    selectFromBtn.addEventListener('click', () => {
        // Bat che do chon ga di truc tiep bang click marker.
        selectingFrom = true;
        alert('Bấm vào marker trên bản đồ để chọn ga đi.');
    });
}
if (selectToBtn) {
    selectToBtn.addEventListener('click', () => {
        // Bat che do chon ga den truc tiep bang click marker.
        selectingFrom = false;
        alert('Bấm vào marker trên bản đồ để chọn ga đến.');
    });
}
if (fromInput) {
    fromInput.addEventListener('focus', () => selectingFrom = true);
    fromInput.addEventListener('change', () => {
        if (fromInput.value.trim()) {
            const stationId = findStationIdByName(fromInput.value);
            if (stationId) {
                markStationOnMap(stationId, 'from');
            }
        } else {
            clearStationMarker('from');
        }
    });
    fromInput.addEventListener('input', () => {
        if (!fromInput.value.trim()) {
            clearStationMarker('from');
        }
    });
}
if (toInput) {
    toInput.addEventListener('focus', () => selectingFrom = false);
    toInput.addEventListener('change', () => {
        if (toInput.value.trim()) {
            const stationId = findStationIdByName(toInput.value);
            if (stationId) {
                markStationOnMap(stationId, 'to');
            }
        } else {
            clearStationMarker('to');
        }
    });
    toInput.addEventListener('input', () => {
        if (!toInput.value.trim()) {
            clearStationMarker('to');
        }
    });
}
