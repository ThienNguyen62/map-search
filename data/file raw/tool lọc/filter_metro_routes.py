import csv
import json
import os
from pathlib import Path

"""Loc du lieu GTFS de tao bo du lieu rieng cho he thong metro.

Script nay tao cac file trung gian trong gesamt_gtfs/filtered_metro,
gom routes/trips/stop_times/stops chi thuoc mang tau dien ngam.
"""

BASE_DIR = Path(__file__).resolve().parent
GTFS_DIR = BASE_DIR / "gesamt_gtfs"
OUTPUT_DIR = GTFS_DIR / "filtered_metro"

ROUTE_TYPE_METRO = {"1"}
ROUTE_SHORT_PREFIXES = {"U"}


def load_csv(path):
    """Doc file CSV (co ho tro BOM) va tra ve danh sach dict row."""
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        return [row for row in reader]


def save_json(path, data):
    """Ghi du lieu JSON dang de doc de de inspect/debug."""
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def save_csv(path, rows, fieldnames):
    """Ghi CSV voi header co dinh de cac buoc sau doc on dinh."""
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def is_metro_route(route):
    """Xac dinh route co phai metro dua tren route_type hoac route_short_name."""
    route_type = route.get("route_type", "").strip()
    short_name = route.get("route_short_name", "").strip().upper()

    if route_type in ROUTE_TYPE_METRO:
        return True
    if any(short_name.startswith(pref) for pref in ROUTE_SHORT_PREFIXES):
        return True
    return False


def main():
    # 1) Loc routes metro.
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
    # 2) Loc trips thuoc cac metro routes.
    trips = load_csv(trips_path)
    metro_trips = [trip for trip in trips if trip.get("route_id") in metro_route_ids]
    metro_trip_ids = {trip["trip_id"] for trip in metro_trips}
    print(f"Filtered {len(metro_trips)} metro trips")

    print(f"Loading {stop_times_path}... (may take a moment)")
    # 3) Loc stop_times theo tap metro trips va giu cac cot can thiet.
    stop_times = load_csv(stop_times_path)
    raw_metro_stop_times = [row for row in stop_times if row.get("trip_id") in metro_trip_ids]
    print(f"Filtered {len(raw_metro_stop_times)} metro stop_times rows")

    KEEP_FIELDS = ["trip_id", "arrival_time", "departure_time", "stop_id", "stop_sequence"]
    metro_stop_times = [
        {field: row.get(field, "") for field in KEEP_FIELDS}
        for row in raw_metro_stop_times
    ]

    print(f"Loading {stops_path}...")
    # 4) Loc danh sach stops thuc su duoc tham chieu boi metro stop_times.
    stops = load_csv(stops_path)
    metro_stop_ids = {row["stop_id"] for row in metro_stop_times}
    metro_stops = [stop for stop in stops if stop.get("stop_id") in metro_stop_ids]
    print(f"Filtered {len(metro_stops)} stops referenced by metro stop_times")

    # 5) Ghi ra cac file filtered de dung cho buoc tao graph.
    save_json(OUTPUT_DIR / "metro_routes.json", metro_routes)
    save_json(OUTPUT_DIR / "metro_route_ids.json", sorted(metro_route_ids))
    save_json(OUTPUT_DIR / "metro_trips.json", metro_trips)
    save_csv(OUTPUT_DIR / "metro_stop_times.csv", metro_stop_times, fieldnames=KEEP_FIELDS)
    save_csv(OUTPUT_DIR / "metro_stop_times.txt", metro_stop_times, fieldnames=KEEP_FIELDS)
    save_json(OUTPUT_DIR / "metro_stops.json", metro_stops)

    print(f"Saved filtered files to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
