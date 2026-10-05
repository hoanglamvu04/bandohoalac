# Hola Maps Data Trust & Moderation v2

## 1. Chống spam / gian lận đóng góp

Mỗi đóng góp được gắn `risk_score` 0–100 và danh sách `risk_flags`.

Các tín hiệu hiện dùng gồm:

- nội dung trùng chính xác với đóng góp gần đây của cùng tài khoản;
- gửi dồn nhiều đóng góp trong 10 phút / 1 giờ;
- quá nhiều đóng góp đang chờ duyệt;
- tài khoản mới;
- tỷ lệ đóng góp bị từ chối cao;
- nhiều tài khoản cùng gửi nội dung giống nhau;
- loại đóng góp có ảnh hưởng lớn như đóng cửa / sửa vị trí / tình trạng đường;
- tạo địa điểm mới nhưng thiếu ảnh minh chứng.

Đóng góp lặp chính xác hoặc spam theo giờ có thể bị chặn trước khi vào hàng chờ. Các trường hợp còn lại vẫn vào moderation queue nhưng được xếp theo rủi ro cao trước.

## 2. CTV cấp 1 / cấp 2

Role hệ thống mới: `CTV`.

- **CTV cấp 1**: duyệt đóng góp rủi ro thấp; không duyệt đóng góp risk >= 50 hoặc loại có ảnh hưởng lớn.
- **CTV cấp 2**: duyệt mọi đóng góp, sửa địa điểm, ảnh, xác minh chất lượng và duyệt từng bản ghi import.
- **MODERATOR**: quyền dữ liệu rộng hơn, gồm rollback và map editor.
- **ADMIN**: toàn quyền hệ thống.

Trust CTV được tính từ audit của Admin:

- xác nhận quyết định đúng: +2 trust;
- quyết định bị đánh dấu chưa đúng: -10 trust;
- base trust: 60;
- tự lên cấp 2 khi có ít nhất 20 lượt duyệt, ít nhất 10 quyết định được Admin xác nhận và trust >= 80.

Admin vẫn có thể chỉnh tay cấp / trust trong trang quản lý CTV.

## 3. Lịch sử địa điểm và rollback

Mỗi thay đổi quan trọng tạo một `place_revision` với snapshot trước/sau, người thao tác, thời gian và nguồn contribution nếu có.

Ghi lịch sử cho:

- tạo địa điểm;
- sửa dữ liệu;
- archive;
- xác minh dữ liệu;
- thêm / đổi cover / xóa ảnh;
- áp dụng contribution;
- rollback.

Rollback khôi phục metadata, category, trạng thái và tọa độ. Rollback file ảnh đã xóa không được hỗ trợ vì file gốc có thể không còn trong storage.

## 4. Dashboard chất lượng dữ liệu

`Admin → Data Trust` theo dõi:

- địa điểm thiếu ảnh;
- thiếu giờ mở cửa;
- thiếu địa chỉ / mô tả / danh mục / liên hệ;
- địa điểm quá lâu chưa xác minh;
- ảnh quá cũ;
- quality score 0–100;
- đóng góp có risk cao;
- trust CTV và quyết định cần audit;
- lịch sử revision + rollback.

Ngưỡng mặc định:

- địa điểm stale: 180 ngày;
- ảnh stale: 365 ngày.
