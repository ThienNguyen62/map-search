import csv
import json
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
GTFS_DIR = BASE_DIR / "gesamt_gtfs"
OUTPUT_DIR = GTFS_DIR / "filtered_metro"

ROUTE_TYPE_METRO = {"1"}
ROUTE_SHORT_PREFIXES = {"U"}


def load_csv(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        return [row for row in reader]


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def save_csv(path, rows, fieldnames):
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def is_metro_route(route):
    route_type = route.get("route_type", "").strip()
    short_name = route.get("route_short_name", "").strip().upper()

    if route_type in ROUTE_TYPE_METRO:
        return True
    if any(short_name.startswith(pref) for pref in ROUTE_SHORT_PREFIXES):
        return True
    return False


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    routes_path = GTFS_DIR / "routes.txt"
    trips_path = GTFS_DIR / "trips.txt"
    stop_times_path = GTFS_DIR / "stop_times.txt"
    stops_path = GTFS_DIR / "stops.txt"

    print(f"Loading {routes_path}...")
    routes = load_csv(routes_path)
    print(f"Loaded {len(routes)} routes")

    metro_routes = [route for route in routes if is_metro_route(route)]
    metro_route_ids = {route["route_id"] for route in metro_routes}
    print(f"Filtered {len(metro_routes)} metro routes")

    print(f"Loading {trips_path}...")
    trips = load_csv(trips_path)
    metro_trips = [trip for trip in trips if trip.get("route_id") in metro_route_ids]
    metro_trip_ids = {trip["trip_id"] for trip in metro_trips}
    print(f"Filtered {len(metro_trips)} metro trips")

    print(f"Loading {stop_times_path}... (may take a moment)")
    stop_times = load_csv(stop_times_path)
    metro_stop_times = [row for row in stop_times if row.get("trip_id") in metro_trip_ids]
    print(f"Filtered {len(metro_stop_times)} metro stop_times rows")

    print(f"Loading {stops_path}...")
    stops = load_csv(stops_path)
    metro_stop_ids = {row["stop_id"] for row in metro_stop_times}
    metro_stops = [stop for stop in stops if stop.get("stop_id") in metro_stop_ids]
    print(f"Filtered {len(metro_stops)} stops referenced by metro stop_times")

    save_json(OUTPUT_DIR / "metro_routes.json", metro_routes)
    save_json(OUTPUT_DIR / "metro_route_ids.json", sorted(metro_route_ids))
    save_json(OUTPUT_DIR / "metro_trips.json", metro_trips)
    save_csv(OUTPUT_DIR / "metro_stop_times.csv", metro_stop_times, fieldnames=stop_times[0].keys() if stop_times else [])
    save_json(OUTPUT_DIR / "metro_stops.json", metro_stops)

    print(f"Saved filtered files to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
