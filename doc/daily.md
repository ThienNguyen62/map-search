## Quy trình Code hàng ngày cho team:

### Bước 1: Lấy code mới nhất về máy 
```bash
git checkout main
git pull origin main
```

### Bước 2: Tạo nhánh mới để làm task của mình (Ví dụ bạn làm chức năng đăng nhập)
```bash
git checkout -b feature/<tên tính năng>
```
vd : git checkout -b feature/login


### Bước 3: Code xong, lưu code lại
```bash
git add .
git commit -m "mô tả rõ ràng nội dung thanh đổi" 
```

### Bước 4: Đẩy code của em lên GitHub (ví dụ e tạo branch feature/login)
```bash
git push origin feature/<tên tính năng>
```
vd: git push origin feature/<login>


### Bước 5: Tạo Pull Request (PR)

Lên web GitHub, sẽ thấy nút màu xanh "Compare & pull request". 
Bấm vào đó, viết vài dòng mô tả em đã làm gì. 


## ⁉️ Sau đó tuyệt đối không tự ấn nút Merge!
## nhớ bảo tester vào test nhé, ổn thì tester sẽ merge