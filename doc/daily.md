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

### Bước 4: Đẩy code của bạn lên GitHub (ví dụ e tạo branch feature/login)
```bash
git push origin feature/<tên tính năng>
```
vd: git push origin feature/<login>


### Bước 5: Tạo Pull Request (PR)

Lên web GitHub, sẽ thấy nút màu xanh "Compare & pull request". 
Bấm vào đó, viết vài dòng mô tả em đã làm gì. 


## ⁉️ Sau đó tuyệt đối không tự ấn nút Merge!
## nhớ bảo tester vào test nhé, ổn thì tester sẽ merge

### Bước 6: sử dụng tính năng project của github
kéo thả task của mình từ **in process** lên **in review** rồi bảo tester check. tester check xong sẽ để sang done, nếu có lỗi tester sẽ yêu cầu dev sửa lại. bạn kéo thả lại từ **in review** sang **in process**


### Đối với tester hoặc các bạn muốn clone code từ branch về kiểm tra
Kiểm tra list branch
```bash
git branch -a
```
clone code ở branch
```bash
git clone -b <branch_name> <repo_url>
```
