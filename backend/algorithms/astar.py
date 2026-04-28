"""
A* Subway Route Finder
======================
Thuật toán A* tối ưu cho mạng lưới tàu điện ngầm.
Cost Function:
total_cost = travel_time + transfer_penalty
A*:
- g(n): thời gian thực tế từ start → n
- h(n): heuristic_time (geodesic / max_speed)
- f(n) = g(n) + h(n)

Design Goals:
- Hỗ trợ MultiGraph (OSMnx)
- Heuristic admissible
- Tránh infinite loop khi reconstruct path
"""


import heapq
import logging
from typing import Any

import networkx as nx
from geopy.distance import geodesic

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Hằng số mặc định
# ---------------------------------------------------------------------------

# Tốc độ tàu tối đa trung bình (m/s) dùng khi graph không có dữ liệu speed.
# 40 km/h ≈ 11.1 m/s — giá trị conservative để heuristic không overestimate.
DEFAULT_MAX_SPEED_MS: float = 11.1

# Thời gian đi tàu mặc định giữa 2 ga liền kề khi không có dữ liệu (giây).
DEFAULT_TRAVEL_TIME_S: int = 120  # 2 phút

# Số bước tối đa khi reconstruct path (tránh loop vô hạn).
MAX_PATH_STEPS: int = 10_000

# Mapping tên line → tên hệ thống (dùng để tính extra penalty).
# Mở rộng theo dữ liệu thực tế của bạn.
LINE_SYSTEM_MAP: dict[str, str] = {
    "2A": "Cat Linh - Ha Dong",
    "3":  "Nhon - Hanoi Station",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_multigraph(G: nx.Graph) -> bool:
    return isinstance(G, (nx.MultiGraph, nx.MultiDiGraph))


def _get_edge_data(G: nx.Graph, u: Any, v: Any) -> dict:
    """Lấy edge data an toàn, hỗ trợ cả Graph lẫn MultiGraph.
        WHY:
    - NetworkX MultiGraph cho phép nhiều edge giữa cùng 2 node (u, v)
    - Mỗi edge có thể đại diện cho các tuyến khác nhau (line khác nhau)
    - Ta cần chọn edge "tốt nhất" để tính shortest path"""
    if _is_multigraph(G):
        # MultiGraph: G[u][v] là dict {key: edge_data}
        # Chọn edge có travel_time nhỏ nhất (đường nhanh nhất giữa 2 ga).
        edges = G[u][v]
        return min(edges.values(), key=lambda d: d.get("travel_time", d.get("weight", DEFAULT_TRAVEL_TIME_S)))
    return G[u][v]


def _get_line_info(edge_data: dict) -> str | None:
    """Trích xuất thông tin line từ edge data."""
    for key in ("line", "route"):
        if key in edge_data:
            return edge_data[key]
    lines = edge_data.get("lines")
    if lines:
        return lines[0]
    return None


def _get_max_speed(G: nx.Graph) -> float:
    """
    Lấy tốc độ tối đa từ các edge trong graph để đảm bảo heuristic admissible.
    Heuristic dùng max_speed → không bao giờ overestimate thời gian thực.
    """
    max_speed = DEFAULT_MAX_SPEED_MS
    sample_edges = list(G.edges(data=True))[:200]  # sample để tránh scan toàn bộ graph lớn

    for _, _, data in sample_edges:
        if _is_multigraph(G):
            # data ở đây là dict of dicts với MultiGraph khi dùng G.edges(data=True)
            # nhưng NetworkX trả về edge data thẳng nếu keys=False
            pass
        speed = data.get("max_speed", data.get("speed", None))
        if speed is not None:
            try:
                speed_ms = float(speed) / 3.6  # km/h → m/s
                max_speed = max(max_speed, speed_ms)
            except (ValueError, TypeError):
                pass

    return max_speed

def _node_coords(G: nx.Graph, node: Any) -> tuple[float, float]:
    """
    Lấy tọa độ (latitude, longitude) của một node trong graph.
    
    WHY cần hàm này?
    - OSMnx thường dùng 'y' cho latitude, 'x' cho longitude
    - NetworkX thuần túy có thể dùng 'lat' và 'lon'
    - Hàm này xử lý cả hai trường hợp, trả về định dạng chuẩn (lat, lon)
    
    Parameters
    ----------
    G : NetworkX Graph
        Đồ thị chứa node
    node : Any
        ID của node cần lấy tọa độ
    
    Returns
    -------
    tuple[float, float]
        (latitude, longitude) - Vĩ độ, Kinh độ
        Trả về (0.0, 0.0) nếu không tìm thấy tọa độ
    """
    # Truy xuất dictionary chứa attributes của node
    data = G.nodes[node]
    
    # Ưu tiên lấy 'y' (cách đặt tên của OSMnx) hoặc 'lat'
    # OSMnx: node['y'] = vĩ độ (latitude)
    # NetworkX thuần: node['lat'] = vĩ độ
    lat = data.get("y", data.get("lat", 0.0))
    
    # Ưu tiên lấy 'x' (cách đặt tên của OSMnx) hoặc 'lon'  
    # OSMnx: node['x'] = kinh độ (longitude)
    # NetworkX thuần: node['lon'] = kinh độ
    lon = data.get("x", data.get("lon", 0.0))
    
    # Ép kiểu về float để đảm bảo tính toán chính xác
    return float(lat), float(lon)


def _is_different_system(line1: str, line2: str) -> bool:
    """
    Kiểm tra xem 2 line có thuộc hệ thống khác nhau không.

    """
    system1 = LINE_SYSTEM_MAP.get(line1, "__unknown__")
    system2 = LINE_SYSTEM_MAP.get(line2, "__unknown__")

    # Cả hai đều unknown → coi là cùng hệ thống (không phạt thêm)
    if system1 == "__unknown__" and system2 == "__unknown__":
        return False

    return system1 != system2


def _transfer_cost(
    current_line: str | None,
    next_line: str | None,
    transfer_penalty: int,
    line_change_penalty: int,
) -> int:
    """Tính penalty khi chuyển tuyến.
    LOGIC:
- Không có line → không phạt (start node hoặc thiếu data)
- Cùng line → không phạt
- Khác line → áp dụng transfer_penalty
- Nếu khác hệ thống (metro khác nhau) → thêm line_change_penalty

WHY:
- Mô phỏng thực tế: đổi line tốn thời gian (đi bộ, chờ tàu)
- Đổi hệ thống thường tốn thêm (ví dụ metro → tram)
"""
    if current_line is None or next_line is None:
        return 0
    if current_line == next_line:
        return 0

    cost = transfer_penalty
    if _is_different_system(current_line, next_line):
        cost += line_change_penalty
    return cost


# ---------------------------------------------------------------------------
# Heuristic
# ---------------------------------------------------------------------------

def heuristic_time(G: nx.Graph, node: Any, dest_node: Any, max_speed: float) -> float:
    """
    Heuristic admissible: thời gian tối thiểu theo đường thẳng (giây).

    Dùng max_speed (tốc độ nhanh nhất có thể) để đảm bảo không overestimate.
    IDEA:
    - Dùng khoảng cách địa lý (great-circle distance)
    - Chia cho max_speed → thời gian nhanh nhất có thể

    WHY ADMISSIBLE:
    - max_speed là tốc độ lớn nhất trong graph
    → heuristic luôn <= thời gian thực tế
    → đảm bảo A* tìm đúng shortest path

    TRADE-OFF:
    - Nếu max_speed quá lớn → heuristic yếu (gần giống Dijkstra)
    - Nếu max_speed chính xác → A* rất nhanh
    """
    # BƯỚC 1: LẤY TỌA ĐỘ (kinh độ, vĩ độ) CỦA HAI ĐIỂM
    # ====================================================
    # node: điểm đang xét (current node trong A*)
    # dest_node: điểm đích cần đến
    # Hàm _node_coords trả về tuple (latitude, longitude)
    node_coords = _node_coords(G, node)      # Ví dụ: (21.0285, 105.8542) - Hà Nội
    dest_coords = _node_coords(G, dest_node) # Ví dụ: (21.0065, 105.8435) - ga khác
    
    # BƯỚC 2: KIỂM TRA DỮ LIỆU HỢP LỆ
    # ================================
    # Nếu tọa độ là (0.0, 0.0) → thiếu dữ liệu GPS
    # Trả về 0 để heuristic không overestimate (vẫn đúng nhưng kém hiệu quả)
    if node_coords == (0.0, 0.0) or dest_coords == (0.0, 0.0):
        return 0.0  # Thiếu dữ liệu tọa độ → heuristic = 0 (vẫn correct nhưng kém hiệu quả)
    
    # BƯỚC 3: TÍNH KHOẢNG CÁCH ĐỊA LÝ (GEODESIC DISTANCE)
    # ====================================================
    # geodesic(): tính khoảng cách ngắn nhất giữa 2 điểm trên bề mặt ellipsoid Trái Đất
    # Công thức: sử dụng mô hình WGS84 (hệ tọa độ GPS chuẩn)
    # Khác với Euclidean (đường thẳng trong không gian 3D) 
    # và khác với Haversine (công thức gần đúng trên mặt cầu)
    # 
    # Ví dụ: Hà Nội (21.0285, 105.8542) đến ga Cát Linh (21.0288, 105.8357)
    # → geodesic() ≈ 1,850 meters (khoảng cách thực tế trên mặt đất)
    distance_m = geodesic(node_coords, dest_coords).meters  # Đơn vị: meters
    
    # BƯỚC 4: CHUYỂN KHOẢNG CÁCH → THỜI GIAN HEURISTIC
    # =================================================
    # Công thức: time = distance / speed
    # - distance: meters (khoảng cách địa lý)
    # - max_speed: m/s (tốc độ tối đa trong toàn bộ mạng lưới)
    # 
    # Lý do chia cho max_speed:
    #   → Giả sử tàu có thể chạy với vận tốc tối đa trên đường thẳng
    #   → Đây là thời gian NHANH NHẤT có thể (lower bound)
    #   → Đảm bảo heuristic ADMISSIBLE (không overestimate)
    # 
    # Ví dụ: distance = 1850m, max_speed = 11.1 m/s (40 km/h)
    # → heuristic = 1850 / 11.1 ≈ 166.7 giây (~2.8 phút)
    # 
    # Trong thực tế, tàu phải đi theo đường ray, dừng đỗ, đổi tuyến...
    # → thời gian thực LUÔN lớn hơn 166.7 giây
    return distance_m / max_speed

# ---------------------------------------------------------------------------
# A* core
# ---------------------------------------------------------------------------

def a_star_subway(
    G: nx.Graph,
    orig_node: Any,
    dest_node: Any,
    transfer_penalty: int = 300,
    line_change_penalty: int = 120,
) -> dict:
    """
    A* tìm đường trên mạng lưới tàu điện ngầm.

    Parameters
    ----------
    G : NetworkX Graph (Graph, DiGraph, MultiGraph, MultiDiGraph)
        Đồ thị mạng lưới tàu. Node cần có thuộc tính tọa độ (x/lon, y/lat).
        Edge nên có thuộc tính 'travel_time' (giây) và 'line'.
    orig_node : node id — ga xuất phát.
    dest_node : node id — ga đích.
    transfer_penalty : int — penalty (giây) khi đổi tuyến.
    line_change_penalty : int — penalty bổ sung khi đổi sang hệ thống khác.

    Returns
    -------
    dict với các key:
        found         : bool
        path          : list[node]
        total_time    : float (giây)
        total_minutes : float
        route_details : list[dict]  (từng đoạn theo line)
        visited_nodes : list[node]  (thứ tự A* thăm)
        edges_explored: dict        {(u,v): edge_info}
        num_stations  : int
    """
    if orig_node not in G or dest_node not in G:
        raise ValueError(f"Node không tồn tại trong graph: orig={orig_node}, dest={dest_node}")

    if orig_node == dest_node:
        return _build_result(found=True, path=[orig_node], time_scores={orig_node: 0},
                             visited=[], edges={}, G=G)

    max_speed = _get_max_speed(G)

    # Priority queue: (f_score, counter, node)
    # counter để tránh so sánh node khi f_score bằng nhau
    counter = 0
    queue: list[tuple[float, int, Any]] = [(0.0, counter, orig_node)]

    visited: set = set()
    visited_order: list = []

    came_from: dict = {}
    time_scores: dict = {orig_node: 0.0}
    node_line: dict = {orig_node: None}  # line hiện tại tại mỗi node
    edges_explored: dict[tuple, dict] = {}  # {(u,v): edge_info}

    while queue:
        f, _, current = heapq.heappop(queue)

        # Skip nếu node đã xử lý (lazy deletion pattern)
        # Heap không hỗ trợ decrease-key nên có thể tồn tại entry cũ

        if current in visited:
            continue

        visited.add(current)
        visited_order.append(current)
        # A*: khi pop dest_node → đã tìm được đường tối ưu
        if current == dest_node:
            break

        for neighbor in G.neighbors(current):
            if neighbor in visited:
                continue
            # Tính chi phí đi từ current → neighbor
            edge_data = _get_edge_data(G, current, neighbor)
            travel_time = float(edge_data.get("travel_time", edge_data.get("weight", DEFAULT_TRAVEL_TIME_S)))
            neighbor_line = _get_line_info(edge_data)

            penalty = _transfer_cost(node_line[current], neighbor_line, transfer_penalty, line_change_penalty)
            segment_time = travel_time + penalty
            # g(n): chi phí thực từ start → neighbor
            tentative_time = time_scores[current] + segment_time
            # RELAXATION STEP (core của A*/Dijkstra)
            # Nếu tìm được đường tốt hơn tới neighbor → cập nhật
            # time_scores[node] luôn là chi phí tốt nhất đã biết từ start → node
            if neighbor not in time_scores or tentative_time < time_scores[neighbor]:
                came_from[neighbor] = current
                time_scores[neighbor] = tentative_time
                node_line[neighbor] = neighbor_line

                h = heuristic_time(G, neighbor, dest_node, max_speed)
                f_score = tentative_time + h

                counter += 1
                heapq.heappush(queue, (f_score, counter, neighbor))

                # Ghi lại edge (overwrite nếu tìm được đường tốt hơn)
                edges_explored[(current, neighbor)] = {
                    "travel_time": travel_time,
                    "transfer_cost": penalty,
                    "total_time": segment_time,
                    "line": neighbor_line,
                }

    return _build_result(
        found=dest_node in came_from or dest_node == orig_node,
        path=_reconstruct_path(came_from, orig_node, dest_node),
        time_scores=time_scores,
        visited=visited_order,
        edges=edges_explored,
        G=G,
    )


# ---------------------------------------------------------------------------
# Path reconstruction
# ---------------------------------------------------------------------------

def _reconstruct_path(came_from: dict, start: Any, goal: Any) -> list:
    """
    Tái tạo đường đi từ came_from dict.
    Có giới hạn MAX_PATH_STEPS để tránh loop vô hạn.
    """
    if goal not in came_from:
        return [] if goal != start else [start]

    path = []
    current = goal
    steps = 0

    while current != start:
        if steps > MAX_PATH_STEPS:
            logger.error("reconstruct_path: vượt quá giới hạn bước, có thể có cycle trong came_from.")
            return []
        path.append(current)
        current = came_from.get(current)
        if current is None:
            return []
        steps += 1

    path.append(start)
    path.reverse()
    return path


# ---------------------------------------------------------------------------
# Route formatting
# ---------------------------------------------------------------------------

def format_route_info(path: list, G: nx.Graph) -> list[dict]:
    """
    Gom đường đi thành các đoạn liên tiếp cùng line.

    Returns list[dict], mỗi dict:
        from_node, to_node, line, num_stops, duration_s
    """
    if not path or len(path) < 2:
        return []

    segments = []
    segment_start = path[0]
    segment_time: float = 0.0  # khởi tạo rõ ràng
    current_line: str | None = None
    stop_count: int = 0

    for i in range(len(path) - 1):
        u, v = path[i], path[i + 1]
        edge_data = _get_edge_data(G, u, v)
        line = _get_line_info(edge_data)
        travel_time = float(edge_data.get("travel_time", edge_data.get("weight", DEFAULT_TRAVEL_TIME_S)))

        if line != current_line:
            # Lưu đoạn cũ (nếu có)
            if current_line is not None or stop_count > 0:
                if stop_count > 0:
                    segments.append({
                        "from_node": segment_start,
                        "to_node": u,
                        "line": current_line,
                        "num_stops": stop_count,
                        "duration_s": segment_time,
                        "duration_min": round(segment_time / 60, 1),
                    })
            # Bắt đầu đoạn mới
            current_line = line
            segment_start = u
            segment_time = travel_time
            stop_count = 1
        else:
            segment_time += travel_time
            stop_count += 1

    # Đoạn cuối
    if stop_count > 0:
        segments.append({
            "from_node": segment_start,
            "to_node": path[-1],
            "line": current_line,
            "num_stops": stop_count,
            "duration_s": segment_time,
            "duration_min": round(segment_time / 60, 1),
        })

    return segments


# ---------------------------------------------------------------------------
# Build result helper
# ---------------------------------------------------------------------------

def _build_result(
    found: bool,
    path: list,
    time_scores: dict,
    visited: list,
    edges: dict,
    G: nx.Graph,
) -> dict:
    if not found or not path:
        return {
            "found": False,
            "message": "Không tìm thấy đường đi giữa hai ga.",
            "path": [],
            "total_time": 0,
            "total_minutes": 0,
            "route_details": [],
            "visited_nodes": visited,
            "edges_explored": edges,
            "num_stations": 0,
        }

    goal = path[-1]
    total_time = time_scores.get(goal, 0.0)

    return {
        "found": True,
        "path": path,
        "total_time": total_time,
        "total_minutes": round(total_time / 60, 1),
        "route_details": format_route_info(path, G),
        "visited_nodes": visited,
        "edges_explored": edges,
        "num_stations": len(path),
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def find_route_with_lines(G: nx.Graph, start: Any, end: Any) -> dict:
    """
    Tìm đường từ ga `start` đến ga `end`.
    Wrapper đơn giản của a_star_subway().
    """
    return a_star_subway(G, start, end)