# HOLA-P0-004 / Issue #115 — an toàn khi kiểm toán BĐS + POI

**Trạng thái 26/11/2026:** Chưa có ảnh kết quả kiểm toán trên dữ liệu thật. Bản sao độc lập và tài khoản **chỉ đọc** cần do người vận hành cung cấp. GitHub CI không kết nối DB production.

Runbook chính: `docs/PUBLIC_LAUNCH_P0_RUNBOOK.md` mục **Kiểm toán tiện ích và BĐS trên bản sao PostgreSQL**.

Trước khi chạy, người vận hành:
1. Xác minh host/DB là **bản sao** (snapshot riêng), KHÔNG phải DB mà website hiện đang sử dụng; không gửi URL hoặc mật khẩu cho người khác.
2. Tạo tài khoản chỉ SELECT; không SUPERUSER, CREATEDB, CREATEROLE, CREATE trong DB/public schema, hoặc INSERT/UPDATE/DELETE/TRUNCATE trên places/categories/housing_listings/place_images.
3. Nhập cụm xác nhận `BAN_SAO_DOC_LAP_CHI_DOC` trong terminal. Đây chỉ là xác nhận thủ công, **không chứng minh DB thực sự tách biệt**.
4. Lệnh bắt đầu `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`, giới hạn mỗi câu SQL 30 giây, kiểm tra quyền và trạng thái giao dịch trước mọi báo cáo. Nếu bất kỳ điều kiện nào không đạt: fail closed, không đọc dữ liệu để tính số liệu.
5. Chỉ chụp hai bảng tổng hợp **KIỂM TOÁN BĐS** và **TIỆN ÍCH TRONG 1 KM**; loại trừ URL, thông tin xác thực, khách hàng, tọa độ cá nhân.
6. Phân loại khu/nhóm có 0 tin là **không đủ mẫu**, không khẳng định không có tiện ích. Có ít nhóm được ghi nhận cũng không chứng minh độ phủ hoàn chỉnh.

Kiểm thử unit của preflight dùng client giả, không kết nối PostgreSQL thật và không thực hiện cập nhật DB. Nghiệm thu P0-004/#115 chỉ hoàn thành sau khi có hai bảng tổng hợp trên bản sao được cấp quyền, người kiểm duyệt rà nguồn dữ liệu và ghi nhận rủi ro trong `LUU_Y_CODE`.
