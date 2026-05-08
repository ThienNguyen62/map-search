#!/usr/bin/env python
# -*- coding: utf-8 -*-

script_file = r'd:\map-search\frontend\script.js'

with open(script_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the markStationOnMap function
old_func = '''function markStationOnMap(stationId, markerType = 'from') {
    // Xóa marker cũ nếu có
    if (selectedStationMarkers[markerType]) {
        selectedStationLayer.removeLayer(selectedStationMarkers[markerType]);
    }
    
    const station = graphById[stationId];
    if (!station) return;
    
    // Xác định màu dựa trên loại ga (từ = xanh, đến = đỏ)
    const colors = {
        from: { color: '#4CAF50', fillColor: '#81C784', label: 'Ga đi' },
        to: { color: '#F44336', fillColor: '#EF5350', label: 'Ga đến' }
    };
    
    const colorConfig = colors[markerType] || colors.from;
    
    // Tạo marker mới với kích thước lớn hơn và kín đặc hơn
    const marker = L.circleMarker([station.lat, station.lon], {
        radius: 12,
        color: colorConfig.color,
        fillColor: colorConfig.fillColor,
        fillOpacity: 0.85,
        weight: 3,
        className: `station-marker-${markerType}`
    });
    
    // Thêm popup hiển thị loại ga
    marker.bindPopup(`<strong>${colorConfig.label}</strong><br/>${station.name}`);
    marker.openPopup();
    
    marker.addTo(selectedStationLayer);
    selectedStationMarkers[markerType] = marker;
}'''

new_func = '''function markStationOnMap(stationId, markerType = 'from') {
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

if old_func in content:
    content = content.replace(old_func, new_func)
    with open(script_file, 'w', encoding='utf-8') as f:
        f.write(content)
    print("markStationOnMap function updated to use pin markers!")
else:
    print("Could not find the markStationOnMap function")
