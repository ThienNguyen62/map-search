// Khoi tao ban do trung tam Munich.
// Global error handlers to surface JS errors into the UI for easier debugging
window.addEventListener('error', function (ev) {
    console.error('Unhandled error:', ev.error || ev.message || ev);
    try {
        const res = document.getElementById('result');
        if (res) res.innerHTML = `<p style="color:#f88"><strong>Lỗi JavaScript:</strong> ${String(ev.error || ev.message || ev).replace(/</g,'&lt;')}</p>`;
        const mapEl = document.getElementById('map');
        if (mapEl) mapEl.innerHTML = `<div style="padding:20px;color:#333;background:#fff;border-radius:8px;margin:10px;">Lỗi JavaScript ngăn bản đồ hiển thị. Mở Console (F12) để xem chi tiết.</div>`;
    } catch (e) {}
});
window.addEventListener('unhandledrejection', function (ev) {
    console.error('Unhandled rejection:', ev.reason);
    try {
        const res = document.getElementById('result');
        if (res) res.innerHTML = `<p style="color:#f88"><strong>Unhandled promise rejection:</strong> ${String(ev.reason).replace(/</g,'&lt;')}</p>`;
    } catch (e) {}
});

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
let customPointMarkers = { from: null, to: null };
let customPoints = { from: null, to: null };
let selectedStationIds = { from: null, to: null };
let walkingLayer = L.layerGroup().addTo(map);
let routeLayers = []; // array of { layerGroup, meta }
let routeColors = ['#e41a1c','#377eb8','#4daf4a','#984ea3','#ff7f00'];
let selectedRouteIndex = 0;
let lastRoutesList = [];
let lastWalkingFrom = null;
let lastWalkingTo = null;
let lastFromDisplay = '';
let lastToDisplay = '';
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
        '../data/stations.json',
        '../../data/stations.json'
    ];
    
    const edgesSources = [
        'http://127.0.0.1:5000/api/edges',
        './edges.json',
        '/data/edges.json',
        '../data/edges.json',
        '../../data/edges.json'
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

async function computeAndShowFullRoute() {
    // clear previous layers
    if (currentRouteLayer) {
        try { map.removeLayer(currentRouteLayer); } catch (e) {}
        currentRouteLayer = null;
    }
    walkingLayer.clearLayers();

    const fromInputVal = document.getElementById('fromStation').value;
    const toInputVal = document.getElementById('toStation').value;

    // resolve from station id
    let fromStationId = null;
    let walkingFrom = null;
    let fromLabel = fromInputVal || '';

    if (selectedStationIds.from) {
        fromStationId = selectedStationIds.from;
        fromLabel = graphById[fromStationId] ? graphById[fromStationId].name : fromLabel;
    } else if (customPoints.from) {
        const best = findNearestStation(customPoints.from.lat, customPoints.from.lon);
        if (!best) {
            document.getElementById('result').innerHTML = '<p>Không có dữ liệu ga để tìm ga gần nhất.</p>';
            return;
        }
        fromStationId = best.id;
        walkingFrom = { distanceKm: best.distanceKm, time: best.walkMinutes, station: best.station, point: customPoints.from };
        fromLabel = `Điểm (${customPoints.from.lat.toFixed(5)}, ${customPoints.from.lon.toFixed(5)})`;
    } else {
        // try parse input as station name
        const sid = findStationIdByName(fromInputVal || '');
        if (sid) {
            fromStationId = sid;
            selectedStationIds.from = sid;
        }
    }

    // resolve to station id
    let toStationId = null;
    let walkingTo = null;
    let toLabel = toInputVal || '';

    if (selectedStationIds.to) {
        toStationId = selectedStationIds.to;
        toLabel = graphById[toStationId] ? graphById[toStationId].name : toLabel;
    } else if (customPoints.to) {
        const best = findNearestStation(customPoints.to.lat, customPoints.to.lon);
        if (!best) {
            document.getElementById('result').innerHTML = '<p>Không có dữ liệu ga để tìm ga gần nhất.</p>';
            return;
        }
        toStationId = best.id;
        walkingTo = { distanceKm: best.distanceKm, time: best.walkMinutes, station: best.station, point: customPoints.to };
        toLabel = `Điểm (${customPoints.to.lat.toFixed(5)}, ${customPoints.to.lon.toFixed(5)})`;
    } else {
        const sid = findStationIdByName(toInputVal || '');
        if (sid) {
            toStationId = sid;
            selectedStationIds.to = sid;
        }
    }

    if (!fromStationId || !toStationId) {
        document.getElementById('result').innerHTML = '<p>Vui lòng chọn điểm đi và điểm đến (ga hoặc vị trí trên bản đồ).</p>';
        return;
    }

    // if both are stations -> run metro path
    let metroRoute = null;
    try {
        const resp = await fetch('http://127.0.0.1:5000/api/path', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: fromStationId, target: toStationId })
        });
        const json = await resp.json();
        if (resp.ok && !json.error) {
            metroRoute = json;
        } else {
            throw new Error('Backend path failed');
        }
    } catch (err) {
        // fallback to local Dijkstra
        const route = dijkstra(fromStationId, toStationId);
        metroRoute = route;
    }

    // draw metro edges
    // metroRoute may be a single route object or an object with 'routes' array
    let routesList = [];
    if (metroRoute) {
        if (Array.isArray(metroRoute.routes)) {
            routesList = metroRoute.routes;
        } else if (Array.isArray(metroRoute.path)) {
            // single route returned
            routesList = [{ path: metroRoute.path, metro_time: metroRoute.cost || 0, transfers: 0, stops: (metroRoute.path||[]).length, lines: [] }];
        }
    }

    if (!routesList.length) {
        document.getElementById('result').innerHTML = '<p>Không tìm thấy lộ trình metro.</p>';
        return;
    }

    // store last search results for UI actions (delete, re-render)
    lastRoutesList = routesList.slice();
    lastWalkingFrom = walkingFrom;
    lastWalkingTo = walkingTo;
    lastFromDisplay = fromLabel;
    lastToDisplay = toLabel;

    // Render all routes on map
    renderAllRoutes(routesList, walkingFrom, walkingTo);

    // build routes list UI and attach handlers
    updateRoutesUI();
    // default select best (index 0)
    selectRoute(0);

    // draw walking segments using road network where possible
    const allBounds = [];
    const walkingLegPromises = [];
    if (walkingFrom) {
        const p = walkingFrom.point;
        const s = walkingFrom.station;
        walkingLegPromises.push((async () => {
            const res = await fetchAndDrawWalkingLeg(p, s, { color: '#2f4f4f' });
            // draw origin marker
            const m = L.circleMarker([p.lat, p.lon], { radius: 7, color: '#2E7D32', fillColor: '#2E7D32', fillOpacity: 0.9 }).bindPopup(`<strong>Điểm đi</strong><br/>Đi bộ đến: ${s.name}<br/>${formatDistanceKm(res.distance||walkingFrom.distanceKm)} - ${formatMinutes(res.timeMin||walkingFrom.time)}`);
            m.addTo(walkingLayer);
            if (res && res.bounds) allBounds.push(res.bounds);
        })());
    }
    if (walkingTo) {
        const p = walkingTo.point;
        const s = walkingTo.station;
        walkingLegPromises.push((async () => {
            const res = await fetchAndDrawWalkingLeg(p, s, { color: '#2f4f4f' });
            const m = L.circleMarker([p.lat, p.lon], { radius: 7, color: '#C62828', fillColor: '#C62828', fillOpacity: 0.9 }).bindPopup(`<strong>Điểm đến</strong><br/>Từ: ${s.name}<br/>${formatDistanceKm(res.distance||walkingTo.distanceKm)} - ${formatMinutes(res.timeMin||walkingTo.time)}`);
            m.addTo(walkingLayer);
            if (res && res.bounds) allBounds.push(res.bounds);
        })());
    }
    // wait for walking legs to finish drawing before fitting bounds
    await Promise.all(walkingLegPromises);

    // include metro route bounds
    try {
        if (currentRouteLayer) {
            const layers = currentRouteLayer.getLayers();
            if (layers.length) {
                const fg = L.featureGroup(layers);
                allBounds.push(fg.getBounds());
            }
        }
        // also include selected station markers
        const selLayers = selectedStationLayer.getLayers();
        if (selLayers.length) {
            allBounds.push(L.featureGroup(selLayers).getBounds());
        }
        // compute aggregate bounds
        const validBounds = allBounds.filter(b => b && b.isValid && b.isValid());
        if (validBounds.length) {
            // merge bounds
            let merged = validBounds[0];
            for (let i = 1; i < validBounds.length; i++) merged = merged.extend(validBounds[i]);
            map.fitBounds(merged, { padding: [40,40] });
        }
    } catch (err) {
        console.warn('Failed to fit bounds for full route', err);
    }

    // compute labels for display handled earlier when rendering routes
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
        // mark as station selection and clear any custom point
        selectedStationIds.from = station.id;
        if (customPointMarkers.from) {
            customPointMarkers.from.remove();
            customPointMarkers.from = null;
            customPoints.from = null;
        }
    } else {
        document.getElementById('toStation').value = station.name;
        markStationOnMap(station.id, 'to');
        selectedStationIds.to = station.id;
        if (customPointMarkers.to) {
            customPointMarkers.to.remove();
            customPointMarkers.to = null;
            customPoints.to = null;
        }
    }
}

function findNearestStation(lat, lon) {
    if (!graph || !Array.isArray(graph.stations) || graph.stations.length === 0) return null;
    let best = null;
    graph.stations.forEach(st => {
        const d = haversineKm(Number(lat), Number(lon), Number(st.lat), Number(st.lon));
        if (best === null || d < best.distanceKm) {
            best = { id: st.id, station: st, distanceKm: d };
        }
    });
    if (!best) return null;
    // assume walking speed 5 km/h => 12 minutes per km
    best.walkMinutes = best.distanceKm * 12;
    return best;
}

function clearCustomPoint(markerType) {
    if (customPointMarkers[markerType]) {
        try { customPointMarkers[markerType].remove(); } catch (e) {}
        customPointMarkers[markerType] = null;
    }
    customPoints[markerType] = null;
}

function createPointMarker(lat, lon, markerType = 'from') {
    // reuse SVG pin icon for consistency
    const icon = createCustomPinIcon(markerType);
    const marker = L.marker([lat, lon], { icon });
    marker.addTo(map);
    return marker;
}

function updateSelectionStatusText() {
    // selection status text removed from UI — no-op
    return;
}

function renderRoute(edges) {
    // Legacy single-route renderer (not used when multiple routes present)
    if (currentRouteLayer) {
        try { map.removeLayer(currentRouteLayer); } catch (e) {}
    }
    currentRouteLayer = L.layerGroup().addTo(map);
    edges.forEach(edge => {
        const from = graphById[edge.from];
        const to = graphById[edge.to];
        if (!from || !to) return;
        const polyline = L.polyline([[from.lat, from.lon], [to.lat, to.lon]], { color: lineColors[edge.line] || '#d90429', weight: 6, opacity: 0.85 });
        polyline.addTo(currentRouteLayer);
    });
}

function clearAllRouteLayers() {
    routeLayers.forEach(r => {
        try { map.removeLayer(r.layerGroup); } catch (e) {}
    });
    routeLayers = [];
    selectedRouteIndex = 0;
}

function removeRoute(index) {
    if (index < 0 || index >= routeLayers.length) return;
    // remove layer from map
    try { map.removeLayer(routeLayers[index].layerGroup); } catch (e) {}
    // remove from arrays
    routeLayers.splice(index, 1);
    lastRoutesList.splice(index, 1);

    // if no routes remain, clear UI
    if (lastRoutesList.length === 0) {
        clearAllRouteLayers();
        walkingLayer.clearLayers();
        document.getElementById('result').innerHTML = `<p>Không có tuyến nào để hiển thị.</p>`;
        return;
    }

    // re-render remaining routes and UI
    renderAllRoutes(lastRoutesList, lastWalkingFrom, lastWalkingTo);
    updateRoutesUI();
    // adjust selection
    selectedRouteIndex = Math.min(index, lastRoutesList.length - 1);
    // highlight current
    const elem = document.querySelector(`.route-item[data-idx="${selectedRouteIndex}"]`);
    if (elem) elem.style.background = '#f3f9ff';
    // show details for selected route
    const sel = routeLayers[selectedRouteIndex];
    if (sel) {
        const edges = buildEdgeDetailsFromPath(sel.meta.path);
        showResult({ path: sel.meta.path, cost: sel.meta.metro_time, edges }, lastFromDisplay, lastToDisplay, lastWalkingFrom, lastWalkingTo);
    }
}

// Reset all found routes (restore UI to initial state but keep inputs/markers)
function resetFoundRoutes() {
    // remove route layers and walking legs
    clearAllRouteLayers();
    try { walkingLayer.clearLayers(); } catch (e) {}
    try { if (currentRouteLayer) { map.removeLayer(currentRouteLayer); currentRouteLayer = null; } } catch (e) {}
    // clear stored results
    lastRoutesList = [];
    lastWalkingFrom = null;
    lastWalkingTo = null;
    lastFromDisplay = '';
    lastToDisplay = '';
    // reset selected index
    selectedRouteIndex = 0;
    // reset result panel content to default message
    const result = document.getElementById('result');
    if (result) {
        result.innerHTML = `<h3>Kết quả lộ trình</h3><p><strong>Thời gian và chi tiết lộ trình sẽ hiển thị ở đây sau khi bạn bấm Tìm đường.</strong></p>`;
    }
}

function updateRoutesUI() {
    const result = document.getElementById('result');
    if (!result) return;
    const routesList = lastRoutesList;
    const walkingFrom = lastWalkingFrom;
    const walkingTo = lastWalkingTo;
    const fromDisplay = lastFromDisplay;
    const toDisplay = lastToDisplay;

    const listHtml = routesList.map((r, i) => {
        const walkTime = (walkingFrom ? walkingFrom.time : 0) + (walkingTo ? walkingTo.time : 0);
        const totalTime = (r.metro_time || 0) + walkTime;
        const label = `${i+1}. ${formatMinutes(totalTime)} — ${i===0? 'Nhanh nhất' : i===1? 'Ít đi bộ' : 'Ít chuyển tuyến'}`;
        return `<li data-idx="${i}" class="route-item" style="cursor:pointer;padding:6px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">` +
            `<div><strong>${label}</strong><br/><small>Metro: ${formatMinutes(r.metro_time || 0)}, Đi bộ: ${formatMinutes(walkTime)}, Chuyển: ${r.transfers}</small></div>` +
            `<div><button class="route-delete" data-idx="${i}" style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:6px 8px;cursor:pointer;margin-left:8px">Xóa</button></div>` +
            `</li>`;
    }).join('');
    result.innerHTML = `<p>Lộ trình từ <strong>${fromDisplay}</strong> đến <strong>${toDisplay}</strong> — Chọn một tuyến:</p><ol style="list-style:none;padding:0;margin:0">${listHtml}</ol><div id="routeDetails"></div>`;

    // attach listeners
    document.querySelectorAll('.route-item').forEach(item => {
        item.addEventListener('click', () => {
            const idx = Number(item.getAttribute('data-idx'));
            selectRoute(idx);
            document.querySelectorAll('.route-item').forEach(it => it.style.background = '');
            item.style.background = '#f3f9ff';
        });
        item.addEventListener('mouseenter', () => { item.style.background = '#f9f9f9'; });
        item.addEventListener('mouseleave', () => { item.style.background = ''; });
    });

    document.querySelectorAll('.route-delete').forEach(btn => {
        btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const idx = Number(btn.getAttribute('data-idx'));
            removeRoute(idx);
        });
    });
}

function buildEdgeDetailsFromPath(path) {
    const edgeDetails = [];
    for (let i = 0; i < path.length-1; i++) {
        const fromId = path[i];
        const toId = path[i+1];
        const neighbors = adjacency[fromId] || [];
        const edge = neighbors.find(e => e.to === toId);
        if (edge) {
            edgeDetails.push({ from: fromId, to: toId, line: edge.line, time: edge.cost });
        }
    }
    return edgeDetails;
}

// Try to fetch a walking route from an external router (OSRM) and draw it.
// Falls back to straight line if the router fails.
async function fetchAndDrawWalkingLeg(point, station, opts = {}) {
    const layer = walkingLayer;
    const from = point; const to = station;
    const color = opts.color || '#2f4f4f';
    // OSRM expects lon,lat
    const coords = `${from.lon},${from.lat};${to.lon},${to.lat}`;
    // try walking profile, then foot, then driving as fallback
    const profiles = ['walking','foot','driving'];
    let routeGeo = null;
    let routeInfo = null;
    for (const profile of profiles) {
        try {
            const url = `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&geometries=geojson`;
            const resp = await fetch(url);
            if (!resp.ok) throw new Error('no route');
            const j = await resp.json();
            if (j && j.routes && j.routes.length) {
                routeGeo = j.routes[0].geometry;
                routeInfo = { distance: j.routes[0].distance, duration: j.routes[0].duration };
                break;
            }
        } catch (err) {
            // try next profile
        }
    }

    if (routeGeo && routeGeo.coordinates && routeGeo.coordinates.length) {
        // convert [lon,lat] coords to [lat,lon]
        const latlngs = routeGeo.coordinates.map(c => [c[1], c[0]]);
        const pl = L.polyline(latlngs, { color, weight: 4, dashArray: '6,8', opacity: 0.95 });
        pl.addTo(layer);
        return { bounds: pl.getBounds(), distance: routeInfo ? routeInfo.distance/1000 : null, timeMin: routeInfo ? Math.round(routeInfo.duration/60) : null };
    }

    // fallback: straight line
    const straight = L.polyline([[from.lat, from.lon], [to.lat, to.lon]], { color, weight: 4, dashArray: '6,8', opacity: 0.9 });
    straight.addTo(layer);
    const distKm = haversine_km(from.lat, from.lon, to.lat, to.lon);
    const timeMin = Math.round(distKm * 12);
    return { bounds: straight.getBounds(), distance: distKm, timeMin };
}

function selectRoute(idx) {
    if (!routeLayers || !routeLayers.length) return;
    selectedRouteIndex = idx;
    // update styling for each route layer
    routeLayers.forEach((r, i) => {
        const opacity = (i === idx) ? 0.95 : 0.25;
        const weight = (i === idx) ? 8 : 4;
        r.layerGroup.eachLayer(layer => {
            if (layer.setStyle) layer.setStyle({ opacity, weight });
        });
    });
    // show detailed result for this route
    const sel = routeLayers[idx];
    if (!sel) return;
    const routeMeta = sel.meta;
    const edges = buildEdgeDetailsFromPath(routeMeta.path);
    showResult({ path: routeMeta.path, cost: routeMeta.metro_time, edges }, lastFromDisplay, lastToDisplay, lastWalkingFrom, lastWalkingTo);
}

function renderAllRoutes(routes, walkingFrom, walkingTo) {
    // routes: array of {path, metro_time, transfers, stops, lines, score}
    clearAllRouteLayers();

    routes.forEach((r, idx) => {
        const color = routeColors[idx % routeColors.length];
        const layerGroup = L.layerGroup().addTo(map);
        const edges = buildEdgeDetailsFromPath(r.path);
        // draw each edge polyline
        edges.forEach(seg => {
            const from = graphById[seg.from];
            const to = graphById[seg.to];
            if (!from || !to) return;
            const poly = L.polyline([[from.lat, from.lon], [to.lat, to.lon]], {
                color: color,
                weight: (idx === selectedRouteIndex) ? 8 : 4,
                opacity: (idx === selectedRouteIndex) ? 0.95 : 0.35
            }).addTo(layerGroup);
        });
        // add small markers for transfer stations
        const metrics = { transfers: r.transfers };
        // store meta
        routeLayers.push({ layerGroup, meta: r, color });
    });

    // draw walking segments on separate walkingLayer (keep unchanged)
    walkingLayer.clearLayers();
    if (walkingFrom) {
        const p = walkingFrom.point;
        const s = walkingFrom.station;
        L.polyline([[p.lat, p.lon], [s.lat, s.lon]], { color: '#2f4f4f', weight: 4, dashArray: '6,8', opacity: 0.9 }).addTo(walkingLayer);
        L.circleMarker([p.lat, p.lon], { radius: 7, color: '#2E7D32', fillColor: '#2E7D32', fillOpacity: 0.9 }).addTo(walkingLayer);
    }
    if (walkingTo) {
        const p = walkingTo.point;
        const s = walkingTo.station;
        L.polyline([[s.lat, s.lon], [p.lat, p.lon]], { color: '#2f4f4f', weight: 4, dashArray: '6,8', opacity: 0.9 }).addTo(walkingLayer);
        L.circleMarker([p.lat, p.lon], { radius: 7, color: '#C62828', fillColor: '#C62828', fillOpacity: 0.9 }).addTo(walkingLayer);
    }

    // fit bounds to include all route layers and walking
    const boundsParts = [];
    routeLayers.forEach(r => {
        try { boundsParts.push(r.layerGroup.getBounds()); } catch (e) {}
    });
    try {
        if (walkingLayer.getLayers().length) boundsParts.push(walkingLayer.getBounds());
    } catch (e) {}
    const valid = boundsParts.filter(b => b && b.isValid && b.isValid());
    if (valid.length) {
        let merged = valid[0];
        for (let i = 1; i < valid.length; i++) merged = merged.extend(valid[i]);
        map.fitBounds(merged, { padding: [40,40] });
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

function showResult(route, fromName, toName, walkingFrom = null, walkingTo = null) {
    // Gom cac canh lien tiep cung line thanh segment de hien thi de doc.
    // prefer rendering into routeDetails if present (when showing multiple routes), else fallback to result
    const container = document.getElementById('routeDetails') || document.getElementById('result');
    if (!route) {
        container.innerHTML = `<p>Không tìm thấy lộ trình giữa <strong>${fromName}</strong> và <strong>${toName}</strong>.</p>`;
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
    // include walking times into total calculation
    const walkingTotal = (walkingFrom ? walkingFrom.time : 0) + (walkingTo ? walkingTo.time : 0);
    const totalCost = (route && route.cost ? route.cost : 0) + walkingTotal;

    const operationStatus = getRouteOperationStatus(route);
    const blockedLinesText = operationStatus.blockedRouteLines.length > 0
        ? ` (${operationStatus.blockedRouteLines.join(', ')} đang bị cấm)`
        : '';

    // Build walking summary
    const walkHtml = [];
    if (walkingFrom) {
        walkHtml.push(`<li><strong>Điểm đi → Đi bộ → Ga gần nhất:</strong> ${formatDistanceKm(walkingFrom.distanceKm)} , ${formatMinutes(walkingFrom.time)} → <strong>${walkingFrom.station.name}</strong></li>`);
    }
    if (walkingTo) {
        walkHtml.push(`<li><strong>Ga gần nhất → Đi bộ → Điểm đến:</strong> ${formatDistanceKm(walkingTo.distanceKm)} , ${formatMinutes(walkingTo.time)} → <strong>${walkingTo.station.name}</strong></li>`);
    }

    container.innerHTML = `
        <p>Lộ trình từ <strong>${fromName}</strong> đến <strong>${toName}</strong>:</p>
        <p><strong>Trạng thái vận hành:</strong> ${operationStatus.statusLabel}${blockedLinesText}</p>
        <p><strong>Tổng thời gian dự kiến:</strong> ${formatMinutes(totalCost)}</p>
        <p><strong>Tổng khoảng cách ước tính (metro):</strong> ${formatDistanceKm(totalDistance)}</p>
        <p><strong>Số ga đi qua:</strong> ${route && route.path ? route.path.length : 0}</p>
        <p><strong>Số lần chuyển tuyến:</strong> ${transferCount}</p>
        ${walkHtml.length ? `<p><strong>Đoạn đi bộ:</strong></p><ol>${walkHtml.join('')}</ol>` : ''}
        <p><strong>Thời gian từng đoạn trước khi chuyển trạm:</strong></p>
        <ol>${segmentHtml}</ol>
        <p><strong>Danh sách ga:</strong></p>
        <ol>${listItems}</ol>
    `;

    // Thêm event listeners cho các ga trong danh sách để điều hướng bản đồ
    const stationLinks = (container.querySelectorAll ? container.querySelectorAll('.station-link') : document.querySelectorAll('.station-link'));
    stationLinks.forEach(link => {
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

// Only define findRoute if user_history.js hasn't already wrapped it
if (typeof window.findRoute !== 'function') {
    window.findRoute = async function findRoute() {
        // Delegate to unified compute/show routine that handles stations and arbitrary points
        await computeAndShowFullRoute();
    };
}
// Alias for the event listener
var findRoute = window.findRoute;

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
        updateSelectionStatusText();
    });
}
if (selectToBtn) {
    selectToBtn.addEventListener('click', () => {
        // Bat che do chon ga den truc tiep bang click marker.
        selectingFrom = false;
        updateSelectionStatusText();
    });
}
// Reset found routes button
const resetBtn = document.getElementById('resetRoutesBtn');
if (resetBtn) resetBtn.addEventListener('click', resetFoundRoutes);
if (fromInput) {
    fromInput.addEventListener('focus', () => selectingFrom = true);
    fromInput.addEventListener('change', () => {
        if (fromInput.value.trim()) {
            const stationId = findStationIdByName(fromInput.value);
            if (stationId) {
                markStationOnMap(stationId, 'from');
                selectedStationIds.from = stationId;
                // clear any custom point marker
                clearCustomPoint('from');
            }
        } else {
            clearStationMarker('from');
            selectedStationIds.from = null;
        }
    });
    fromInput.addEventListener('input', () => {
        if (!fromInput.value.trim()) {
            clearStationMarker('from');
            selectedStationIds.from = null;
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
                selectedStationIds.to = stationId;
                clearCustomPoint('to');
            }
        } else {
            clearStationMarker('to');
            selectedStationIds.to = null;
        }
    });
    toInput.addEventListener('input', () => {
        if (!toInput.value.trim()) {
            clearStationMarker('to');
            selectedStationIds.to = null;
        }
    });
}

// Map click handler for selecting arbitrary points
map.on('click', e => {
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;
    const markerType = selectingFrom ? 'from' : 'to';

    // remove existing station selection for this slot
    if (selectedStationIds[markerType]) {
        clearStationMarker(markerType);
        selectedStationIds[markerType] = null;
    }

    // remove old custom point marker and create new one
    if (customPointMarkers[markerType]) {
        try { customPointMarkers[markerType].remove(); } catch (e) {}
        customPointMarkers[markerType] = null;
    }
    const marker = createPointMarker(lat, lon, markerType);
    customPointMarkers[markerType] = marker;
    customPoints[markerType] = { lat, lon };
    const label = `${markerType === 'from' ? 'Điểm đi' : 'Điểm đến'} (${lat.toFixed(5)}, ${lon.toFixed(5)})`;
    if (marker.bindPopup) marker.bindPopup(`<strong>${label}</strong>`).openPopup();
    // update input text to show a friendly label
    if (markerType === 'from') document.getElementById('fromStation').value = label;
    else document.getElementById('toStation').value = label;

    // update status text
    updateSelectionStatusText();

    // Do not compute automatically — wait for user to press "Tìm đường"
});

// Swap button
const swapBtn = document.getElementById('swapBtn');
if (swapBtn) {
    swapBtn.addEventListener('click', () => {
        // swap inputs
        const a = fromInput.value;
        fromInput.value = toInput.value;
        toInput.value = a;
        // swap station ids
        const aid = selectedStationIds.from;
        selectedStationIds.from = selectedStationIds.to;
        selectedStationIds.to = aid;
        // swap custom points
        const ap = customPoints.from;
        customPoints.from = customPoints.to;
        customPoints.to = ap;
        // swap markers on map
        const am = customPointMarkers.from;
        customPointMarkers.from = customPointMarkers.to;
        customPointMarkers.to = am;
        // swap selected station markers visuals
        const sFrom = selectedStationMarkers.from;
        selectedStationMarkers.from = selectedStationMarkers.to;
        selectedStationMarkers.to = sFrom;
        // Do not compute automatically after swap — wait for user to press "Tìm đường"
    });
}

// update selection status initial text
updateSelectionStatusText();
