# gọi thuật toán và xử lí logic
# backend/services/pathfinding_service.py

# import thuật toán
from algorithms.dijkstra import dijkstra

# load graph từ data
from repositories.data_loader import load_graph

# load graph 1 lần duy nhất (IMPORTANT)
graph = load_graph()


def find_path(source, target, mode="shortest"):
    """
    Hàm chính xử lý tìm đường
    - source: điểm bắt đầu
    - target: điểm kết thúc
    - mode: loại tìm đường
    """

    # hiện tại chỉ dùng dijkstra
    path, cost = dijkstra(graph, source, target)

    return {
        "path": path,
        "cost": cost
    }