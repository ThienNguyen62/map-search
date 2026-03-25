# 📘 QUY ĐỊNH LÀM VIỆC NHÓM & GIT WORKFLOW

🔗 **Repository:**  
https://github.com/ThienNguyen62/map-search.git  

---

## 0. Cấu hình Git (Chỉ cần làm 1 lần)

Thiết lập thông tin để Git nhận diện bạn trong mỗi commit:

```bash
git config --global user.name "ThienNguyen62"
git config --global user.email "your_email@gmail.com"
git config --list
```
Chỉ cần thiết lập 1 lần duy nhất
Nếu đã cấu hình trước đó thì không cần làm lại
Email nên trùng với email GitHub
## 1 clone về máy
```bash
git clone https://github.com/ThienNguyen62/map-search.git
cd map-search
```
## 2 quy trình dùng git bắt buộc
1. **Tuyệt đối KHÔNG push thẳng lên nhánh `main`.** Nhánh `main` chỉ chứa code hoàn chỉnh, chạy không lỗi.
2. Khi bắt đầu làm 1 tính năng mới (Ví dụ: Làm màn hình Login):
   * Từ nhánh `main`, tạo nhánh mới: `git checkout -b feature/login`
   * Code và commit trên nhánh này: `git commit -m "Thiết kế UI Login"`
   * Đẩy nhánh lên Github: `git push origin feature/login`
   * Tạo **Pull Request (PR)** trên GitHub. Báo cho Leader hoặc tester review.
## 3 Yêu cầu về tài liệu tải lên
1. **clean code**
2. **chú thích rõ ràng trước mỗi function**
## 4. Quy tắc đặt tên nhánh (Naming Convention)
*   **các em đặt tên nhánh theo cấu trúc:** <loại-nhánh>/<tên-công-việc>
*   **VÍ DỤ:** 
*    Tạo tính năng mới: feature/login, feature/them-khoan-thu, feature/tao-database
*    Sửa lỗi bug: bugfix/loi-tinh-tien, bugfix/sai-giao-dien
*   **(Lưu ý: Tên nhánh viết thường, không dấu, cách nhau bằng dấu gạch ngang).**
## 5 một số lệnh git quan trọng

* kiểm tra trạng thái và lịch sử 
git status
git log
git diff
* ghi nhận sự thay đổi
git add <file>
git add .
git commit -m "message"
* làm việc với nhánh 
git branch
git branch <ten-branch>
git checkout <ten-branch>
git checkout -b <ten-branch>