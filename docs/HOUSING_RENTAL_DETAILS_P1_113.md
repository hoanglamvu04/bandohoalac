# HOLA Housing P1: chi phí thuê và vai trò người đăng

- Tin RENT mới có thể nhập cọc, điện/kWh, nước/người/tháng, gửi xe/xe/tháng và số phòng/căn còn trống; để trống khác 0. Tin SALE từ chối các trường thuê. Moderation trước public vẫn bắt buộc.
- advertiser_role là tự khai OWNER/BROKER/MANAGER/OTHER, không chứng minh sở hữu, không thêm PII.
- Trang chi tiết RENT tính chi phí tháng và tháng đầu gồm cọc từ đơn giá tin; phần thiếu được ghi rõ. Calculator chỉ chạy client, không gửi mức dùng lên server. Không bao gồm phí chưa được cung cấp.
- Migration 310 additive; cần backup và chạy migration theo runbook trước reload backend. Chưa deploy, chưa xác nhận CI.
