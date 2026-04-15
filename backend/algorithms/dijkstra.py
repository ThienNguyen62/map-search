"""
Dijkstra Subway Route Finder
=============================
Thuật toán Dijkstra tìm đường tối ưu trên mạng lưới tàu điện ngầm.

So sánh với A*:
- Dijkstra: không dùng heuristic, duyệt toàn bộ graph theo chi phí thực
- A*: dùng heuristic địa lý để hướng tìm kiếm về phía đích → nhanh hơn trên graph lớn
- Dijkstra đảm bảo tìm được đường tối ưu tuyệt đối (không phụ thuộc heuristic)
- Phù hợp hơn khi graph nhỏ hoặc khi cần kết quả chắc chắn 100%
geopy networkx osmnx
"""

import heapq
import logging
from typing import Any

import networkx as nx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Hằng số mặc định (giữ nguyên như bản A*)
# ---------------------------------------------------------------------------

DEFAULT_TRAVEL_TIME_S: int = 120    # 2 phút — dùng khi edge không có travel_time
MAX_PATH_STEPS: int = 10_000        # Giới hạn bước reconstruct_path

LINE_SYSTEM_MAP: dict[str, str] = {
    "2A": "Cat Linh - Ha Dong",
    "3":  "Nhon - Hanoi Station",
}


# ---------------------------------------------------------------------------
# Helpers (tái sử dụng logic từ bản A*)
# ---------------------------------------------------------------------------

def _is_multigraph(G: nx.Graph) -> bool:
    return isinstance(G, (nx.MultiGraph, nx.MultiDiGraph))


def _get_edge_data(G: nx.Graph, u: Any, v: Any) -> dict:
    """Lấy edge data an toàn, hỗ trợ cả Graph lẫn MultiGraph."""
    if _is_multigraph(G):
        edges = G[u][v]
        return min(
            edges.values(),
            key=lambda d: d.get("travel_time", d.get("time", d.get("weight", DEFAULT_TRAVEL_TIME_S)))
        )
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


def _is_different_system(line1: str, line2: str) -> bool:
    """
    Kiểm tra xem 2 line có thuộc hệ thống khác nhau không.
    Line không có trong LINE_SYSTEM_MAP → coi là cùng hệ thống.
    """
    system1 = LINE_SYSTEM_MAP.get(line1, "__unknown__")
    system2 = LINE_SYSTEM_MAP.get(line2, "__unknown__")
    if system1 == "__unknown__" and system2 == "__unknown__":
        return False
    return system1 != system2


def _transfer_cost(
    current_line: str | None,
    next_line: str | None,
    transfer_penalty: int,
    line_change_penalty: int,
) -> int:
    """Tính penalty khi chuyển tuyến."""
    if current_line is None or next_line is None:
        return 0
    if current_line == next_line:
        return 0
    cost = transfer_penalty
    if _is_different_system(current_line, next_line):
        cost += line_change_penalty
    return cost


# ---------------------------------------------------------------------------
# Dijkstra core
# ---------------------------------------------------------------------------

def dijkstra_subway(
    G: nx.Graph,
    orig_node: Any,
    dest_node: Any,
    transfer_penalty: int = 300,
    line_change_penalty: int = 120,
) -> dict:
    """
    Dijkstra tìm đường trên mạng lưới tàu điện ngầm.

    Parameters
    ----------
    G : NetworkX Graph (Graph, DiGraph, MultiGraph, MultiDiGraph)
        Đồ thị mạng lưới tàu. Edge nên có thuộc tính 'travel_time' (giây) và 'line'.
    orig_node : node id — ga xuất phát.
    dest_node : node id — ga đích.
    transfer_penalty : int — penalty (giây) khi đổi tuyến.
    line_change_penalty : int — penalty bổ sung khi đổi sang hệ thống khác.

    Returns
    -------
    dict với các key:
        found          : bool
        path           : list[node]
        total_time     : float (giây)
        total_minutes  : float
        route_details  : list[dict]  (từng đoạn theo line)
        visited_nodes  : list[node]  (thứ tự Dijkstra thăm)
        edges_explored : dict        {(u,v): edge_info}
        num_stations   : int
    """
    if orig_node not in G or dest_node not in G:
        raise ValueError(f"Node không tồn tại trong graph: orig={orig_node}, dest={dest_node}")

    if orig_node == dest_node:
        return _build_result(
            found=True, path=[orig_node],
            time_scores={orig_node: 0.0},
            visited=[], edges={}, G=G,
        )

    # Priority queue: (cost, counter, node)
    # Dijkstra chỉ dùng g_score (chi phí thực), không có heuristic
    counter = 0
    queue: list[tuple[float, int, Any]] = [(0.0, counter, orig_node)]

    visited: set = set()
    visited_order: list = []

    came_from: dict = {}
    time_scores: dict = {orig_node: 0.0}
    node_line: dict = {orig_node: None}
    edges_explored: dict[tuple, dict] = {}

    while queue:
        cost, _, current = heapq.heappop(queue)

        if current in visited:
            continue

        visited.add(current)
        visited_order.append(current)

        # Dijkstra: khi pop dest_node lần đầu → đường ngắn nhất đã tìm được
        if current == dest_node:
            break

        for neighbor in G.neighbors(current):
            if neighbor in visited:
                continue

            edge_data = _get_edge_data(G, current, neighbor)
            travel_time = float(
                edge_data.get("travel_time", edge_data.get("time", edge_data.get("weight", DEFAULT_TRAVEL_TIME_S)))
            )
            neighbor_line = _get_line_info(edge_data)

            penalty = _transfer_cost(
                node_line[current], neighbor_line,
                transfer_penalty, line_change_penalty,
            )
            segment_time = travel_time + penalty
            tentative_time = time_scores[current] + segment_time

            if neighbor not in time_scores or tentative_time < time_scores[neighbor]:
                came_from[neighbor] = current
                time_scores[neighbor] = tentative_time
                node_line[neighbor] = neighbor_line

                # Dijkstra: push g_score thẳng, không cộng heuristic
                counter += 1
                heapq.heappush(queue, (tentative_time, counter, neighbor))

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
    """Tái tạo đường đi. Có giới hạn MAX_PATH_STEPS để tránh loop vô hạn."""
    if goal not in came_from:
        return [] if goal != start else [start]

    path = []
    current = goal
    steps = 0

    while current != start:
        if steps > MAX_PATH_STEPS:
            logger.error("_reconstruct_path: vượt giới hạn bước, có thể có cycle.")
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
        from_node, to_node, line, num_stops, duration_s, duration_min
    """
    if not path or len(path) < 2:
        return []

    segments = []
    segment_start = path[0]
    segment_time: float = 0.0
    current_line: str | None = None
    stop_count: int = 0

    for i in range(len(path) - 1):
        u, v = path[i], path[i + 1]
        edge_data = _get_edge_data(G, u, v)
        line = _get_line_info(edge_data)
        travel_time = float(
            edge_data.get("travel_time", edge_data.get("time", edge_data.get("weight", DEFAULT_TRAVEL_TIME_S)))
        )

        if line != current_line:
            if stop_count > 0:
                segments.append({
                    "from_node": segment_start,
                    "to_node": u,
                    "line": current_line,
                    "num_stops": stop_count,
                    "duration_s": segment_time,
                    "duration_min": round(segment_time / 60, 1),
                })
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
    Wrapper đơn giản của dijkstra_subway().
    """
    return dijkstra_subway(G, start, end)


def dijkstra(G: nx.Graph, orig_node: Any, dest_node: Any, transfer_penalty: int = 300, line_change_penalty: int = 120):
    """Compatibility wrapper for backend code that expects (path, cost)."""
    result = dijkstra_subway(G, orig_node, dest_node, transfer_penalty, line_change_penalty)
    return result["path"], result["total_time"]
