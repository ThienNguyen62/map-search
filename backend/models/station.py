class Station:
    def __init__(self, id: str, name: str, lat: float, lon: float, children: list = None):
        self.id = id
        self.name = name
        self.lat = lat
        self.lon = lon
        self.children = children or []

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "lat": self.lat,
            "lon": self.lon,
            "children": self.children
        }