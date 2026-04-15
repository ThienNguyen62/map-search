class Edge:
    def __init__(self, from_station: str, to_station: str, time: int, line: str):
        self.from_station = from_station
        self.to_station = to_station
        self.time = time
        self.line = line

    def to_dict(self):
        return {
            "from": self.from_station,
            "to": self.to_station,
            "time": self.time,
            "line": self.line
        }