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

let graph = { stations: [], edges: [] };
let graphById = {};
let stationIdByName = {};
let stationMarkers = {};
let currentRouteLayer = null;
let networkLayer = L.layerGroup().addTo(map);
let stationLayerGroup = L.layerGroup().addTo(map);
let adjacency = {};
let selectingFrom = true;
const lineColors = {
    U1: '#007bff', // Blue
    U2: '#dc3545', // Red
    U3: '#28a745', // Green
    U4: '#ffc107', // Yellow
    U5: '#6f42c1', // Purple
    U6: '#17a2b8', // Cyan
    U7: '#fd7e14', // Orange
    U8: '#e83e8c'  // Pink
};

function loadGraph() {
    fetch('data/metro_graph.json')
        .then(response => response.json())
        .then(data => {
            graph = data;
            initGraph();
        })
        .catch(error => {
            console.error('Lỗi tải metro_graph.json', error);
            document.getElementById('result').innerHTML = '<p>Không thể tải dữ liệu tuyến metro.</p>';
        });
}

function initGraph() {
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
    adjacency = {};
    graph.edges.forEach(edge => {
        if (!adjacency[edge.from]) adjacency[edge.from] = [];
        adjacency[edge.from].push({ to: edge.to, cost: edge.time, line: edge.line });

        if (!adjacency[edge.to]) adjacency[edge.to] = [];
        adjacency[edge.to].push({ to: edge.from, cost: edge.time, line: edge.line });
    });
}

function seedStationOptions() {
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
    const key = name.trim().toLowerCase();
    if (!key) return null;
    if (stationIdByName[key]) return stationIdByName[key];
    const exact = graph.stations.find(st => st.name.trim().toLowerCase() === key);
    if (exact) return exact.id;
    const partial = graph.stations.find(st => st.name.trim().toLowerCase().includes(key));
    return partial ? partial.id : null;
}

function dijkstra(startId, endId) {
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
    stationLayerGroup.clearLayers();
    stationMarkers = {};
    graph.stations.forEach(station => {
        const marker = L.circleMarker([station.lat, station.lon], {
            radius: 6,
            color: '#005b96',
            fillColor: '#ffffff',
            fillOpacity: 0.9,
            weight: 2
        }).addTo(stationLayerGroup);
        marker.bindPopup(`<strong>${station.name}</strong><br/>${station.id}`);
        marker.on('click', () => selectStation(station));
        stationMarkers[station.id] = marker;
    });
}

function drawNetwork() {
    networkLayer.clearLayers();
    graph.edges.forEach(edge => {
        const from = graphById[edge.from];
        const to = graphById[edge.to];
        if (!from || !to) return;
        L.polyline(
            [[from.lat, from.lon], [to.lat, to.lon]],
            { color: lineColors[edge.line] || '#7589a0', weight: 2, opacity: 0.35 }
        ).addTo(networkLayer);
    });
}

function selectStation(station) {
    if (selectingFrom) {
        document.getElementById('fromStation').value = station.name;
    } else {
        document.getElementById('toStation').value = station.name;
    }
}

function renderRoute(edges) {
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
        L.polyline(
            [[from.lat, from.lon], [to.lat, to.lon]],
            { color: lineColors[edge.line] || '#d90429', weight: 6, opacity: 0.85 }
        ).addTo(currentRouteLayer);
        
        // Đánh dấu transfer nếu line thay đổi
        if (previousLine && previousLine !== edge.line) {
            transferStations.add(edge.from);
        }
        previousLine = edge.line;
    });
    
    // Thêm markers cho transfer stations
    transferStations.forEach(stationId => {
        const station = graphById[stationId];
        L.circleMarker([station.lat, station.lon], {
            radius: 8,
            color: '#000000',
            fillColor: '#ffffff',
            fillOpacity: 1,
            weight: 3
        }).bindPopup(`<strong>Đổi tuyến tại: ${station.name}</strong>`).addTo(currentRouteLayer);
    });
    
    // Fit bounds
    const bounds = currentRouteLayer.getBounds();
    if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40] });
    }
}

function formatMinutes(value) {
    const totalSeconds = Math.round(value * 60);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return seconds === 0 ? `${minutes} phút` : `${minutes} phút ${seconds} giây`;
}

function showResult(route, fromName, toName) {
    const result = document.getElementById('result');
    if (!route) {
        result.innerHTML = `<p>Không tìm thấy lộ trình giữa <strong>${fromName}</strong> và <strong>${toName}</strong>.</p>`;
        return;
    }
    let segments = [];
    let currentSegment = null;
    route.edges.forEach(edge => {
        if (!currentSegment || currentSegment.line !== edge.line) {
            if (currentSegment) segments.push(currentSegment);
            currentSegment = { line: edge.line, from: edge.from, to: edge.to, time: edge.time };
        } else {
            currentSegment.to = edge.to;
            currentSegment.time += edge.time;
        }
    });
    if (currentSegment) segments.push(currentSegment);

    const segmentHtml = segments.map((seg, index) => {
        const from = graphById[seg.from];
        const to = graphById[seg.to];
        const stops = route.path.slice(route.path.indexOf(seg.from), route.path.indexOf(seg.to) + 1).length;
        return `<li><strong>Đoạn ${index + 1} - Tuyến ${seg.line}</strong>: ${from.name} → ${to.name} (${formatMinutes(seg.time)})<br><small>${stops} ga trên tuyến</small></li>`;
    }).join('');

    const listItems = route.path.map((id, index) => {
        const station = graphById[id];
        return `<li>${index + 1}. ${station.name}</li>`;
    }).join('');

    const transferCount = Math.max(0, segments.length - 1);

    result.innerHTML = `
        <p>Lộ trình từ <strong>${fromName}</strong> đến <strong>${toName}</strong>:</p>
        <p><strong>Tổng thời gian dự kiến:</strong> ${formatMinutes(route.cost)}</p>
        <p><strong>Số ga đi qua:</strong> ${route.path.length}</p>
        <p><strong>Số lần chuyển tuyến:</strong> ${transferCount}</p>
        <p><strong>Thời gian từng đoạn trước khi chuyển trạm:</strong></p>
        <ol>${segmentHtml}</ol>
        <p><strong>Danh sách ga:</strong></p>
        <ol>${listItems}</ol>
    `;
}

function findRoute() {
    const fromInput = document.getElementById('fromStation').value;
    const toInput = document.getElementById('toStation').value;
    const fromId = findStationIdByName(fromInput);
    const toId = findStationIdByName(toInput);
    if (!fromId || !toId) {
        document.getElementById('result').innerHTML = '<p>Vui lòng chọn ga hợp lệ từ danh sách gợi ý.</p>';
        return;
    }
    if (fromId === toId) {
        document.getElementById('result').innerHTML = '<p>Ga đi và ga đến phải khác nhau.</p>';
        return;
    }
    const route = dijkstra(fromId, toId);
    if (route) {
        showResult(route, fromInput, toInput);
        try {
            renderRoute(route.edges);
        } catch (error) {
            console.error('Lỗi khi vẽ lộ trình', error);
        }
    } else {
        showResult(route, fromInput, toInput);
    }
}

function setMapMode(mode) {
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
        selectingFrom = true;
        alert('Bấm vào marker trên bản đồ để chọn ga đi.');
    });
}
if (selectToBtn) {
    selectToBtn.addEventListener('click', () => {
        selectingFrom = false;
        alert('Bấm vào marker trên bản đồ để chọn ga đến.');
    });
}
if (fromInput) {
    fromInput.addEventListener('focus', () => selectingFrom = true);
}
if (toInput) {
    toInput.addEventListener('focus', () => selectingFrom = false);
}
