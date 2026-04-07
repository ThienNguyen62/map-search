import csv
import json
from pathlib import Path
from collections import defaultdict

"""Sinh do thi metro_graph.json tu bo du lieu GTFS da duoc loc.

Output gom:
- stations: danh sach node ga (id, ten, toa do, cac child stop)
- edges: cac canh co trong so thoi gian trung binh giua 2 ga
"""

BASE = Path(__file__).resolve().parent
IN_DIR = BASE / "gesamt_gtfs" / "filtered_metro"
OUT_DIR = BASE / "frontend" / "data"
OUT_DIR.mkdir(exist_ok=True, parents=True)

stops = json.load(open(IN_DIR / "metro_stops.json", 'r', encoding='utf-8'))
trips = json.load(open(IN_DIR / "metro_trips.json", 'r', encoding='utf-8'))
routes = json.load(open(IN_DIR / "metro_routes.json", 'r', encoding='utf-8'))

# map stop_id -> stop record
stop_by_id = {s['stop_id']: s for s in stops}


def haversine_km(lat1, lon1, lat2, lon2):
    """Tinh khoang cach duong chim bay giua hai diem GPS theo km."""
    from math import radians, sin, cos, sqrt, atan2

    r = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return r * c

# Gom cac stop con vao mot station root (theo parent_station).
station_roots = {}
station_children = defaultdict(list)
for s in stops:
    parent = s.get('parent_station') or s['stop_id']
    station_children[parent].append(s)
    if parent not in station_roots or s.get('location_type') == '1':
        station_roots[parent] = s

# Tao node station duy nhat cho moi root de dung trong graph.
stations = []
for sid, root in station_roots.items():
    name = root.get('stop_name') or ''
    if root.get('location_type') == '0' and len(station_children[sid]) > 1:
        name = root.get('stop_name')
    lat = float(root.get('stop_lat', 0) or 0)
    lon = float(root.get('stop_lon', 0) or 0)
    stations.append({
        'id': sid,
        'name': name,
        'lat': lat,
        'lon': lon,
        'children': [c['stop_id'] for c in station_children[sid]],
    })

# Anh xa trip -> ten tuyen (U1/U2/...) de gan mau va thong tin segment.
route_by_id = {r['route_id']: r for r in routes}
trip_route = {t['trip_id']: route_by_id[t['route_id']]['route_short_name'] for t in trips if t['route_id'] in route_by_id}

# Tich luy thoi gian di chuyen theo cap ga lien tiep trong tung trip.
edge_times = defaultdict(list)
trip_stop_times = defaultdict(list)

with open(IN_DIR / 'metro_stop_times.csv', newline='', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        trip_stop_times[row['trip_id']].append(row)

for trip_id, rows in trip_stop_times.items():
    rows.sort(key=lambda r: int(r['stop_sequence']))
    route_name = trip_route.get(trip_id, '')
    for a, b in zip(rows, rows[1:]):
        from_parent = stop_by_id.get(a['stop_id'], {}).get('parent_station') or a['stop_id']
        to_parent = stop_by_id.get(b['stop_id'], {}).get('parent_station') or b['stop_id']
        if from_parent == to_parent:
            continue
        # Tinh phut di chuyen tu gio depart cua stop A den gio arrive cua stop B.
        def to_seconds(t):
            if not t: return 0
            parts = t.split(':')
            if len(parts) != 3: return 0
            h, m, s = map(int, parts)
            return h*3600 + m*60 + s
        a_dep = to_seconds(a.get('departure_time', '0:0:0'))
        b_arr = to_seconds(b.get('arrival_time', '0:0:0'))
        # Xu ly truong hop qua ngay (gio sau nho hon gio truoc).
        if b_arr < a_dep:
            b_arr += 24*3600
        minutes = max(1, round((b_arr - a_dep) / 60))
        from_stop = stop_by_id.get(a['stop_id'], {})
        to_stop = stop_by_id.get(b['stop_id'], {})
        try:
            distance_km = round(
                haversine_km(
                    float(from_stop.get('stop_lat', 0) or 0),
                    float(from_stop.get('stop_lon', 0) or 0),
                    float(to_stop.get('stop_lat', 0) or 0),
                    float(to_stop.get('stop_lon', 0) or 0),
                ),
                3,
            )
        except (TypeError, ValueError):
            distance_km = None

        key = (from_parent, to_parent, route_name)
        edge_times[key].append((minutes, distance_km))

edges = []
for (u, v, line), times in edge_times.items():
    cost = sum(minutes for minutes, _ in times) / len(times)
    distances = [distance for _, distance in times if distance is not None]
    distance = round(sum(distances) / len(distances), 3) if distances else None
    edges.append({
        'from': u,
        'to': v,
        'line': line,
        'time': round(cost, 1),
        'distance': distance
    })

# Bo sung canh nguoc chieu de graph 2 chieu (neu chua ton tai).
seen = set()
fwd_edges = []
for e in edges:
    key = (e['from'], e['to'], e['line'])
    if key in seen: continue
    seen.add(key)
    fwd_edges.append(e)
    rev = {'from': e['to'], 'to': e['from'], 'line': e['line'], 'time': e['time'], 'distance': e['distance']}
    if (rev['from'], rev['to'], rev['line']) not in seen:
        fwd_edges.append(rev)
        seen.add((rev['from'], rev['to'], rev['line']))

# Chi giu lai station co tham gia canh de graph gon hon.
nodes = [s for s in stations if s['id'] in {e['from'] for e in fwd_edges} | {e['to'] for e in fwd_edges}]

# deduplicate station names by id
node_map = {n['id']: n for n in nodes}

out = {'stations': list(node_map.values()), 'edges': fwd_edges}

with open(OUT_DIR / 'metro_graph.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

print('Saved', OUT_DIR / 'metro_graph.json', 'with', len(node_map), 'nodes and', len(fwd_edges), 'edges')
