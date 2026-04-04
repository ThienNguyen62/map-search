"""
Munich U-Bahn Graph Builder
===========================
Xây dựng đồ thị mạng lưới tàu điện ngầm Munich cho cả A* và Dijkstra.
"""

import networkx as nx
from geopy.distance import geodesic
from typing import Dict, List, Tuple, Optional
import logging

logger = logging.getLogger(__name__)


class MunichSubwayGraph:
    """
    Class xây dựng và quản lý đồ thị Munich U-Bahn.
    Hỗ trợ cả MultiGraph (cho OSMnx style) và Graph thường.
    """

    def __init__(self, use_multigraph: bool = True):
        """
        Parameters
        ----------
        use_multigraph : bool
            Nếu True: tạo MultiDiGraph (cho phép nhiều edge giữa 2 node)
            Nếu False: tạo DiGraph thường
        """
        self.use_multigraph = use_multigraph
        self.graph = None
        self._lines_data = self._get_lines_data()
        self._station_coords = self._get_station_coords()
        self._station_names = self._get_station_names()
    
    def _get_lines_data(self) -> Dict[str, List[str]]:
        """Định nghĩa các tuyến và danh sách ga (mã ga)"""
        return {
            "U1": [f"U1_{i:02d}" for i in range(1, 16)],
            "U2": [f"U2_{i:02d}" for i in range(1, 28)],
            "U3": [f"U3_{i:02d}" for i in range(1, 26)],
            "U4": [f"U4_{i:02d}" for i in range(1, 14)],
            "U5": [f"U5_{i:02d}" for i in range(1, 19)],
            "U6": [f"U6_{i:02d}" for i in range(1, 27)],
            "U7": [f"U7_{i:02d}" for i in range(1, 20)],
            "U8": [f"U8_{i:02d}" for i in range(1, 20)],
        }
    
    def _get_station_coords(self) -> Dict[str, Tuple[float, float]]:
        """
        Tọa độ thực tế của các ga (latitude, longitude)
        Dữ liệu từ OpenStreetMap / Google Maps
        """
        return {
        # GA TRUNG CHUYỂN CHÍNH (CÓ NHIỀU TUYẾN)
        # =========================================================================
        
        # Hauptbahnhof (Trung tâm chính - 6 tuyến)
        "U1_08": (48.1402, 11.5580),
        "U2_13": (48.1402, 11.5580),
        "U4_05": (48.1402, 11.5580),
        "U5_07": (48.1402, 11.5580),
        "U7_08": (48.1402, 11.5580),
        "U8_08": (48.1402, 11.5580),
        
        # Sendlinger Tor (6 tuyến)
        "U1_09": (48.1338, 11.5671),
        "U2_14": (48.1338, 11.5671),
        "U3_14": (48.1338, 11.5671),
        "U6_16": (48.1338, 11.5671),
        "U7_09": (48.1338, 11.5671),
        "U8_09": (48.1338, 11.5671),
        
        # Marienplatz (U3, U6)
        "U3_13": (48.1371, 11.5754),
        "U6_15": (48.1371, 11.5754),
        
        # Odeonsplatz (U3, U4, U5, U6)
        "U3_12": (48.1404, 11.5775),
        "U4_07": (48.1404, 11.5775),
        "U5_09": (48.1404, 11.5775),
        "U6_14": (48.1404, 11.5775),
        
        # Scheidplatz (U2, U3, U8)
        "U2_08": (48.1629, 11.5723),
        "U3_07": (48.1629, 11.5723),
        "U8_03": (48.1629, 11.5723),
        
        # Münchner Freiheit (U3, U6)
        "U3_09": (48.1608, 11.5855),
        "U6_11": (48.1608, 11.5855),
        
        # Innsbrucker Ring (U2, U5, U7, U8)
        "U2_21": (48.1205, 11.6120),
        "U5_13": (48.1205, 11.6120),
        "U7_16": (48.1205, 11.6120),
        "U8_16": (48.1205, 11.6120),
        
        # Giesing (U2, U7, U8)
        "U2_19": (48.1100, 11.5980),
        "U7_14": (48.1100, 11.5980),
        "U8_14": (48.1100, 11.5980),
        
        # Olympia-Einkaufszentrum (U1, U3, U7)
        "U1_01": (48.1805, 11.5289),
        "U3_03": (48.1805, 11.5289),
        "U7_01": (48.1805, 11.5289),
        
        # Kolumbusplatz (U1, U2, U7, U8)
        "U1_11": (48.1197, 11.5764),
        "U2_16": (48.1197, 11.5764),
        "U7_11": (48.1197, 11.5764),
        "U8_11": (48.1197, 11.5764),
        
        # Fraunhoferstraße (U1, U2, U7, U8)
        "U1_10": (48.1292, 11.5744),
        "U2_15": (48.1292, 11.5744),
        "U7_10": (48.1292, 11.5744),
        "U8_10": (48.1292, 11.5744),
        
        # Implerstraße (U3, U6)
        "U3_17": (48.1180, 11.5560),
        "U6_19": (48.1180, 11.5560),
        
        # Poccistraße (U3, U6)
        "U3_16": (48.1250, 11.5570),
        "U6_18": (48.1250, 11.5570),
        
        # Goetheplatz (U3, U6)
        "U3_15": (48.1292, 11.5578),
        "U6_17": (48.1292, 11.5578),
        
        # Universität (U3, U6)
        "U3_11": (48.1500, 11.5800),
        "U6_13": (48.1500, 11.5800),
        
        # Giselastraße (U3, U6)
        "U3_10": (48.1550, 11.5820),
        "U6_12": (48.1550, 11.5820),
        
        # Westendstraße (U4, U5)
        "U4_01": (48.1356, 11.5208),
        "U5_03": (48.1356, 11.5208),
        
        # Heimeranplatz (U4, U5)
        "U4_02": (48.1330, 11.5320),
        "U5_04": (48.1330, 11.5320),
        
        # Schwanthalerhöhe (U4, U5)
        "U4_03": (48.1380, 11.5430),
        "U5_05": (48.1380, 11.5430),
        
        # Theresienwiese (U4, U5)
        "U4_04": (48.1390, 11.5510),
        "U5_06": (48.1390, 11.5510),
        
        # Karlsplatz (Stachus) (U4, U5)
        "U4_06": (48.1390, 11.5650),
        "U5_08": (48.1390, 11.5650),
        
        # Lehel (U4, U5)
        "U4_08": (48.1380, 11.5850),
        "U5_10": (48.1380, 11.5850),
        
        # Max-Weber-Platz (U4, U5)
        "U4_09": (48.1330, 11.5950),
        "U5_11": (48.1330, 11.5950),
        
        # Silberhornstraße (U2, U7, U8)
        "U2_17": (48.1150, 11.5850),
        "U7_12": (48.1150, 11.5850),
        "U8_12": (48.1150, 11.5850),
        
        # Untersbergstraße (U2, U7, U8)
        "U2_18": (48.1125, 11.5900),
        "U7_13": (48.1125, 11.5900),
        "U8_13": (48.1125, 11.5900),
        
        # Karl-Preis-Platz (U2, U7, U8)
        "U2_20": (48.1170, 11.6050),
        "U7_15": (48.1170, 11.6050),
        "U8_15": (48.1170, 11.6050),
        
        # Michaelibad (U5, U7, U8)
        "U5_14": (48.1100, 11.6230),
        "U7_17": (48.1100, 11.6230),
        "U8_17": (48.1100, 11.6230),
        
        # Quiddestraße (U5, U7, U8)
        "U5_15": (48.1040, 11.6350),
        "U7_18": (48.1040, 11.6350),
        "U8_18": (48.1040, 11.6350),
        
        # Neuperlach Zentrum (U5, U7, U8)
        "U5_16": (48.0925, 11.6502),
        "U7_19": (48.0925, 11.6502),
        "U8_19": (48.0925, 11.6502),
        
        # =========================================================================
        # U1 - CÁC GA ĐỘC LẬP
        # =========================================================================
        "U1_02": (48.1750, 11.5292),  # Georg-Brauchle-Ring
        "U1_03": (48.1706, 11.5283),  # Westfriedhof
        "U1_04": (48.1628, 11.5292),  # Gern
        "U1_05": (48.1528, 11.5342),  # Rotkreuzplatz
        "U1_06": (48.1500, 11.5458),  # Maillingerstraße
        "U1_07": (48.1475, 11.5592),  # Stiglmaierplatz
        "U1_12": (48.1122, 11.5714),  # Candidplatz
        "U1_13": (48.1086, 11.5750),  # Wettersteinplatz
        "U1_14": (48.1047, 11.5817),  # St.-Quirin-Platz
        "U1_15": (48.0986, 11.5817),  # Mangfallplatz
        
        # =========================================================================
        # U2 - CÁC GA ĐỘC LẬP
        # =========================================================================
        "U2_01": (48.2136, 11.5419),  # Feldmoching
        "U2_02": (48.2131, 11.5558),  # Hasenbergl
        "U2_03": (48.2128, 11.5625),  # Dülferstraße
        "U2_04": (48.2047, 11.5683),  # Harthof
        "U2_05": (48.1908, 11.5698),  # Am Hart
        "U2_06": (48.1867, 11.5728),  # Frankfurter Ring
        "U2_07": (48.1808, 11.5731),  # Milbertshofen
        "U2_09": (48.1614, 11.5686),  # Hohenzollernplatz
        "U2_10": (48.1553, 11.5672),  # Josephsplatz
        "U2_11": (48.1511, 11.5647),  # Theresienstraße
        "U2_12": (48.1458, 11.5636),  # Königsplatz
        "U2_22": (48.1250, 11.6200),  # Josephsburg
        "U2_23": (48.1300, 11.6300),  # Kreillerstr.
        "U2_24": (48.1320, 11.6580),  # Trudering
        "U2_25": (48.1340, 11.6780),  # Moosfeld
        "U2_26": (48.1345, 11.6900),  # Messestadt West
        "U2_27": (48.1347, 11.7000),  # Messestadt Ost
        
        # =========================================================================
        # U3 - CÁC GA ĐỘC LẬP
        # =========================================================================
        "U3_01": (48.1807, 11.5100),  # Moosach
        "U3_02": (48.1790, 11.5150),  # Moosacher St.-Martins-Platz
        "U3_04": (48.1780, 11.5350),  # Oberwiesenfeld
        "U3_05": (48.1730, 11.5450),  # Olympiazentrum
        "U3_06": (48.1700, 11.5580),  # Petuelring
        "U3_08": (48.1660, 11.5770),  # Bonner Platz
        "U3_18": (48.1110, 11.5470),  # Brudermühlstraße
        "U3_19": (48.1050, 11.5400),  # Thalkirchen
        "U3_20": (48.0990, 11.5360),  # Obersendling
        "U3_21": (48.0930, 11.5310),  # Aidenbachstraße
        "U3_22": (48.0880, 11.5270),  # Machtlfinger Straße
        "U3_23": (48.0830, 11.5220),  # Forstenrieder Allee
        "U3_24": (48.0780, 11.5180),  # Basler Straße
        "U3_25": (48.0861, 11.5101),  # Fürstenried West
        
        # =========================================================================
        # U4 - CÁC GA ĐỘC LẬP
        # =========================================================================
        "U4_10": (48.1430, 11.6030),  # Prinzregentenplatz
        "U4_11": (48.1460, 11.6100),  # Böhmerwaldplatz
        "U4_12": (48.1480, 11.6170),  # Richard-Strauss-Straße
        "U4_13": (48.1503, 11.6210),  # Arabellapark
        
        # =========================================================================
        # U5 - CÁC GA ĐỘC LẬP
        # =========================================================================
        "U5_01": (48.1405, 11.5051),  # Laimer Platz
        "U5_02": (48.1390, 11.5120),  # Friedenheimer Straße
        "U5_12": (48.1280, 11.6040),  # Ostbahnhof
        "U5_17": (48.0960, 11.6420),  # Therese-Giehse-Allee
        "U5_18": (48.0925, 11.6502),  # Neuperlach Süd
        
        # =========================================================================
        # U6 - CÁC GA ĐỘC LẬP
        # =========================================================================
        "U6_01": (48.2509, 11.6702),  # Garching-Forschungszentrum
        "U6_02": (48.2480, 11.6650),  # Garching
        "U6_03": (48.2350, 11.6450),  # Garching-Hochbrück
        "U6_04": (48.2210, 11.6160),  # Fröttmaning
        "U6_05": (48.2110, 11.6100),  # Kieferngarten
        "U6_06": (48.2000, 11.6050),  # Freimann
        "U6_07": (48.1880, 11.6000),  # Studentenstadt
        "U6_08": (48.1780, 11.5950),  # Alte Heide
        "U6_09": (48.1720, 11.5900),  # Nordfriedhof
        "U6_10": (48.1650, 11.5880),  # Dietlindenstraße
        "U6_20": (48.1120, 11.5380),  # Harras
        "U6_21": (48.1070, 11.5340),  # Partnachplatz
        "U6_22": (48.1020, 11.5300),  # Westpark
        "U6_23": (48.0980, 11.5250),  # Holzapfelkreuth
        "U6_24": (48.0940, 11.5200),  # Haderner Stern
        "U6_25": (48.0900, 11.5100),  # Großhadern
        "U6_26": (48.1102, 11.4710),  # Klinikum Großhadern
        
        # =========================================================================
        # U7 - CÁC GA ĐỘC LẬP
        # =========================================================================
        "U7_02": (48.1750, 11.5292),  # Georg-Brauchle-Ring
        "U7_03": (48.1706, 11.5283),  # Westfriedhof
        "U7_04": (48.1628, 11.5292),  # Gern
        "U7_05": (48.1528, 11.5342),  # Rotkreuzplatz
        "U7_06": (48.1500, 11.5458),  # Maillingerstraße
        "U7_07": (48.1475, 11.5592),  # Stiglmaierplatz
        
        # =========================================================================
        # U8 - CÁC GA ĐỘC LẬP
        # =========================================================================
        "U8_01": (48.1730, 11.5450),  # Olympiazentrum
        "U8_02": (48.1700, 11.5580),  # Petuelring
        "U8_04": (48.1614, 11.5686),  # Hohenzollernplatz
        "U8_05": (48.1553, 11.5672),  # Josephsplatz
        "U8_06": (48.1511, 11.5647),  # Theresienstraße
        "U8_07": (48.1458, 11.5636),  # Königsplatz
        }
    
    def _get_station_names(self) -> Dict[str, str]:
        """Tên đầy đủ của các ga"""
        names = {
            # U1
            "U1_01": "Olympia-Einkaufszentrum",
            "U1_02": "Georg-Brauchle-Ring",
            "U1_03": "Westfriedhof",
            "U1_04": "Gern",
            "U1_05": "Rotkreuzplatz",
            "U1_06": "Maillingerstraße",
            "U1_07": "Stiglmaierplatz",
            "U1_08": "Hauptbahnhof",
            "U1_09": "Sendlinger Tor",
            "U1_10": "Fraunhoferstraße",
            "U1_11": "Kolumbusplatz",
            "U1_12": "Candidplatz",
            "U1_13": "Wettersteinplatz",
            "U1_14": "St.-Quirin-Platz",
            "U1_15": "Mangfallplatz",
            
            # U2
            "U2_01": "Feldmoching",
            "U2_02": "Hasenbergl",
            "U2_03": "Dülferstraße",
            "U2_04": "Harthof",
            "U2_05": "Am Hart",
            "U2_06": "Frankfurter Ring",
            "U2_07": "Milbertshofen",
            "U2_08": "Scheidplatz",
            "U2_09": "Hohenzollernplatz",
            "U2_10": "Josephsplatz",
            "U2_11": "Theresienstraße",
            "U2_12": "Königsplatz",
            "U2_13": "Hauptbahnhof",
            "U2_14": "Sendlinger Tor",
            "U2_15": "Fraunhoferstraße",
            "U2_16": "Kolumbusplatz",
            "U2_17": "Silberhornstraße",
            "U2_18": "Untersbergstraße",
            "U2_19": "Giesing",
            "U2_20": "Karl-Preis-Platz",
            "U2_21": "Innsbrucker Ring",
            "U2_22": "Josephsburg",
            "U2_23": "Kreillerstr.",
            "U2_24": "Trudering",
            "U2_25": "Moosfeld",
            "U2_26": "Messestadt West",
            "U2_27": "Messestadt Ost",
            
            # U3
            "U3_01": "Moosach",
            "U3_02": "Moosacher St.-Martins-Platz",
            "U3_03": "Olympia Einkaufszentrum",
            "U3_04": "Oberwiesenfeld",
            "U3_05": "Olympiazentrum",
            "U3_06": "Petuelring",
            "U3_07": "Scheidplatz",
            "U3_08": "Bonner Platz",
            "U3_09": "Münchner Freiheit",
            "U3_10": "Giselastraße",
            "U3_11": "Universität",
            "U3_12": "Odeonsplatz",
            "U3_13": "Marienplatz",
            "U3_14": "Sendlinger Tor",
            "U3_15": "Goetheplatz",
            "U3_16": "Poccistraße",
            "U3_17": "Implerstraße",
            "U3_18": "Brudermühlstraße",
            "U3_19": "Thalkirchen",
            "U3_20": "Obersendling",
            "U3_21": "Aidenbachstraße",
            "U3_22": "Machtlfinger Straße",
            "U3_23": "Forstenrieder Allee",
            "U3_24": "Basler Straße",
            "U3_25": "Fürstenried West",
            
            # U4
            "U4_01": "Westendstraße",
            "U4_02": "Heimeranplatz",
            "U4_03": "Schwanthalerhöhe",
            "U4_04": "Theresienwiese",
            "U4_05": "Hauptbahnhof",
            "U4_06": "Karlsplatz (Stachus)",
            "U4_07": "Odeonsplatz",
            "U4_08": "Lehel",
            "U4_09": "Max-Weber-Platz",
            "U4_10": "Prinzregentenplatz",
            "U4_11": "Böhmerwaldplatz",
            "U4_12": "Richard-Strauss-Straße",
            "U4_13": "Arabellapark",
            
            # U5
            "U5_01": "Laimer Platz",
            "U5_02": "Friedenheimer Straße",
            "U5_03": "Westendstraße",
            "U5_04": "Heimeranplatz",
            "U5_05": "Schwanthalerhöhe",
            "U5_06": "Theresienwiese",
            "U5_07": "Hauptbahnhof",
            "U5_08": "Karlsplatz (Stachus)",
            "U5_09": "Odeonsplatz",
            "U5_10": "Lehel",
            "U5_11": "Max-Weber-Platz",
            "U5_12": "Ostbahnhof",
            "U5_13": "Innsbrucker Ring",
            "U5_14": "Michaelibad",
            "U5_15": "Quiddestraße",
            "U5_16": "Neuperlach Zentrum",
            "U5_17": "Therese-Giehse-Allee",
            "U5_18": "Neuperlach Süd",
            
            # U6
            "U6_01": "Garching-Forschungszentrum",
            "U6_02": "Garching",
            "U6_03": "Garching-Hochbrück",
            "U6_04": "Fröttmaning",
            "U6_05": "Kieferngarten",
            "U6_06": "Freimann",
            "U6_07": "Studentenstadt",
            "U6_08": "Alte Heide",
            "U6_09": "Nordfriedhof",
            "U6_10": "Dietlindenstraße",
            "U6_11": "Münchner Freiheit",
            "U6_12": "Giselastraße",
            "U6_13": "Universität",
            "U6_14": "Odeonsplatz",
            "U6_15": "Marienplatz",
            "U6_16": "Sendlinger Tor",
            "U6_17": "Goetheplatz",
            "U6_18": "Poccistraße",
            "U6_19": "Implerstraße",
            "U6_20": "Harras",
            "U6_21": "Partnachplatz",
            "U6_22": "Westpark",
            "U6_23": "Holzapfelkreuth",
            "U6_24": "Haderner Stern",
            "U6_25": "Großhadern",
            "U6_26": "Klinikum Großhadern",
            
            # U7
            "U7_01": "Olympia-Einkaufszentrum",
            "U7_02": "Georg-Brauchle-Ring",
            "U7_03": "Westfriedhof",
            "U7_04": "Gern",
            "U7_05": "Rotkreuzplatz",
            "U7_06": "Maillingerstraße",
            "U7_07": "Stiglmaierplatz",
            "U7_08": "Hauptbahnhof",
            "U7_09": "Sendlinger Tor",
            "U7_10": "Fraunhoferstraße",
            "U7_11": "Kolumbusplatz",
            "U7_12": "Silberhornstraße",
            "U7_13": "Untersbergstraße",
            "U7_14": "Giesing",
            "U7_15": "Karl-Preis-Platz",
            "U7_16": "Innsbrucker Ring",
            "U7_17": "Michaelibad",
            "U7_18": "Quiddestraße",
            "U7_19": "Neuperlach Zentrum",
            
            # U8
            "U8_01": "Olympiazentrum",
            "U8_02": "Petuelring",
            "U8_03": "Scheidplatz",
            "U8_04": "Hohenzollernplatz",
            "U8_05": "Josephsplatz",
            "U8_06": "Theresienstraße",
            "U8_07": "Königsplatz",
            "U8_08": "Hauptbahnhof",
            "U8_09": "Sendlinger Tor",
            "U8_10": "Fraunhoferstraße",
            "U8_11": "Kolumbusplatz",
            "U8_12": "Silberhornstraße",
            "U8_13": "Untersbergstraße",
            "U8_14": "Giesing",
            "U8_15": "Karl-Preis-Platz",
            "U8_16": "Innsbrucker Ring",
            "U8_17": "Michaelibad",
            "U8_18": "Quiddestraße",
            "U8_19": "Neuperlach Zentrum",
        }
        
        # Thêm tên cho các ga còn thiếu
        for line in self._lines_data:
            for station in self._lines_data[line]:
                if station not in names:
                    # Tạo tên mặc định
                    names[station] = f"{line} Station {station.split('_')[1]}"
        
        return names
    
    def _calculate_travel_time(self, u: str, v: str) -> int:
        """
        Tính thời gian di chuyển giữa 2 ga dựa trên khoảng cách thực tế.
        Vận tốc trung bình: 30 km/h = 8.33 m/s
        """
        if u in self._station_coords and v in self._station_coords:
            dist = geodesic(
                self._station_coords[u],
                self._station_coords[v]
            ).meters
            # 30 km/h ≈ 8.33 m/s
            travel_time = int(dist / 8.33)
            return max(travel_time, 60)  # Tối thiểu 1 phút
        return 90  # Mặc định 1.5 phút
    
    def _add_transfer_edges(self, transfer_time: int = 120):
        """
        Thêm các edge chuyển tuyến giữa các ga có cùng vị trí (cùng tọa độ).
        
        Parameters
        ----------
        transfer_time : int
            Thời gian chuyển tuyến mặc định (giây)
        """
        if self.graph is None:
            return
        
        # Nhóm các station có cùng tọa độ
        coord_groups = {}
        
        for node, data in self.graph.nodes(data=True):
            # Lấy tọa độ (ưu tiên lat/lon, fallback sang y/x)
            lat = data.get("lat")
            lon = data.get("lon")
            if lat is None or lon is None:
                continue
            
            if lat is not None and lon is not None:
                # Làm tròn tọa độ để so sánh (độ chính xác 5 decimal ~ 1m)
                key = (round(lat, 5), round(lon, 5))
                coord_groups.setdefault(key, []).append(node)
        
        # Thêm transfer edges giữa các node cùng vị trí
        transfer_edges_added = 0
        for group in coord_groups.values():
            if len(group) > 1:
                for i in range(len(group)):
                    for j in range(i + 1, len(group)):
                        u, v = group[i], group[j]
                        
                        # Thêm edge 2 chiều cho transfer
                        if self.use_multigraph:
                            self.graph.add_edge(u, v, line="transfer", travel_time=transfer_time)
                            self.graph.add_edge(v, u, line="transfer", travel_time=transfer_time)
                        else:
                            # Với DiGraph, kiểm tra xem edge đã tồn tại chưa
                            if not self.graph.has_edge(u, v):
                                self.graph.add_edge(u, v, line="transfer", travel_time=transfer_time)
                            if not self.graph.has_edge(v, u):
                                self.graph.add_edge(v, u, line="transfer", travel_time=transfer_time)
                        
                        transfer_edges_added += 2
        
        logger.info(f"Added {transfer_edges_added} transfer edges between "
                   f"{len([g for g in coord_groups.values() if len(g) > 1])} transfer stations")
    
    def build(self, travel_time_mode: str = "auto", add_transfers: bool = True) -> nx.Graph:
        """
        Xây dựng đồ thị Munich U-Bahn.
        
        Parameters
        ----------
        travel_time_mode : str
            "auto": tính từ khoảng cách thực tế
            "fixed": dùng thời gian cố định 90 giây
            "real": dùng dữ liệu thực tế (nếu có)
        add_transfers : bool
            Có thêm transfer edges giữa các ga trung chuyển không
        
        Returns
        -------
        nx.Graph
            Đồ thị mạng lưới (MultiDiGraph hoặc DiGraph)
        """
        # Tạo graph
        if self.use_multigraph:
            self.graph = nx.MultiDiGraph()
        else:
            self.graph = nx.DiGraph()
        
        # Thêm nodes
        all_stations = set()
        for stations in self._lines_data.values():
            all_stations.update(stations)
        
        for station in all_stations:
            # Thêm tọa độ nếu có
            if station in self._station_coords:
                lat, lon = self._station_coords[station]
                self.graph.add_node(
                    station,
                    name=self._station_names.get(station, station),
                    y=lat,
                    x=lon,
                    lat=lat,
                    lon=lon
                )
            else:
                self.graph.add_node(
                    station,
                    name=self._station_names.get(station, station),
                    y=48.140,  # Tọa độ trung tâm mặc định
                    x=11.570
                )
        
        # Thêm edges cho mỗi tuyến
        for line, stations in self._lines_data.items():
            for i in range(len(stations) - 1):
                u, v = stations[i], stations[i + 1]
                
                # Tính thời gian di chuyển
                if travel_time_mode == "auto":
                    travel_time = self._calculate_travel_time(u, v)
                elif travel_time_mode == "fixed":
                    travel_time = 90
                else:  # real - dùng dữ liệu thực tế
                    travel_time = 90  # TODO: Thêm dữ liệu thực tế
                
                # Thêm edge 2 chiều
                self.graph.add_edge(u, v, line=line, travel_time=travel_time)
                self.graph.add_edge(v, u, line=line, travel_time=travel_time)
        
        logger.info(f"Built Munich U-Bahn graph: {self.graph.number_of_nodes()} nodes, "
                   f"{self.graph.number_of_edges()} edges")
        
        # Thêm transfer edges
        if add_transfers:
            self._add_transfer_edges()
        
        return self.graph
    
    def get_graph(self) -> nx.Graph:
        """Trả về graph đã xây dựng"""
        if self.graph is None:
            self.build()
        return self.graph
    
    def get_station_name(self, station_code: str) -> str:
        """Lấy tên đầy đủ của ga"""
        return self._station_names.get(station_code, station_code)
    
    def get_station_coords(self, station_code: str) -> Optional[Tuple[float, float]]:
        """Lấy tọa độ của ga"""
        return self._station_coords.get(station_code)
    
    def find_station_by_name(self, name: str) -> List[str]:
        """Tìm mã ga theo tên (partial match)"""
        results = []
        name_lower = name.lower()
        for code, full_name in self._station_names.items():
            if name_lower in full_name.lower():
                results.append(code)
        return results
    
    def print_route(self, path: List[str]) -> None:
        """In route dưới dạng text dễ đọc"""
        if not path:
            print("Không có đường đi")
            return
        
        print(f"\n{'='*60}")
        print(f"Hành trình: {len(path)} ga")
        print(f"{'='*60}")
        
        for i, station in enumerate(path):
            name = self.get_station_name(station)
            print(f"{i+1:3d}. {station} - {name}")
    
    def get_transfer_stations(self) -> List[Tuple[str, List[str]]]:
        """
        Lấy danh sách các ga trung chuyển (nhiều tuyến cùng vị trí)
        
        Returns
        -------
        List[Tuple[str, List[str]]]
            Mỗi tuple: (tọa độ, danh sách mã ga)
        """
        if self.graph is None:
            return []
        
        coord_groups = {}
        for node, data in self.graph.nodes(data=True):
            lat = data.get("lat", data.get("y"))
            lon = data.get("lon", data.get("x"))
            if lat and lon:
                key = f"{round(lat, 5)},{round(lon, 5)}"
                coord_groups.setdefault(key, []).append(node)
        
        transfers = [(key, group) for key, group in coord_groups.items() if len(group) > 1]
        return sorted(transfers, key=lambda x: len(x[1]), reverse=True)


# ---------------------------------------------------------------------------
# Factory functions để tạo graph dễ dàng
# ---------------------------------------------------------------------------

def create_munich_graph(
    use_multigraph: bool = True,
    travel_time_mode: str = "auto",
    add_transfers: bool = True
) -> nx.Graph:
    """
    Tạo graph Munich U-Bahn với cấu hình mặc định.
    
    Parameters
    ----------
    use_multigraph : bool
        True: MultiDiGraph, False: DiGraph
    travel_time_mode : str
        "auto", "fixed", or "real"
    add_transfers : bool
        Có thêm transfer edges không
    
    Returns
    -------
    nx.Graph
        Đồ thị mạng lưới
    """
    builder = MunichSubwayGraph(use_multigraph=use_multigraph)
    return builder.build(travel_time_mode=travel_time_mode, add_transfers=add_transfers)


# ---------------------------------------------------------------------------
# Ví dụ sử dụng
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Test xây dựng graph
    print("Building Munich U-Bahn graph...")
    
    # Tạo graph với MultiDiGraph
    G = create_munich_graph(use_multigraph=True)
    
    print(f"\nGraph info:")
    print(f"  Type: {type(G).__name__}")
    print(f"  Nodes: {G.number_of_nodes()}")
    print(f"  Edges: {G.number_of_edges()}")
    
    # Test tìm ga theo tên
    builder = MunichSubwayGraph()
    print(f"\nSearch for 'Hauptbahnhof':")
    results = builder.find_station_by_name("Hauptbahnhof")
    for code in results:
        print(f"  {code}: {builder.get_station_name(code)}")
    
    # Test in thông tin một vài ga
    print(f"\nSample stations:")
    sample_stations = ["U1_01", "U3_13", "U6_26"]
    for station in sample_stations:
        name = builder.get_station_name(station)
        coords = builder.get_station_coords(station)
        print(f"  {station}: {name} @ {coords}")
    
    # Test transfer stations
    print(f"\nTransfer stations (stations with multiple lines):")
    transfers = builder.get_transfer_stations()
    for coord, stations in transfers[:5]:  # Chỉ hiển thị 5 ga đầu
        print(f"  {coord}: {stations}")
