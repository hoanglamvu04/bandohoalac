# HOLA Maps — BẮT BUỘC CHO MỌI CODING AGENT / CHATGPT

**Trước bất kỳ tác vụ code nào:** mở `LUU_Y_CODE/README.md`, `LUU_Y_CODE/BAO_CAO_TIEN_DO.md`, `LUU_Y_CODE/KE_HOACH_TIEP_THEO.md`, `LUU_Y_CODE/NHAT_KY_CODE.md` và `LUU_Y_CODE/QUY_TAC_CHATGPT.md`. Đây là sổ giao ca chính thức của repository. Nếu tài liệu cũ hơn Git, xác minh Git/CI và cập nhật lại tài liệu.

## Luật bắt buộc

1. Xác minh SHA nhánh `main`, PR mở/đã merge, trạng thái workflow, migration và code trước khi nói dự án đã có/chưa có tính năng.
2. Nhận nhiệm vụ bằng **ID HOLA-P0/P1/P2** trong kế hoạch; hạng mục mới phải thêm ID, phạm vi, phụ thuộc và tiêu chí nghiệm thu.
3. **Mọi PR sửa code** (`backend/`, `frontend/`, `scripts/`, `.github/workflows/`, package) **phải thay đổi cùng lúc ba file**:
   - `LUU_Y_CODE/BAO_CAO_TIEN_DO.md`
   - `LUU_Y_CODE/KE_HOACH_TIEP_THEO.md`
   - `LUU_Y_CODE/NHAT_KY_CODE.md`
   Ghi chính xác trạng thái **PR đang mở** nếu chưa merge; sau merge cập nhật snapshot/commit trong một thay đổi tài liệu tiếp theo. CI kiểm tra tên file được cập nhật trên PR không phải Dependabot.
4. Ghi ngày giờ GMT+7, task, đường dẫn PR/commit, file được đổi, tests PASS/FAIL/SKIP thực sự, blocker và bước tiếp theo. Nhật ký chỉ được nối thêm, không xóa lịch sử.
5. Không ghi `DONE/FULL/PRODUCTION` nếu chưa có bằng chứng đúng cấp độ: mã merge, đã deploy, nghiệm thu VPS là **ba việc khác nhau**.
6. Giữ an toàn: approval trước khi public tin đóng góp/BĐS; RBAC/2FA; consent cho analytics; không lộ PII/GPS/token, thông tin khách hàng, secrets hay dumps. X-HUB WA-005 cần nghiệm thu riêng.
7. Không tự deploy VPS/PM2/Nginx, chạy production seed, xóa dữ liệu hay đổi backup khi chưa có phê duyệt và phương án an toàn.
8. Ưu tiên PR nhỏ, bảo toàn chức năng cũ; kiểm thử PG16/PostGIS + frontend/build/E2E/security tương ứng. CI lỗi phải sửa rồi ghi lại kết quả.

**Điểm kiểm tra đầu tiên:** `LUU_Y_CODE/README.md`. **Hợp đồng triển khai production:** `docs/PUBLIC_LAUNCH_P0_RUNBOOK.md`. **Chi tiết giao ca:** `LUU_Y_CODE/QUY_TAC_CHATGPT.md`.
