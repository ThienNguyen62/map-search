#!/usr/bin/env python
# -*- coding: utf-8 -*-

script_file = r'd:\map-search\frontend\script.js'

with open(script_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the selectStation function
old_code = '''function selectStation(station) {
    if (selectingFrom) {
        document.getElementById('fromStation').value = station.name;
    } else {
        document.getElementById('toStation').value = station.name;
    }
}'''

new_code = '''function selectStation(station) {
    if (selectingFrom) {
        document.getElementById('fromStation').value = station.name;
        markStationOnMap(station.id, 'from');
    } else {
        document.getElementById('toStation').value = station.name;
        markStationOnMap(station.id, 'to');
    }
}'''

if old_code in content:
    content = content.replace(old_code, new_code)
    with open(script_file, 'w', encoding='utf-8') as f:
        f.write(content)
    print("selectStation function updated successfully!")
else:
    print("Could not find the selectStation function to update")
