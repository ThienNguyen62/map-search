#!/usr/bin/env python
# -*- coding: utf-8 -*-

script_file = r'd:\map-search\frontend\script.js'

with open(script_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Tìm và thay thế hàm markStationOnMap
old_func = '''function markStationOnMap(stationId, markerType = 'from') {
    // Xóa marker cũ nếu có
    if (selectedStationMarkers[markerType]) {
        selectedStationLayer.removeLayer(selectedStationMarkers[markerType]);
    }
    
    const station = graphById[stationId];
    if (!station) return;
    
    // Xác định màu và icon dựa trên loại ga
    let markerConfig;
    if (markerType === 'from') {
        markerConfig = {
            awesomeMarkerColor: 'green',
            label: 'Ga đi',
            icon: 'fa fa-location-dot'
        };
    } else {
        markerConfig = {
            awesomeMarkerColor: 'red',
            label: 'Ga đến',
            icon: 'fa fa-location-dot'
        };
    }
    
    // Tạo Awesome Marker với hình pin
    const marker = L.marker([station.lat, station.lon], {
        icon: L.AwesomeMarkers.icon({
            icon: markerConfig.icon,
            markerColor: markerConfig.awesomeMarkerColor,
            prefix: 'fa',
            className: `station-marker-${markerType}`
        })
    });
    
    // Thêm popup hiển thị loại ga
    marker.bindPopup(`<strong>${markerConfig.label}</strong><br/>${station.name}`);
    marker.openPopup();
    
    marker.addTo(selectedStationLayer);
    selectedStationMarkers[markerType] = marker;
}'''

new_func = '''function createCustomPinIcon(markerType) {
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
}'''

if old_func in content:
    content = content.replace(old_func, new_func)
    with open(script_file, 'w', encoding='utf-8') as f:
        f.write(content)
    print("markStationOnMap function updated with custom SVG pin markers!")
else:
    print("Could not find the old markStationOnMap function")
