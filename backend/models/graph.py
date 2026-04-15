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
            for s in stations_data:
                station = Station(s['id'], s['name'], s['lat'], s['lon'], s.get('children', []))
                self.stations.append(station)
                self.station_by_id[s['id']] = station

        # Load edges
        with open(edges_file, 'r', encoding='utf-8') as f:
            edges_data = json.load(f)
            for e in edges_data:
                edge = Edge(e['from'], e['to'], e['time'], e['line'])
                self.edges.append(edge)

    def get_station_by_id(self, station_id: str):
        return self.station_by_id.get(station_id)

    def to_dict(self):
        return {
            "stations": [s.to_dict() for s in self.stations],
            "edges": [e.to_dict() for e in self.edges]
        }