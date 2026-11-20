# HOLA Maps — Soft Launch V1

## Gửi lỗi từ web

Ở `/gop-y`, khách không cần đăng nhập để gửi loại phản hồi BUG, DATA, UX
hoặc SUGGESTION; chọn phần MAP, PLACE, HOUSING, SEARCH, ACCOUNT hay OTHER
và nhập mô tả 20–1200 ký tự. Không có ảnh, vị trí GPS hay URL chi tiết
được tự đính kèm. Người dùng được nhắc không ghi mật khẩu, số điện thoại
hoặc dữ liệu cá nhân trong phần mô tả.

Phản hồi được lưu bí mật trạng thái NEW với mã tham chiếu UUID; không có
API công khai đọc/xem phản hồi. Giới hạn 6 lần gửi trong mỗi giờ cho từng
địa chỉ nguồn ở bộ nhớ rate-limiter; IP không đưa vào database.

## Kiểm duyệt và hiệu năng

Chỉ ADMIN đã xác thực 2FA được dùng `/admin/soft-launch` hoặc các API:
- GET `/api/admin/soft-launch/feedback` (lọc, phân trang)
- PATCH `/api/admin/soft-launch/feedback/:id`
- GET `/api/admin/soft-launch/vitals`

Phản hồi có các trạng thái NEW, IN_REVIEW, RESOLVED, DISMISSED; ghi chú nội
bộ dành cho Admin. Người khác không xem được và phản hồi không tự sửa bản đồ.

Ở production, PerformanceObserver gửi các số đo gần đúng:
- LCP: thời gian phần tử nội dung lớn nhất;
- CLS: điểm dịch chuyển bố cục theo phiên tối đa;
- INP: xấp xỉ từ event timing, không phải CrUX chính thức;
- MAP_READY: MapLibre tải xong style đầu tiên, không phải đã tải toàn bộ tile.

Chỉ gửi metric, nhóm trang, MOBILE/DESKTOP, loại kết nối do trình duyệt báo
(slow-2g/2g/3g/4g/unknown) và giá trị đo. Server lưu tổng số mẫu theo giờ,
mức Good / Needs improvement / Poor, không lưu sự kiện người dùng, IP,
ID, URL, cookie, tọa độ hay user-agent. Giá trị 4g theo trình duyệt
không chứng minh đang sử dụng kết nối 4G thực tế.

Ngưỡng Good / Cần cải thiện:
- LCP <= 2500ms / <= 4000ms
- INP <= 200ms / <= 500ms
- CLS <= 0.1 / <= 0.25
- MAP_READY <= 3500ms / <= 6000ms (ngưỡng riêng của dự án)

Trang Quyền riêng tư cho phép tắt thống kê; collector cũng tôn trọng
Do Not Track và Global Privacy Control của trình duyệt.

## Lưu trữ và khởi chạy

Tác vụ `npm run soft-launch:prune` xóa phản hồi trên 180 ngày và
bucket tổng hợp hiệu năng trên 35 ngày. `scripts/install-p0-jobs.sh`
thêm cron chạy dọn dữ liệu lúc 02:45 hằng ngày. **Deploy GitHub không
đồng nghĩa lịch cron trên VPS đã được cài hoặc đang hoạt động**.

Trước khi mời người dùng: migrate PostgreSQL, build frontend, restart
bandohoalac-api, thử gửi phản hồi khách, duyệt bằng Admin 2FA,
xác nhận CTV bị chặn, cài cron retention, xác minh backup và restore
độc lập, kiểm tra trên Android/iOS thực. Dashboard hiệu năng sau deploy
cần mẫu từ traffic production; CI không đo mạng 4G thật.

Đối với hiệu năng mạng 4G: phải đo riêng trên điện thoại với SIM thực
và DevTools throttling. LCP/INP/CLS chỉ là số liệu quan sát tại trình
duyệt có hỗ trợ; không được suy rộng khi mẫu ít.
