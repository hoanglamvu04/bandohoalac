# NHẬT KÝ CODE & BÀN GIAO

**Nguyên tắc append-only:** mục mới thêm trên đầu, **không xóa/sửa mất mục cũ**. Nếu báo cáo trước sai, thêm mục đính chính kèm đường dẫn Git/CI. Không ghi dữ liệu cá nhân, secret, log VPS có token hoặc ảnh người dùng.

## 16:21 25/11/2026 GMT+7 — HOLA-P1-109 — Bằng chứng dữ liệu tiện ích quanh BĐS

- **Baseline:** `main` `9c73385cefbc3694a43da8b4ecb9f0190db7f218`, PR #109/#110 đã merge. [CI](https://github.com/hoanglamvu04/bandohoalac/actions/runs/45563858100) và [Security](https://github.com/hoanglamvu04/bandohoalac/actions/runs/45563858229) PASS; P0-004 đang có PR #108.
- **Nhánh/trạng thái:** [`feat/p1-109-amenity-coverage-20261125`](https://github.com/hoanglamvu04/bandohoalac/compare/main...feat/p1-109-amenity-coverage-20261125), DANG_LAM, chờ CI/merge.
- **Mã:** `housingInsights.service.js` thêm `dataQuality`; `HousingNearbyPlaces.jsx` hiển thị độ mới và giới hạn mẫu; `auditHousingAmenities.js` và `backend/package.json` thêm lệnh tổng hợp chỉ đọc; cập nhật tài liệu Sprint 6/9.
- **Kiểm thử:** `housingInsights.test.js`, `housingAmenitiesAudit.test.js`, `housing-nearby-detail.spec.js` bổ sung ca mẫu giới hạn, phạm vi nhóm, xác minh cũ/thiếu, rỗng và kiểm tra quyền công khai. Chờ CI chạy.
- **Bàn giao:** Đo dữ liệu thật trên bản sao được cấp quyền. Hồ sơ VPS/WA-005 và routing vẫn chờ nghiệm thu riêng.

## 13:50 25/11/2026 GMT+7 — HOLA-P1-104 — Xác nhận merge và bàn giao

- **Kết quả:** [PR #109](https://github.com/hoanglamvu04/bandohoalac/pull/109) đã hợp nhất trên `main`, merge commit `d55f50d5f21d207a2e10d093576018be0ac43f8f`.
- **CI có bằng chứng:** 9/9 checks PASS trên head PR; gồm frontend build/E2E, backend/PostGIS, CodeQL, dependencies, shell, repository safety và tài liệu bàn giao. Không lấy CI làm bằng chứng production.
- **Tính năng:** BĐS chi tiết tra cứu tiện ích trong 500 m / 1 km / 2 km, kết quả phân nhóm, link POI, trạng thái lỗi/retry, giới hạn mẫu minh bạch.
- **Production:** CHƯA XÁC MINH DEPLOY. Không thay đổi migration, PM2, Nginx hoặc WA-005.
- **Bàn giao:** HOLA-P1-109 độ phủ POI và routing, HOLA-P0-002 kiểm thử thiết bị/VPS, HOLA-P0-004 đang có PR #108 riêng. Không gọi Sprint 9 đã hoàn thành toàn bộ.

## 25/11/2026 GMT+7 — HOLA-P1-104 — Tiện ích công khai trên trang chi tiết BĐS

- **Người thực hiện:** ChatGPT coding agent.
- **Trước:** `main` `b5bc158daf3396705e33af7f4cf13e8bd81664fa`, CI/Security PASS. PR #108 đang thực hiện P0-004 về launch audit, không thay đổi phần đó.
- **Nhánh/trạng thái:** `feat/p1-104-housing-amenities-detail-20261125`, [PR #109](https://github.com/hoanglamvu04/bandohoalac/pull/109), ĐANG LÀM, chờ CI/merge.
- **Mã nguồn:** thêm component `HousingNearbyPlaces.jsx`, CSS `housing-nearby-detail.css`, gắn vào `PlaceDetailV2.jsx`. Dùng API public đã có; không tạo dữ liệu mới.
- **Kiểm thử:** thêm Playwright `housing-nearby-detail.spec.js` cho guest/mobile, thay bán kính, lỗi retry, giới hạn mẫu và không hiện ở POI thường. Cần chờ CI xác minh; chưa xác nhận PASS.
- **Quyền riêng tư:** truy vấn thủ công theo ID tin BĐS + bán kính; không gửi GPS cá nhân, số điện thoại hoặc token mới.
- **Production:** chưa deploy; không đụng PostgreSQL, Nginx, PM2 hoặc WA-005 PR #92.
- **Bàn giao:** sau CI kiểm tra, merge nếu PASS; cập nhật trạng thái theo SHA thực tế. Tiếp tục độ phủ tiện ích, routing chuẩn và nghiệm thu mobile/VPS (HOLA-P1-104, HOLA-P0-002).

## 09:32 25/11/2026 GMT+7 — HOLA-DOC-001 — Xác nhận bộ LƯU Ý CODE đã hợp nhất

- **Đã merge:** [PR #106](https://github.com/hoanglamvu04/bandohoalac/pull/106) vào `main` tại SHA `7eb2078c938fbb7c291ae5ea5c2866db5d36c5fe`.
- **Kiểm thử có bằng chứng:** 9 kiểm tra PR #106 đều **PASS**, gồm LUU_Y_CODE handoff policy, Repository Safety, frontend build, frontend E2E, backend/PostGIS, dependency audit, shell security, CodeQL JavaScript và CodeQL.
- **Nội dung:** thư mục `LUU_Y_CODE/` 5 file; root `AGENTS.md`, README link, PR template, script và CI job kiểm tra cập nhật báo cáo/kế hoạch/nhật ký.
- **Production:** không deploy VPS; không tạo/sửa schema hay dữ liệu.
- **Bước tiếp:** áp dụng quy tắc cho mọi PR mã nguồn mới; đảm bảo kế hoạch và báo cáo không để trạng thái PR mở sau khi đã merge.

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
