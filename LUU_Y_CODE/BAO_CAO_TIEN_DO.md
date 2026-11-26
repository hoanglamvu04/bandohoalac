# BÁO CÁO TIẾN ĐỘ & TRẠNG THÁI — HOLA Maps

> **Chốt kiểm tra:** 16:57 25/11/2026 GMT+7. Xác minh `main` tại `c02640c9ec5399c003f3e1a7fd9115921e5a25d5` sau [PR #113](https://github.com/hoanglamvu04/bandohoalac/pull/113). [Hola Maps CI](https://github.com/hoanglamvu04/bandohoalac/actions/runs/45589817673) và [Security Scan](https://github.com/hoanglamvu04/bandohoalac/actions/runs/45589817721) PASS trên head PR.

## 26/11/2026 GMT+7 — HOLA-P1-112: ghim giá BĐS, liên hệ sau đăng nhập

- **Baseline:** `main` `a034b2d75a061c6bf4c1f3d462522b611c715953` (PR #124 đã merge). Nhánh `feat/p1-112-housing-price-pins-contact-reveal-20261126`, **ĐANG LÀM — chờ CI/merge**, chưa deploy VPS.
- **Ghim bản đồ:** trong HOLA HOUSING hiển thị giá thuê/bán bằng nhãn MapLibre, giữ gom cụm, click/hover như pin thường. Giá rỗng vẫn để biểu tượng mặc định; không áp giá sang lớp POI khác.
- **Liên hệ:** API công khai BĐS không trả `phone` và `contactZalo` trong place/housing; API riêng `GET /api/housing/:placeId/contact` kiểm tra session, published+active+expiry, hạn mức 12 lượt/phút/tài khoản, no-store; demo không trả số giả. Frontend login rồi click mới gọi; có hủy request khi đổi tin/logout.
- **Mở rộng:** thẻ trên map, trang chi tiết mới/cũ có người đăng và nút hiện số; giữ địa điểm không phải BĐS như hiện tại. Không tự đánh dấu chủ nhà đã xác minh.
- **Tests:** bổ sung backend unit HTTP 401, data redaction và validation; Playwright ghim giá, ẩn số khi chưa login, click reveal khi login; tài liệu `docs/HOUSING_PRICE_PINS_CONTACT_REVEAL_P1_112.md`. **CI chưa có bằng chứng PASS ở thời điểm ghi.**
- **Bàn giao:** kiểm thử PG16/PostGIS, Playwright, CodeQL/Security, merge nếu xanh, cập nhật trạng thái và hướng dẫn build/reload riêng HOLA Maps; không tự deploy hoặc thu thập PII.

## 26/11/2026 GMT+7 — HOLA-P1-111: mở seed demo trên production theo yêu cầu

- **Yêu cầu:** chủ website chấp thuận đưa 30 tin giả (15 nhà trọ/phòng trọ) lên DB live phục vụ QA, công khai tên/giá/ảnh demo.
- **Trạng thái:** nhánh `feat/production-optin-thachthat-demo-20261126`, chờ PR/CI/merge. **Chưa truy cập database VPS, chưa seed hoặc reload PM2.**
- **Code:** hai xác nhận cho database live (`HOLA_DEMO_LIVE_CONFIRM` và `HOLA_DEMO_SEED_CONFIRM`), giữ nguyên NODE_ENV và so khớp DB thực, transaction/cleanup an toàn; trang chi tiết demo `noindex`, loại ảnh/giá demo khỏi SEO địa phương và phân vị giá.
- **Kiểm thử:** bổ sung unit production opt-in/cleanup, SEO noindex và market query, CI/PG16/PostGIS/Playwright đang chờ chạy.
- **Tiếp:** merge sau CI; chủ VPS backup, kéo main, reload API nếu thay đổi backend, chạy seed có xác nhận, kiểm tra 30 tin và ảnh, ghi nhận trạng thái production.

## 26/11/2026 GMT+7 — HOLA-P1-110: 30 bất động sản DEMO huyện Thạch Thất cũ

- **Baseline:** `main` `18cf197b2368828377f5cecc1efbb2535a8b8748` sau [PR #121](https://github.com/hoanglamvu04/bandohoalac/pull/121), CI/Security trên PR #121 PASS. Nhánh: `feat/p1-110-thach-that-demo-30-20261126`; **ĐANG LÀM, chờ PR/CI/merge**, chưa chạy seed lên VPS.
- **Seed:** 30 tin mô phỏng BĐS, gồm 15 phòng trọ cho thuê và 15 tài sản khác (10 bán/5 thuê), toàn bộ có giá, diện tích, tọa độ khu vực minh họa, chú thích DEMO và 4 ảnh Unsplash minh họa mỗi tin (120 image records).
- **Mã:** fixture `backend/src/database/thachThatDemoData.js`; runner `backend/src/scripts/seedThachThatDemo.js` và scripts npm preview/seed/clean; tests `backend/tests/thachThatDemoSeed.test.js`; hướng dẫn `docs/DEMO_THACH_THAT_30.md`.
- **An toàn:** guard từ chối NODE_ENV production, DB không rõ tên staging/test, thiếu xác nhận; chỉ demo source+external ID+slug mới được xóa; transaction rollback và idempotency. Số điện thoại 000... không hợp lệ, ảnh/vị trí/giá hoàn toàn minh họa.
- **Kiểm thử:** đã bổ sung unit và PG16/PostGIS integration, **CI chờ chạy**. Ảnh bên ngoài chưa nghiệm thu tải thành công trên staging; chưa có DB staging được cấp để chạy thật.
- **Bàn giao:** chỉ khi CI xanh mới merge; người vận hành tạo DB staging tách biệt, migrate, seed và mở bản đồ/chi tiết theo hướng dẫn, xóa demo sau test. Không dùng mẫu giả để tính số liệu thị trường/SEO/production.

## 26/11/2026 GMT+7 — BÀN GIAO 3 ĐỢT: P0-005 / P0-004 / P1-102

- **Đã merge:** [PR #120](https://github.com/hoanglamvu04/bandohoalac/pull/120) vào `main` SHA `086c91ac5e543a983da8e444a4709d19e1e13aeb`, **9/9 checks PASS** trên head PR, gồm backend PG16/PostGIS, frontend build, Playwright E2E, CodeQL, dependency, shell, safety và LUU_Y_CODE. [PR #119](https://github.com/hoanglamvu04/bandohoalac/pull/119) đóng **không merge** vì nội dung đã có đầy đủ trong #120; E2E #119 bị giữ ở bước cài Chromium của runner.
- **Đợt 1:** legacy backup cron installer fail-closed, test cron giả, hướng dẫn bảo vệ `main`. Upload ảnh hiện có sanitizer WebP trên main, chưa xác minh quyền ảnh cũ/Cloudinary production. Issue #116 vẫn mở cho adversarial PR #57 & residual review; issue #118 vẫn chờ GitHub admin bật branch protection.
- **Đợt 2:** preflight an toàn cho báo cáo BĐS/POI trên bản sao PostgreSQL độc lập, bắt buộc xác nhận thủ công + role không có quyền ghi. **Chưa có số liệu dữ liệu thật** vì chưa có bản sao/credential chỉ đọc: issue #115 còn bị chặn ngoài Git.
- **Đợt 3:** MapLibre WebGL nhóm ghim gần nhau, nhãn số lượng và chạm phóng to; test 65 POI giả lập mobile. Chưa đo P50/P95 Android/iOS thật, issue #117 vẫn mở cho thiết bị/mạng chậm.
- **Production:** không chạy migration, cron, PM2, deploy, ghi DB hoặc bật WA-005. `CI PASS` khác với nghiệm thu VPS.
- **Việc tiếp:** GitHub admin kích hoạt ruleset #118; data owner cấp PostgreSQL copy readonly để chạy 2 bảng tổng hợp #115; QA thử thực tế Android/iOS #117 và backup/restore P0 trước public.

## 26/11/2026 GMT+7 — HOLA-P0-004 + HOLA-P1-102 — kiểm toán bản sao & cụm ghim mobile

- **Trạng thái:** ĐANG LÀM — nhánh `feat/p0-004-p1-102-audit-cluster-20261126` trên nhánh bảo mật #119; chờ CI/merge. Không chạy truy vấn dữ liệu production hoặc deploy VPS.
- **P0-004 / Issue #115:** Bổ sung `verifyReadOnlyAuditCopy` kiểm tra xác nhận bản sao, transaction `READ ONLY`, tài khoản không phải quản trị và không có quyền INSERT/UPDATE/DELETE/TRUNCATE trên bảng chính. Runbook dừng ngay khi preflight không đạt. **Chưa có số liệu thực tế** — cần bản sao độc lập và tài khoản chỉ đọc do người vận hành xác minh.
- **P1-102 / Issue #117:** Dùng MapLibre WebGL để gom ghim công khai gần nhau ở zoom thấp (cluster radius 48px, zoom ≤14), hiển thị số lượng, chạm mới phóng to; không tự đổi vị trí camera khi đóng chi tiết. Test Playwright với 65 ghim giả lập trên viewport mobile.
- **Kiểm thử:** đã thêm backend unit preflight và frontend Playwright cluster; chờ CI/PostGIS, CodeQL. Test giả lập không thể chứng minh P95 hoặc trải nghiệm thiết bị Android/iOS thật.
- **Phụ thuộc:** #119 cần merge trước; #118 bảo vệ branch và #115 audit dữ liệu thật còn chờ quản trị viên/DB copy. WA-005 #92 chưa được phê duyệt.

## 26/11/2026 GMT+7 — HOLA-P0-005 / OPS-118 — Security (đang PR)

- **Nhánh:** `fix/p0-005-cron-fail-closed-20261126`, PR chờ CI/merge, chưa triển khai VPS.
- **Code:** sửa script legacy `scripts/install-backup-cron.sh` để thiếu crontab hoặc ghi cron thất bại trả lỗi; thêm Node tests giả lập crontab, không sửa cron máy chủ; hướng dẫn cấu hình bảo vệ `main`.
- **Đối chiếu:** Cloudinary/main đã re-encode WebP trước upload; PR #54 và #57 cũ phải review riêng, không merge hàng loạt. Issue #116 vẫn theo dõi.
- **Blocker:** Issue #118 cần GitHub admin bật branch protection; backup offsite và restore drill vẫn cần VPS, không có bằng chứng đã nghiệm thu.
- **CI:** đang chờ kết quả, không coi PR đã merge.

## HOLA-P1-102 — Smart Map V4 (16:54 25/11/2026 GMT+7)

- **Trạng thái:** [PR #113](https://github.com/hoanglamvu04/bandohoalac/pull/113) đã merge tại `c02640c9ec5399c003f3e1a7fd9115921e5a25d5`. Chưa triển khai VPS.
- **Thay đổi:** Kéo bản đồ chỉ khởi động lại truy vấn theo khung nhìn. Tìm kiếm theo chữ và danh sách BĐS giữ truy vấn đang chạy khi bộ lọc không đổi. Trên điện thoại, nút xem kết quả luôn có thể bấm khi cuộn bộ lọc; giá thuê thấp trước có nhãn rõ hơn.
- **Kiểm thử:** 9/9 checks PASS, 231/231 bài backend và 64/64 bài Playwright; ca mobile xác nhận giữ một truy vấn qua thao tác kéo rồi gửi truy vấn mới khi đổi lọc giao dịch.
- **Việc tiếp:** Đo độ trễ và độ ổn định cụm ghim trên Android/iOS thật, kiểm tra mạng chậm và vùng dày dữ liệu.

## HOLA-P0-004 — Rà dữ liệu công khai (16:49 25/11/2026 GMT+7)

- **Trạng thái:** [PR #108](https://github.com/hoanglamvu04/bandohoalac/pull/108) đã merge tại `2e58863e79280a1393f8854c9a72a39170c4d065`. Chưa triển khai VPS.
- **Phạm vi:** Dùng cùng phép tổng hợp và điều kiện báo lỗi cho CLI và Admin. Đếm tin cũ chưa có hồ sơ BĐS, giá/diện tích không hợp lệ, tin hết hạn hoặc thiếu liên hệ.
- **Kiểm thử:** 9/9 checks PASS, gồm [CI](https://github.com/hoanglamvu04/bandohoalac/actions/runs/45589166739), PG16/PostGIS, Playwright, CodeQL và [Security Scan](https://github.com/hoanglamvu04/bandohoalac/actions/runs/45589166792).
- **Dữ liệu thật (P0-004/P1-109):** BỊ CHẶN. VPS từ chối xác thực SSH từ phiên làm việc này. Chủ dự án sẽ chạy [lệnh trong runbook](../docs/PUBLIC_LAUNCH_P0_RUNBOOK.md#kiểm-toán-tiện-ích-và-bđs-trên-bản-sao-postgresql) trên bản sao được phép và gửi ảnh hai bảng tổng hợp. Chưa chạy truy vấn dữ liệu thật trong phiên này.

## HOLA-P1-109 — Độ phủ và độ mới dữ liệu tiện ích (16:21 25/11/2026 GMT+7)

- **Trạng thái:** ĐÃ MERGE — CHƯA XÁC MINH DEPLOY. [PR #111](https://github.com/hoanglamvu04/bandohoalac/pull/111) đã vào `main` tại `eb8b7f3abb58852e7703129158caca3aab072ca4`.
- **Trang chi tiết BĐS:** Hiện số nhóm được ghi nhận trong 8 nhóm và số POI xác minh bởi HOLA trong 180 ngày, xác minh cũ hơn hoặc chưa có ngày hợp lệ. Khi chạm giới hạn 100, số liệu mô tả mẫu; kết quả rỗng chỉ phản ánh dữ liệu đang có.
- **Rà soát theo khu:** Lệnh chỉ đọc báo cáo theo 9 khu phục vụ, thêm nhóm ngoài vùng. Mỗi nhóm tiện ích có số tin công khai còn hiệu lực, số tin có POI trong 1 km và số tin có POI được xác minh gần đây. Khu phục vụ là xấp xỉ địa lý của sản phẩm.
- **Kiểm thử:** 9/9 checks của PR PASS, gồm frontend build, Playwright, PostGIS, CodeQL, kiểm toán phụ thuộc, shell và cổng bàn giao. Backend đạt 228/228 bài kiểm thử, gồm ca truy vấn PostGIS của báo cáo.
- **Bước tiếp:** Chạy báo cáo trên bản sao dữ liệu được cấp quyền, xác nhận mẫu thấp/rỗng và chọn khu cần bổ sung hoặc xác minh POI. Routing và nghiệm thu VPS chờ bằng chứng riêng.

## Hoàn thành mã nguồn — HOLA-P1-104 (13:50 25/11/2026 GMT+7)

- **PR:** [#109](https://github.com/hoanglamvu04/bandohoalac/pull/109) — đã merge, frontend build, E2E Playwright, backend/PostGIS, CodeQL, dependency, repository safety, shell và LUU_Y_CODE gate đều PASS.
- **Trạng thái:** ĐÃ MERGE — CHƯA XÁC MINH DEPLOY. [PR #109](https://github.com/hoanglamvu04/bandohoalac/pull/109) đã merge vào `main` tại `d55f50d5f21d207a2e10d093576018be0ac43f8f`.
- **Nâng cấp:** Trang chi tiết BĐS công khai có tìm tiện ích trong bán kính 500 m / 1 km / 2 km, hiển thị nhóm địa điểm, khoảng cách đường thẳng, link POI, retry và cảnh báo dữ liệu chưa đầy đủ.
- **Phạm vi mã:** component/CSS trang chi tiết, Playwright, tài liệu chức năng. Không đổi schema/API server, tracking, moderation hoặc quyền riêng tư.
- **Kiểm thử:** 9 checks của PR #109 đều PASS (frontend build, frontend E2E, backend migrate/test/PostGIS, CodeQL 2 kiểm tra, dependency audit, repository safety, shell security, handoff). CI chạy lại trên merge commit `main` cần kiểm tra riêng.
- **Phụ thuộc:** đánh giá độ phủ POI và routing thật vẫn là việc cần làm; production backup/restore và WA-005 PR #92 vẫn chưa nghiệm thu.

## Tóm tắt có thể kiểm chứng

- **Repository:** [hoanglamvu04/bandohoalac](https://github.com/hoanglamvu04/bandohoalac), branch chính `main`.
- **Kết quả tại baseline:** GitHub Actions **Hola Maps CI = PASS**, **Security Scan = PASS** trên head PR #111.
- **Mã nguồn:** React/Vite, Express, PostgreSQL 16 + PostGIS, MapLibre; đã có bản đồ, địa điểm, đóng góp/duyệt, BĐS, cộng đồng/CTV, đối tác, SEO và vận hành.
- **Trạng thái phát hành production:** **CHƯA NGHIỆM THU / không có bằng chứng triển khai VPS của các PR mới**. GitHub CI không xác nhận Nginx, PM2, PostgreSQL/ảnh thật hay thiết bị thật.
- **Bộ bàn giao LƯU Ý CODE:** [PR #106](https://github.com/hoanglamvu04/bandohoalac/pull/106) **ĐÃ MERGE**, CodeQL, PostGIS/backend, Playwright/frontend, dependency audit, shell và handoff policy đều PASS. Đây là bộ hồ sơ/CI, không phải deploy VPS.
- **Tích hợp X-HUB WA-005:** [PR #92](https://github.com/hoanglamvu04/bandohoalac/pull/92) **OPEN, chưa merge**, cần nghiệm thu/cấp nguồn theo hợp đồng X-HUB. Không bật tracking ngoài consent.
- **Quy tắc:** Địa điểm/BĐS công khai phải qua kiểm duyệt; không tự xuất bản khi người dùng chỉ gửi yêu cầu.

## Các đợt đã merge gần nhất (mã nguồn)

| PR | Nhóm | Trạng thái tại thời điểm kiểm tra | Phạm vi thực tế |
|---|---|---|---|
| [#99](https://github.com/hoanglamvu04/bandohoalac/pull/99) | Sprint 6 + 9 | ĐÃ MERGE — CHƯA XÁC MINH DEPLOY | Phân vị giá chào BĐS và tiện ích quanh tin |
| [#100](https://github.com/hoanglamvu04/bandohoalac/pull/100) | Sprint 7 | ĐÃ MERGE — CHƯA XÁC MINH DEPLOY | Tìm BĐS theo khung nhìn PostGIS, phân trang |
| [#101](https://github.com/hoanglamvu04/bandohoalac/pull/101) | Sprint 5 + 16 | ĐÃ MERGE — CHƯA XÁC MINH DEPLOY | Bảng chỉ dấu dữ liệu ra mắt và các bước nghiệm thu thủ công |
| [#102](https://github.com/hoanglamvu04/bandohoalac/pull/102) | Sprint 13 | ĐÃ MERGE — CHƯA XÁC MINH DEPLOY | Chặn SEO/sitemap cho tin BĐS hết hiệu lực; chỉnh CI runner |
| [#103](https://github.com/hoanglamvu04/bandohoalac/pull/103) | Sprint 10 | ĐÃ MERGE — CHƯA XÁC MINH DEPLOY | Data Trust V5 — phân loại ưu tiên kiểm duyệt |
| [#104](https://github.com/hoanglamvu04/bandohoalac/pull/104) | Sprint 8 | ĐÃ MERGE — CHƯA XÁC MINH DEPLOY | Báo tin BĐS đáng ngờ vào hàng chờ Admin |
| [#105](https://github.com/hoanglamvu04/bandohoalac/pull/105) | Sprint 15 | ĐÃ MERGE — CHƯA XÁC MINH DEPLOY | Cache 60 giây/singleflight thống kê giá, giới hạn bộ nhớ |

**Lưu ý:** 7 PR trên đều có kiểm tra CI/Security PASS trước khi merge. Đây là những **phần việc** đã triển khai; không có nghĩa tất cả yêu cầu trong Sprint 5–16 đã hoàn thành.

## Đánh giá tiến độ theo Sprint

| Sprint | Mức thực hiện | Điều còn chưa khẳng định đã xong |
|---|---|---|
| 5 — Public Launch | Có nền tảng kiểm tra vận hành | Thiếu bằng chứng backup/restore, kiểm thử VPS, mobile và nghiệm thu public |
| 6 — Property Intelligence | Có thống kê giá chào đã duyệt | Chưa có lịch sử giao dịch thật, định giá đáng tin cậy hay đo độ phủ mẫu production |
| 7 — Smart Map | Có tìm BĐS theo vùng | Chưa nghiệm thu toàn bộ Smart Map V4, tải lớn và điều kiện mobile thật |
| 8 — Real Estate Marketplace | Có đăng tin/duyệt, so sánh, theo dõi và báo tin nghi vấn | Chưa kiểm chứng đầy đủ hành trình lead, chống gian lận và hiệu quả thực tế |
| 9 — Location Intelligence | Có thống kê tiện ích theo đường thẳng | Chưa coi đó là thời gian lái xe/độ phủ tiện ích toàn vùng |
| 10 — Data Trust V5 | Có phân loại ưu tiên xử lý | Cần đánh giá bằng dữ liệu thật; không tự động khẳng định tin gian lận |
| 11 — CTV & Community | Đã có phân quyền/kiểm định/cộng đồng | Cần rà soát backlog và nghiệm thu hành trình CTV end-to-end |
| 12 — Partner | Đã có dashboard/quản lý đối tác | Cần kiểm thử quyền, dữ liệu báo cáo và hành trình đối tác production |
| 13 — SEO V2 | Có trang SEO và chặn tin hết hạn | Cần rà soát index/canonical và chất lượng nội dung/dữ liệu thật |
| 14 — X-HUB WA-005 | Có PR chờ | BỊ CHẶN bởi hợp đồng, phê duyệt X-HUB và nghiệm thu dữ liệu |
| 15 — Performance | Có cache và test đồng thời | Cần đo Web Vitals/tải cao trên hạ tầng thật |
| 16 — Operations | Có Admin evidence dashboard | Chưa có kiểm tra production và ký nghiệm thu |

## Cổng bắt buộc trước public launch (tất cả CHƯA XÁC MINH)

1. Backup PostgreSQL + media có xác minh bản sao **ngoài VPS**, checksum, lưu giữ phù hợp.
2. **Restore drill** từ backup production thật vào DB/thư mục test hoàn toàn tách biệt.
3. Rà soát quyền sử dụng ảnh, metadata ảnh gốc lịch sử, quyền riêng tư.
4. Kiểm thử Android/iOS thực, 3G/4G, thao tác bản đồ và đường dẫn chính.
5. Kiểm thử TLS/Nginx/PM2, quyền Admin/2FA, rate limit và nguồn dữ liệu đang hoạt động.
6. Audit tin BĐS còn hiệu lực, consent, dữ liệu cũ/thiếu và thủ tục kiểm duyệt.
7. WA-005 chỉ hoạt động khi hợp đồng X-HUB được nghiệm thu riêng; có thể ra mắt HOLA Maps độc lập nếu tính năng này chưa bật và không là yêu cầu bắt buộc của đợt launch.

**Thực hiện:** [KE_HOACH_TIEP_THEO.md](KE_HOACH_TIEP_THEO.md). **Bằng chứng:** `docs/PUBLIC_LAUNCH_P0_RUNBOOK.md`. Các đầu việc mở/PR cũ cần được rà theo trạng thái **hiện tại** trên GitHub, không suy diễn là đã merge.

## Mẫu cập nhật mỗi phiên

- **Ngày giờ (GMT+7):** …
- **ID công việc / người hoặc AI thực hiện:** …
- **Trước:** SHA/PR và trạng thái đã kiểm tra: …
- **Sau:** SHA/PR và trạng thái có bằng chứng: …
- **Điểm thay đổi:** …
- **CI / tests:** tên kiểm thử, PASS/FAIL/SKIP, liên kết nếu có: …
- **Production:** chưa triển khai / triển khai có bằng chứng / nghiệm thu có bằng chứng: …
- **Chặn / rủi ro:** …
- **Việc tiếp theo:** … (phải đối chiếu với kế hoạch).
