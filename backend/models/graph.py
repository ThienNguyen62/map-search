import json
from .station import Station
from .edge import Edge

class Graph:
    def __init__(self):
        self.stations = []
        self.edges = []
        self.station_by_id = {}

    def load_from_json(self, stations_file: str, edges_file: str):
        # Load stations
        with open(stations_file, 'r', encoding='utf-8') as f:
            stations_data = json.load(f)
            if isinstance(stations_data, dict):
                stations_data = stations_data.get('stations', stations_data)

            for s in stations_data:
                station_id = s.get('id') or s.get('ID')
                station_name = s.get('name') or s.get('Name', '')
                station_lat = s.get('lat') or s.get('latitude')
                station_lon = s.get('lon') or s.get('longitude')
                station_children = s.get('children') or s.get('Nearby') or []

                if station_id is None or station_lat is None or station_lon is None:
                    continue

                station = Station(station_id, station_name, station_lat, station_lon, station_children)
                self.stations.append(station)
                self.station_by_id[station_id] = station

        # Load edges
        with open(edges_file, 'r', encoding='utf-8') as f:
            edges_data = json.load(f)
            if isinstance(edges_data, dict):
                edges_data = edges_data.get('edges', edges_data.get('connections', []))

            for e in edges_data:
                from_station = e.get('from') or e.get('from_id')
                to_station = e.get('to') or e.get('to_id')
                time_val = e.get('time') or e.get('time_min') or 1
                line = e.get('line', '')
                if from_station is None or to_station is None:
                    continue
                edge = Edge(from_station, to_station, time_val, line)
                self.edges.append(edge)

    def get_station_by_id(self, station_id: str):
        return self.station_by_id.get(station_id)

    def to_dict(self):
        return {
            "stations": [s.to_dict() for s in self.stations],
            "edges": [e.to_dict() for e in self.edges]
        }