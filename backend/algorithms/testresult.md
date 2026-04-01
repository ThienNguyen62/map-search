Powershell

python -m venv .venv
.venv\Scripts\Activate
pip install -r requirements.txt
python test.py trạm_1 trạm_2 (Ví dụ U2_01 U3_20)


***U1_01 U2_27***

Số ga: 23
Thời gian: 44.0 phút

Chi tiết:
U1_01 → U1_09 | Line: U1 | 8 stops | 12.4 min
U1_09 → U2_14 | Line: transfer | 1 stops | 2.0 min
U2_14 → U2_27 | Line: U2 | 13 stops | 19.5 min

===== Dijkstra =====
Số ga: 23
Thời gian: 44.0 phút

Chi tiết:
U1_01 → U1_09 | Line: U1 | 8 stops | 12.4 min
U1_09 → U2_14 | Line: transfer | 1 stops | 2.0 min
U2_14 → U2_27 | Line: U2 | 13 stops | 19.5 min
A* visited: 158
Dijkstra visited: 162
**********************

***U3_01 U3_25***

===== A* =====
Số ga: 25
Thời gian: 35.4 phút

Chi tiết:
U3_01 → U3_25 | Line: U3 | 24 stops | 35.4 min

===== Dijkstra =====
Số ga: 25
Thời gian: 35.4 phút

Chi tiết:
U3_01 → U3_25 | Line: U3 | 24 stops | 35.4 min
A* visited: 101
Dijkstra visited: 112
**********************

***U1_01 U6_01***

===== A* =====
Số ga: 19
Thời gian: 43.0 phút

Chi tiết:
U1_01 → U3_03 | Line: transfer | 1 stops | 2.0 min
U3_03 → U3_09 | Line: U3 | 6 stops | 9.0 min
U3_09 → U6_11 | Line: transfer | 1 stops | 2.0 min
U6_11 → U6_01 | Line: U6 | 10 stops | 15.0 min

===== Dijkstra =====
Số ga: 19
Thời gian: 43.0 phút

Chi tiết:
U1_01 → U3_03 | Line: transfer | 1 stops | 2.0 min
U3_03 → U3_09 | Line: U3 | 6 stops | 9.0 min
U3_09 → U6_11 | Line: transfer | 1 stops | 2.0 min
U6_11 → U6_01 | Line: U6 | 10 stops | 15.0 min
A* visited: 155
Dijkstra visited: 161
**********************

***U2_01 U2_27***

===== A* =====
Số ga: 27
Thời gian: 39.5 phút

Chi tiết:
U2_01 → U2_27 | Line: U2 | 26 stops | 39.5 min

===== Dijkstra =====
Số ga: 27
Thời gian: 39.5 phút

Chi tiết:
U2_01 → U2_27 | Line: U2 | 26 stops | 39.5 min
A* visited: 114
Dijkstra visited: 126
