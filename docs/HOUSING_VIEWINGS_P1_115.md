# Lịch xem nhà HOLA Housing P1

- Khách đăng nhập tạo một lịch đang mở mỗi tin, tối đa 10 lịch, giờ tròn/nửa giờ 30 phút đến 30 ngày, giờ Việt Nam ở UI và UTC canonical qua API.
- Chỉ tin công khai active chưa hết hạn, do tài khoản USER/CTV nội bộ đăng (không DEMO/import), tài khoản nhận active, phòng chưa FULL. Từ chối tự đặt lịch. Xác nhận lại điều kiện server-side và khóa theo tin.
- GET /api/housing/viewings riêng requester/recipient; PATCH /api/housing/viewings/:id ACCEPT/DECLINE/CANCEL chỉ đúng vai trò và trạng thái; POST /api/housing/:placeId/viewings. Không có phone/email/PII free text. No-store. Mỗi tài khoản giới hạn 10 thao tác/phút.
- Tránh trùng lịch xác nhận cùng nửa giờ của recipient/requester bằng unique index. Tin đóng hoặc hết phòng hủy lịch tương lai. Tin hết hạn không xác nhận thêm; trạng thái quá giờ không chứng minh xem nhà/giao dịch.
- Owner dashboard: đếm yêu cầu 30 ngày và yêu cầu hiện ACCEPTED, không phải lượt xem hay unique leads. Chưa gửi SMS/email, chưa analytics view/reveal, chưa hồ sơ KYC.
- Migration 320 sau 310; backup và migration theo runbook trước reload. CI backend, E2E và Security phải đạt. Không tự deploy.
