from graph import create_munich_graph
from a_star_subway import find_route_with_lines as astar
from dijkstra_subway import find_route_with_lines as dijkstra

import sys
def main():
    print("Building graph...")
    G = create_munich_graph()
    start = sys.argv[1]
    end = sys.argv[2]     # Messestadt Ost

    print("\n===== A* =====")
    result_a = astar(G, start, end)
    print_result(result_a)

    print("\n===== Dijkstra =====")
    result_d = dijkstra(G, start, end)
    print_result(result_d)

    print("A* visited:", len(result_a["visited_nodes"]))
    print("Dijkstra visited:", len(result_d["visited_nodes"]))


def print_result(result):
    if not result["found"]:
        print("Không tìm thấy đường đi")
        return

    print(f"Số ga: {result['num_stations']}")
    print(f"Thời gian: {result['total_minutes']} phút")
    

    print("\nChi tiết:")
    for seg in result["route_details"]:
        print(
            f"{seg['from_node']} → {seg['to_node']} | "
            f"Line: {seg['line']} | "
            f"{seg['num_stops']} stops | "
            f"{seg['duration_min']} min"
        )


if __name__ == "__main__":
    main()