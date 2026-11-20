# HOLA Maps — Tin bất động sản còn hiệu lực và báo cáo cộng đồng

## Người xem bất động sản

Trên trang chi tiết bất động sản, người dùng đã đăng nhập có thể chọn
**Báo tin không còn hiệu lực** (đã bán, đã cho thuê, hoặc nội dung không còn
chính xác). Người báo cần mô tả lý do; không có thao tác ẩn tự động.

Yêu cầu gửi dạng `REPORT_CLOSED`, trạng thái PENDING. Chỉ ADMIN/MODERATOR
có quyền duyệt báo cáo gắn với bất động sản. Người không có quyền không được
xem nội dung kiểm duyệt liên quan đến bất động sản qua API Admin.

Sau khi người có thẩm quyền duyệt, hệ thống đặt
`housing_listings.listing_status='PAUSED'` và
`places.status='ARCHIVED'` trong một transaction.
Như vậy tin biến mất khỏi **mọi** lớp bản đồ, không chỉ Housing API.
Nếu người báo khác chủ tin, chủ tin sẽ nhận thông báo trong ứng dụng về
việc tạm ẩn, kèm hướng dẫn liên hệ quản trị khi có sai sót.

## Người đăng bất động sản

Tin đã duyệt phải được xác nhận lại trong vòng 30 ngày. Màn hình
`/tin-bat-dong-san-cua-toi` cho phép xác nhận lại tin còn hoạt động,
tạm ẩn, đánh dấu đã bán hoặc đã cho thuê, hoặc gửi yêu cầu cập nhật giá
chờ Admin duyệt.

Tác vụ hàng ngày `npm run housing:remind` tạo thông báo tại hai ngưỡng:
- **Trong 7 ngày** trước hạn: nhắc xác nhận lần đầu.
- **Trong 24 giờ** trước hạn: cảnh báo lần cuối.

Mỗi thông báo có key `placeId + expiryEpoch + reminderKey`; unique index
trong PostgreSQL đảm bảo chạy lại cron không gửi trùng. Nếu chủ tin gia hạn,
thời điểm hết hạn thay đổi và có thể tạo nhắc mới ở chu kỳ kế tiếp.

Hết hạn: `npm run housing:expire` tự chuyển tin sang EXPIRED và archive
địa điểm. Các tin cũ không có `expires_at` không được tự động gán hạn,
phải rà soát nguồn dữ liệu thủ công.

## Các bước VPS sau khi deploy

1. Chạy migration `20261120_260_housing_expiry_notifications.sql`.
2. Cài lại lịch từ `scripts/install-p0-jobs.sh`; tác vụ nhắc chủ tin chạy
   **09:12** hằng ngày, sau tác vụ hết hạn **04:05**.
3. Kiểm tra P0 readiness bằng `scripts/check-p0-readiness.sh`,
   bao gồm sao lưu, offsite, cron, API và dữ liệu.
4. Kiểm thử một tin thật ở trạng thái PENDING, duyệt báo không còn,
   kiểm tra pin biến mất, chủ tin nhận thông báo, đồng thời test
   không thể gửi báo cáo khi chưa đăng nhập.

CI PASS không đồng nghĩa cron VPS đã được cài hoặc email/SMS được gửi.
Thông báo hiện chỉ có trong ứng dụng, không tự động gửi qua SMS/email.
