# Bảng chú giải `metro_stops.json`

`metro_stops.json` là danh sách các điểm dừng/ga theo chuẩn GTFS đã được lọc cho mạng metro. Mỗi phần tử trong mảng là một stop.

| Trường dữ liệu | Kiểu giá trị | Ý nghĩa | Ghi chú |
|---|---|---|---|
| `stop_id` | chuỗi | Mã định danh duy nhất của stop | Dùng để liên kết với `stop_times` và các file GTFS khác |
| `stop_code` | chuỗi | Mã ngắn của stop | Trong dữ liệu hiện tại thường để trống |
| `stop_name` | chuỗi | Tên hiển thị của stop/ga | Có thể là tên ga chính hoặc tên platform cụ thể |
| `stop_lat` | chuỗi số | Vĩ độ | Lưu dưới dạng chuỗi trong JSON nguồn |
| `stop_lon` | chuỗi số | Kinh độ | Lưu dưới dạng chuỗi trong JSON nguồn |
| `stop_url` | chuỗi URL | Link thông tin chi tiết của stop | Thường trỏ tới trang EFA/MVV |
| `location_type` | chuỗi | Loại địa điểm GTFS | Trong file này đa số là `0` |
| `parent_station` | chuỗi | Mã ga cha của stop | Dùng để gom các platform/child stop về một ga chính |
| `platform_code` | chuỗi | Mã platform hoặc hướng tuyến | Có thể mô tả tên sân ga, tuyến, hoặc hướng đi |

## Ý nghĩa của `location_type`

| Giá trị | Ý nghĩa |
|---|---|
| `0` | Stop/platform thông thường |
| `1` | Station chính |
| `2` | Entrance/exit |
| `3` | Generic node |
| `4` | Boarding area |

## Cách đọc nhanh

- Nếu `parent_station` có giá trị, stop đó là một phần của ga lớn hơn.
- Nếu `platform_code` có nội dung, đó thường là sân ga hoặc hướng tuyến cụ thể.
- Nếu `stop_code` trống, dữ liệu nguồn không cung cấp mã ngắn cho stop đó.