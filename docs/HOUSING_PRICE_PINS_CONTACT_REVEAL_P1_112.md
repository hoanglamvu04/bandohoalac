# HOLA-P1-112 — Ghim giá BĐS & liên hệ sau đăng nhập

**Ngày:** 26/11/2026 (GMT+7). **Mục tiêu:** HOLA HOUSING có bản đồ giá và liên hệ kiểu marketplace nhưng không lộ số điện thoại qua API public.

## Hành vi

- Ở `/map?vertical=housing`, ghim BĐS có giá hợp lệ đổi từ biểu tượng pin thành **nhãn giá**. Thuê: `2,9 tr/th`; bán: `3,85 tỷ`. Giá thiếu vẫn dùng biểu tượng pin, không dựng số.
- Các điểm sát nhau vẫn được MapLibre gom cụm; nhãn giá chỉ hiện ở mức zoom thích hợp, không xây hàng trăm DOM marker. Nhãn màu xanh cho thuê, xanh đậm cho bán; chạm vào giá chọn đúng BĐS.
- Thẻ popup trên bản đồ và trang chi tiết có **người đăng/người cho thuê**, nút **Hiện số điện thoại** cho tài khoản đăng nhập. Khách chưa đăng nhập có liên kết đến trang đăng nhập. Nút chỉ gửi request sau click; không auto-reveal.
- Backend không gửi `phone` và `contactZalo` trong JSON public cho BĐS (kể cả place generic, housing list/detail). Các loại địa điểm khác vẫn hiển thị thông tin như cũ.
- `GET /api/housing/:placeId/contact`: phải có Bearer token còn phiên đang hoạt động; giới hạn 12 lượt/phút/tài khoản; kiểm tra `PUBLISHED` + category `bat-dong-san` + listing `ACTIVE` và `expires_at` còn hợp lệ. Trả `Cache-Control: private, no-store`, không đưa số vào URL, log hoặc analytics.
- Fixture `HOLA_THACH_THAT_DEMO_2026`: vẫn cho xem công khai giá DEMO, nhưng endpoint liên hệ trả `phone=null, zalo=null`, UI ghi rõ `DEMO — không có số liên hệ thật`.
- Khi đổi tin, đăng xuất hoặc đổi tài khoản: hủy request đang chạy, xóa số cũ khỏi UI, không lưu localStorage.
- **Không tuyên bố đã xác minh danh tính chủ nhà.** `contactName` là trường do người đăng nhập; không có hồ sơ xác minh cá nhân/tư cách chủ sở hữu trong PR này.

## Nghiệm thu

1. Build frontend; Playwright kiểm tra nhãn giá và trạng thái login/reveal ở mobile/desktop, click giá chọn đúng tin.
2. Backend unit xác nhận API 401 cho khách, không lộ số qua public, không trả liên hệ của tin PENDING/EXPIRED, giới hạn số lượt và xử lý contact DEMO.
3. PG16/PostGIS, CI/Security/CodeQL PASS; chưa xem CI như bằng chứng deployment.
4. Trên VPS sau khi merge, chủ vận hành kéo `main`, build frontend và reload **đúng tiến trình HOLA Maps API**. Kiểm tra Network: JSON `/api/places/*` và `/api/housing` không chứa số thật, `/contact` phải 401 nếu ẩn danh, trả số chỉ khi người dùng click sau đăng nhập.
5. Giữ consent tracking, không phát sinh event chứa số, địa chỉ cá nhân, người dùng hoặc token.

## Backlog sau P1-112

- Xác minh chủ nhà/môi giới với vai trò được duyệt, thay vì tự ghi nhãn xác minh.
- Lịch hẹn xem nhà và hộp thư trao đổi nội bộ; giảm nhu cầu xuất bản số liên hệ.
- Chi phí vào ở (cọc + tháng đầu + điện nước + phí gửi xe), không lấy giá DEMO làm thống kê thị trường.
- Độ mới tình trạng phòng/giá, xác nhận sau 7/30 ngày, cảnh báo tin hết hạn.
- Đo thời gian di chuyển thực khi có nguồn routing được nghiệm thu; hiện khoảng cách tới FPT là đường chim bay.
