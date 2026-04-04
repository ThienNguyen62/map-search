import csv
import json
from pathlib import Path
from collections import defaultdict

BASE = Path(__file__).resolve().parent
IN_DIR = BASE / "gesamt_gtfs" / "filtered_metro"
OUT_DIR = BASE / "frontend" / "data"
OUT_DIR.mkdir(exist_ok=True, parents=True)

stops = json.load(open(IN_DIR / "metro_stops.json", 'r', encoding='utf-8'))
trips = json.load(open(IN_DIR / "metro_trips.json", 'r', encoding='utf-8'))
routes = json.load(open(IN_DIR / "metro_routes.json", 'r', encoding='utf-8'))

# map stop_id -> stop record
stop_by_id = {s['stop_id']: s for s in stops}

# determine station groups by parent_station or stop_id
station_roots = {}
station_children = defaultdict(list)
for s in stops:
    parent = s.get('parent_station') or s['stop_id']
    station_children[parent].append(s)
    if parent not in station_roots or s.get('location_type') == '1':
        station_roots[parent] = s

# build station nodes using root names
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

# map trip_id -> route_short_name
route_by_id = {r['route_id']: r for r in routes}
trip_route = {t['trip_id']: route_by_id[t['route_id']]['route_short_name'] for t in trips if t['route_id'] in route_by_id}

# parse stop_times and accumulate edge times by parent station pair
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
        # calculate travel time in minutes between departure of a and arrival of b
        def to_seconds(t):
            if not t: return 0
            parts = t.split(':')
            if len(parts) != 3: return 0
            h, m, s = map(int, parts)
            return h*3600 + m*60 + s
        a_dep = to_seconds(a.get('departure_time', '0:0:0'))
        b_arr = to_seconds(b.get('arrival_time', '0:0:0'))
        # adjust for midnight wrap
        if b_arr < a_dep:
            b_arr += 24*3600
        minutes = max(1, round((b_arr - a_dep) / 60))
        key = (from_parent, to_parent, route_name)
        edge_times[key].append(minutes)

edges = []
for (u, v, line), times in edge_times.items():
    cost = sum(times) / len(times)
    edges.append({
        'from': u,
        'to': v,
        'line': line,
        'time': round(cost, 1),
        'distance': None
    })

# symmetrize edges by route if not already
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

# keep nodes that appear in edges, and also roots
nodes = [s for s in stations if s['id'] in {e['from'] for e in fwd_edges} | {e['to'] for e in fwd_edges}]

# deduplicate station names by id
node_map = {n['id']: n for n in nodes}

out = {'stations': list(node_map.values()), 'edges': fwd_edges}

with open(OUT_DIR / 'metro_graph.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

print('Saved', OUT_DIR / 'metro_graph.json', 'with', len(node_map), 'nodes and', len(fwd_edges), 'edges')
