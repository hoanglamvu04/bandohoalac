# HOLA Maps — Soft Launch V2

## Kiểm tra tải đồng thời trên PostGIS local

Bài kiểm tra gửi một đợt 32 yêu cầu đọc cùng vùng nhìn bản đồ. Nó tự mở
ứng dụng trên cổng ngẫu nhiên của `127.0.0.1`, không nhận URL API từ bên
ngoài và không theo redirect. Bài thử qua HTTP yêu cầu `NODE_ENV=test`
và PostgreSQL qua loopback. Dùng cơ sở dữ liệu test riêng do bạn quản lý.

Sau khi cài gói backend và migrate/seed cơ sở dữ liệu test, chạy từ
thư mục gốc với `NODE_ENV=test` và `DATABASE_URL` đã thiết lập:

```bash
node --test backend/tests/placeBoundsConcurrency.test.js
```

CI chạy bài kiểm tra trong job Backend migrate and test. Các bài kiểm
tra thẳng vào service xác nhận đợt truy cập lạnh chỉ sinh hai truy vấn
PostgreSQL (danh sách và tổng số), lỗi truy vấn cho phép thử lại và dữ
liệu cũ đang được đọc không thể điền lại cache sau khi cache bị xóa.
Bài HTTP kiểm tra 32 phản hồi 200 với dữ liệu nhất quán và in p95 của
đợt thử để tham khảo. Kết quả loopback chưa đo được dung lượng VPS hay
trải nghiệm mạng di động thật.

Mỗi tiến trình API dùng chung truy vấn đang chạy cho cùng một khóa cache.
Kết quả trả từ bộ nhớ đệm hoặc từ truy vấn đang chạy đều báo `X-Hola-Cache: HIT`.
Yêu cầu khởi tạo truy vấn báo `MISS`. Lợi ích phụ thuộc vào tỷ lệ trùng
khóa, số tiến trình API và thời gian xử lý PostgreSQL.

## Kiểm tra trước khi mở rộng Soft Launch

Xác minh lịch retention 02:45 và backup/restore ngoài VPS theo tài liệu
V1. Thử gửi phản hồi khách và xử lý bằng Admin 2FA trên môi trường kiểm
thử. Xác nhận bản đồ hoạt động trên Android/iOS có SIM thật và chờ đủ
mẫu hiệu năng trước khi đánh giá kết quả theo thiết bị và loại mạng.
