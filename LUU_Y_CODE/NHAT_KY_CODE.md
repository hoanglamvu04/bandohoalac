# NHẬT KÝ CODE & BÀN GIAO

**Nguyên tắc append-only:** mục mới thêm trên đầu, **không xóa/sửa mất mục cũ**. Nếu báo cáo trước sai, thêm mục đính chính kèm đường dẫn Git/CI. Không ghi dữ liệu cá nhân, secret, log VPS có token hoặc ảnh người dùng.

## 26/11/2026 GMT+7 — HOLA-P0-004 / HOLA-P1-102 — preflight bản sao và marker clustering

- **Trước:** main `de134e4c94bcad7bf91284d383cc7e5c67933f89`, nhánh bảo mật #119 đã sửa cron và đang chờ CI; hai đợt này được xếp trên cùng nhánh `feat/p0-004-p1-102-audit-cluster-20261126`.
- **Code:** `backend/src/scripts/auditCopyPreflight.js`, `backend/tests/auditCopyPreflight.test.js`, runbook kiểm toán, `MapView.jsx` gom ghim WebGL, Playwright ghim dày và docs nghiệm thu mobile.
- **Nghiệm thu mã nguồn:** chờ CI backend/PostGIS, Playwright, CodeQL, dependency và handoff. Không viết PASS trước khi có chứng cứ.
- **Dữ liệu thật:** chưa chạy trên PostgreSQL copy; sẽ yêu cầu xác nhận bằng bản sao và tài khoản chỉ đọc, không gửi kết nối ra Git.
- **Mobile thật:** chưa đo P50/P95/hardware, phải làm ở Android/iOS và mạng chậm.
- **Bàn giao:** hoàn tất kiểm thử và merge sau #119; giữ issue #115, #117 mở cho các gate vận hành chưa có bằng chứng.

## 26/11/2026 GMT+7 — HOLA-P0-005 — sửa fail-closed backup cron và tài liệu bảo vệ main

- **Trước:** main `de134e4c94bcad7bf91284d383cc7e5c67933f89` CI/Security PASS, `main` chưa protected.
- **Nhánh:** `fix/p0-005-cron-fail-closed-20261126`, PR/CI đang thực hiện.
- **Mã:** `scripts/install-backup-cron.sh` (cron thiếu hoặc không lưu lịch = FAIL), `backend/tests/backupCronInstaller.test.js`, `docs/SECURITY_UPLOAD_CRON_REVIEW_P0_005.md` và `docs/MAIN_BRANCH_PROTECTION_OPERATOR.md`.
- **Kiểm thử:** bổ sung test fake crontab, mất cron, idempotency; chờ CI thực tế. Không thao tác cron VPS thật.
- **Phụ thuộc:** GitHub admin bật bảo vệ `main` (issue #118); PR #54/#57 review tiếp; restore drill/offsite chưa nghiệm thu.
- **Bàn giao:** sau khi CI xanh mới merge; tiếp tục báo cáo #115 từ bản sao PostgreSQL và kiểm thử mobile #117.

## 16:57 25/11/2026 GMT+7 — HOLA-P1-102 / P0-004 / P1-109 — Xác nhận merge và lệnh kiểm toán

- **Smart Map V4:** [PR #113](https://github.com/hoanglamvu04/bandohoalac/pull/113) đã merge tại `c02640c9ec5399c003f3e1a7fd9115921e5a25d5`; 9/9 checks PASS, 231 bài backend và 64 bài Playwright đều PASS. [CI](https://github.com/hoanglamvu04/bandohoalac/actions/runs/45589817673) và [Security](https://github.com/hoanglamvu04/bandohoalac/actions/runs/45589817721).
- **Kiểm toán bản sao:** Runbook có một khối lệnh chạy cả hai báo cáo trong cùng giao dịch PostgreSQL chỉ đọc. Thực thi trên dữ liệu thật chờ chủ dự án chạy trên bản sao riêng và gửi ảnh kết quả tổng hợp.
- **Triển khai và việc tiếp:** Chưa triển khai VPS. Phân loại khu thiếu POI và vấn đề BĐS sau khi nhận kết quả; đo P95 và cụm ghim trên thiết bị thật.

## 16:54 25/11/2026 GMT+7 — HOLA-P0-004 / P1-109 / P1-102 — Bàn giao kiểm toán và Smart Map

- **P0-004:** [PR #108](https://github.com/hoanglamvu04/bandohoalac/pull/108) đã hợp nhất tại `2e58863e79280a1393f8854c9a72a39170c4d065`, 9/9 checks PASS trên head đã đồng bộ. [CI](https://github.com/hoanglamvu04/bandohoalac/actions/runs/45589166739) và [Security](https://github.com/hoanglamvu04/bandohoalac/actions/runs/45589166792).
- **Kiểm toán POI/BĐS:** Chưa chạy. VPS từ chối xác thực SSH; cần phiên xác thực và bản sao chỉ đọc đã được xác nhận. Không có kết quả production.
- **P1-102:** [Nhánh Smart Map V4](https://github.com/hoanglamvu04/bandohoalac/compare/main...feat/p1-102-smart-map-mobile-20261125) cập nhật `MapPage.jsx`, CSS mobile và `smart-map-v4.spec.js`. Sửa việc hủy lặp truy vấn do kéo bản đồ và giữ nút xem kết quả trong bộ lọc mobile. Chờ CI/merge.
- **Việc tiếp:** Chạy báo cáo tổng hợp trên bản sao được phép và đo bản đồ trên thiết bị thật. Chưa triển khai VPS.

## 16:49 25/11/2026 GMT+7 — HOLA-P0-004 — Đồng bộ PR kiểm toán dữ liệu công khai

- **Trước:** `main` `c03d7301f7b8ab704ed45e1499d2b61caa7c8628`, Hola Maps CI và Security Scan PASS.
- **PR:** [PR #108](https://github.com/hoanglamvu04/bandohoalac/pull/108) đang mở. Đồng bộ với `main`, giải quyết xung đột ở báo cáo/kế hoạch/nhật ký, lưu nguyên vẹn lịch sử trên `main`.
- **Phạm vi:** `publicLaunchAudit.js`, `launchEvidence.service.js`, `launchEvidence.test.js`, `AdminOperations.jsx` và runbook. Kiểm thử trên head mới đang chờ CI.
- **Bàn giao:** Xác nhận bản sao chỉ đọc trên VPS để chạy báo cáo POI và BĐS. Chưa triển khai VPS.

## 16:29 25/11/2026 GMT+7 — HOLA-P1-109 — Xác nhận merge và bàn giao

- **Kết quả:** [PR #111](https://github.com/hoanglamvu04/bandohoalac/pull/111) đã hợp nhất trên `main`, SHA `eb8b7f3abb58852e7703129158caca3aab072ca4`.
- **CI:** 9/9 checks PASS trên head `1766d6dce8e3416d437b0d74123c72dae415daad`. [Hola Maps CI](https://github.com/hoanglamvu04/bandohoalac/actions/runs/45584879416) chạy frontend build, Playwright và PG16/PostGIS; backend đạt 228/228. [Security Scan](https://github.com/hoanglamvu04/bandohoalac/actions/runs/45584879379) PASS.
- **Bước tiếp:** Chạy `npm run housing:amenities:audit --prefix backend` trên bản sao được cấp quyền. Kiểm chứng khu/nhóm có ít dữ liệu trước khi bổ sung hoặc tái xác minh POI. Trạng thái VPS chưa được xác minh; WA-005 cần phê duyệt riêng.

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
