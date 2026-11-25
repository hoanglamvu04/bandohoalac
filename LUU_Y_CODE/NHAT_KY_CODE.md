# NHẬT KÝ CODE & BÀN GIAO

**Nguyên tắc append-only:** mục mới thêm trên đầu, **không xóa/sửa mất mục cũ**. Nếu báo cáo trước sai, thêm mục đính chính kèm đường dẫn Git/CI. Không ghi dữ liệu cá nhân, secret, log VPS có token hoặc ảnh người dùng.

## 25/11/2026 — HOLA-DOC-001 — Tạo quy trình “LƯU Ý CODE”

- **Trạng thái tại thời điểm ghi:** đã mở [PR #106](https://github.com/hoanglamvu04/bandohoalac/pull/106) từ nhánh `docs/luu-y-code-workflow-20261125`; đang chờ CI/merge. Sau merge phải kiểm tra lại và cập nhật snapshot.
- **Baseline đã đối chiếu:** `main` `0eeb84c1fba956eaacc2fab75dfdb5d4bdb004af`, Hola Maps CI và Security Scan PASS.
- **Mục tiêu:** chuẩn hóa báo cáo tiến độ, kế hoạch, nhật ký bàn giao và hướng dẫn để nhiều phiên ChatGPT có thể tiếp tục code mà không lặp lại hoặc tuyên bố sai.
- **Dự kiến thay đổi:** `AGENTS.md`, `README.md`, `LUU_Y_CODE/`, GitHub PR template, kiểm tra cập nhật hồ sơ trên PR sửa code.
- **Kiểm thử:** cần xem kết quả CI của PR này; không tự ghi PASS trước khi CI chạy.
- **Production:** không triển khai, không restart PM2, không chạy migration, không thay dữ liệu.
- **Rủi ro:** số liệu tiến độ có thể lỗi thời theo thời gian; ChatGPT mới phải so sánh với GitHub trước khi dùng.
- **Việc tiếp:** merge nếu CI đạt; sau merge cập nhật lại trạng thái và link PR ở báo cáo, nhật ký, kế hoạch.

## 25/11/2026 — HOLA-SPRINT-005-016 — Ghi nhận 7 PR đã hợp nhất

- **Trạng thái tại baseline:** [PR #99–#105](BAO_CAO_TIEN_DO.md) đã merge vào `main`; GitHub CI/Security PASS trên baseline.
- **Phạm vi:** thống kê giá BĐS, tiện ích, tìm theo vùng, dashboard nghiệm thu, SEO chặn tin hết hạn, Data Trust V5, báo tin nghi vấn và cache truy vấn.
- **Chưa thể khẳng định:** đã deploy VPS, kiểm thử dữ liệu production, hoàn tất tất cả Sprint 5–16.
- **Blocker:** nghiệm thu VPS, backup/restore độc lập, mobile thật và phê duyệt X-HUB WA-005 PR #92.
- **Việc tiếp:** theo [KE_HOACH_TIEP_THEO.md](KE_HOACH_TIEP_THEO.md).

## Mẫu cho mỗi phiên tiếp theo

### DD/MM/YYYY HH:mm GMT+7 — HOLA-<ID> — <tên công việc>

- **Người/AI thực hiện:** …
- **Trước khi làm:** branch, commit, vấn đề đã xác nhận: …
- **Mã nguồn:** file/sơ đồ/migration thay đổi và tại sao: …
- **PR / commit:** …
- **Kiểm thử:** câu lệnh, kết quả PASS/FAIL/SKIP, link CI: …
- **Tình trạng sau:** PR đang mở / đã merge / đã deploy / đã nghiệm thu (chỉ ghi điều đã kiểm chứng): …
- **Blocker và bảo mật:** …
- **Bàn giao bước tiếp:** nhiệm vụ nào, đầu vào/đầu ra/điều kiện: …
