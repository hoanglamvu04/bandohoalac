# BÁO CÁO TIẾN ĐỘ & TRẠNG THÁI — HOLA Maps

> **Chốt kiểm tra:** 16:57 25/11/2026 GMT+7. Xác minh `main` tại `c02640c9ec5399c003f3e1a7fd9115921e5a25d5` sau [PR #113](https://github.com/hoanglamvu04/bandohoalac/pull/113). [Hola Maps CI](https://github.com/hoanglamvu04/bandohoalac/actions/runs/45589817673) và [Security Scan](https://github.com/hoanglamvu04/bandohoalac/actions/runs/45589817721) PASS trên head PR.


### HOLA-P2-122 — Spatial discovery (27/11/2026)
- Code: POST housing area-search, polygon validity/area cap and service-area clipping predicate; click-drawn 3–24 vertices, cancellation, separate results (normal map markers retained). Route corridor on existing OSRM geometry, public POI only, 200/500/1000 m, length/vertex caps. Viewport profile by published POI categories. No stored GPS or analytics; no claims of administrative coverage or exact detour. Tests added; CI pending. No migration, no production deploy. Real mobile and data-source acceptance still required.


### HOLA-P2-123 — Business services and local activity (27/11/2026)
- Migration 360: catalog and private appointment requests. Only published non-housing active partners with existing owner authority can manage; no auto-verification, payments, phone/email or X-HUB transfer. Public catalog, customer request/cancel, owner inbox/accept/decline/cancel and 30-day aggregate counts; request throttling. Appointment is a request, not a guaranteed slot. Map panel shows existing loaded events/alerts with provenance status. Correct spatial result detail path to /place/:id. Tests added; CI pending. Full real-world partner permission/retention policy and mobile evidence still needed. No production deploy.


### HOLA-P2-124 — SEO readiness, content assistant and price review (27/11/2026)
- #129, #130 and #131 merged; #131 workflow CI/Security completed success and all safety steps passed; check-run summary still returned inconsistent status. #132–135 stacked/pending final CI and merge at time of writing. New: asking-price reference (same-type nearby non-demo inventory, minimum 8 samples; review only), local rules draft from entered fields (no model, no contact), admin SEO filter/internal eligibility and formula-safe CSV, avoid redrawing selection on unrelated MapView rerenders. Tests added. Full 72-item audit in ROADMAP_72.md; do not claim complete/live. External provider approvals, actual sources, room-type inventory, KYC, Q&A, paid product and physical-device evidence remain open. No VPS deploy.

## 27/11/2026 GMT+7 — HOLA-P1-127 — Sidebar V6 (desktop/mobile)

- Baseline `main` `ea41ffd49f8412cfc8b47d614d11ad59884bcd3e`. Người dùng báo đã dọn demo; ảnh VPS trước đó Health/Ready OK, không suy diễn nghiệm thu toàn site. PR #136 vẫn mở, Backend CI FAIL, tách khỏi UI PR.
- Chia sidebar thành Địa điểm/Công cụ/Lớp bản đồ; ưu tiên list, giữ virtual scrolling, bộ lọc, công cụ Housing/travel/area/saved views và lớp dữ liệu. Tools/layers có vùng cuộn riêng, compact mobile sheet, clear free pin khi mở danh sách hoặc chọn POI; bridge nhận diện layer ghim giá/cluster thực tế. Không đổi API/database/consent.
- Sửa test Housing/Travel để mở tab công cụ; thêm desktop/mobile regression tests về tab, layer toggle và foreground pin. CI chưa xác nhận. Không deploy VPS; nghiệm thu thực tế ở 390px và desktop, kiểm tra scroll/pin/consent. Các backlog khác giữ nguyên.

## 27/11/2026 GMT+7 — HOLA-P1-120 / HOLA-P2-121 — search, lưới giá, dòng tiền, góc nhìn

- Stacked sau #131, nhánh `feat/roadmap-search-market-smart-map-20261127`, DANG_LAM. Bổ sung parser tiếng Việt deterministic có giới hạn (ngân sách có đơn vị, bán/thuê, FPT, tiện ích), hiển thị tiêu chí; không gọi AI hay bịa kết quả. Đồng bộ subtype/nội thất vào URL, API, saved search; không lọc lại bằng chuỗi có dấu sau backend.
- Lưới giá 0.025 độ theo viewport, ô tối thiểu 5 mẫu, median giá chào bán/m² hoặc thuê/tháng, loại DEMO/import, click ô mở camera; không phải ranh giới hành chính. Migration 350 lưu snapshot tháng từ lần job thực sự chạy, không hồi tố; job prune hiện hữu gọi snapshot. Calculator đầu tư chỉ từ thông số người dùng, ghi rõ giả định.
- Góc nhìn/lớp bản đồ lưu local browser do người dùng chủ động bấm, giới hạn 10, không đồng bộ tài khoản/GPS. Chưa polygon drawing/corridor routing hoặc kiểm thử thiết bị thật. Tests logic/SQL; CI chờ. Không deploy.

## 27/11/2026 GMT+7 — HOLA-P1-119 — Đợt 2–3: đặc điểm tài sản, lịch sử và gợi ý

- Xác minh PR #129 merge `707db62988761d3d5f67ad2ca363d9d5bd853738`, PR #130 merge `e8b6d44e473c393fe7734de2cc7e23018c3d5a15`; cả hai 9/9 CI/Security PASS. Chưa xác minh deploy. 
- Nhánh `feat/roadmap-stage1-housing-depth-20261127`: migration 340 additive, subtype tương thích property_type hiện có, đặc điểm và tiện nghi đi qua duyệt, pháp lý tự khai, không lưu giấy tờ. Lịch sử giá/phòng trống chỉ bắt đầu ghi từ khi migration chạy, không dựng lịch sử. Tin tương tự theo cùng loại/giá/khoảng cách, public active và loại nguồn import/demo. Bộ lọc API/lưu tìm kiếm và so sánh chi phí mở rộng.
- Kiểm thử validation, SQL, công khai/PII; CI chờ. Chưa có quản lý từng tòa/phòng, KYC hoặc dữ liệu thị trường lịch sử đủ mẫu. Không deploy production; WA-005 giữ chờ nghiệm thu.
- Roadmap 72: đối chiếu chi tiết trong `LUU_Y_CODE/ROADMAP_72.md` sẽ được bổ sung ở PR kế tiếp, giữ backlog cũ và tiêu chí nghiệm thu.

## 27/11/2026 GMT+7 — P1: trạng thái #128/#129 và sửa race MapLibre

- PR #128 đã merge `19b13daecdbf1215e58d635f59ed57267216b894`, 9/9 CI/Security PASS; chưa deploy. PR #129 đã retarget `main`; lần CI đầu 8/9 checks PASS, Playwright 69 PASS/1 FAIL tại ghim giá (run 45869287236), không merge khi còn đỏ.
- Sửa vòng đời MapLibre: lấy danh sách mới nhất lúc load, không bỏ qua cập nhật source khi tile khác đang tải; khóa cập nhật chỉ trong lúc đổi style và phục hồi từ refs. Test kiểm tra GeoJSON thật và binding text-field của layer giá, không phụ thuộc tile cache đang tải. Chờ CI lại; chưa nghiệm thu production.


## 27/11/2026 GMT+7 — HOLA-P1-118 — thống kê tin có opt-in

- PR #128 đã merge `main` `19b13daecdbf1215e58d635f59ed57267216b894`, **9/9 checks PASS**, chưa deploy. PR #129 retarget main, chưa merge tại lúc ghi.
- Nhánh `feat/p1-118-housing-consented-metrics-20261127` xếp sau #129, DANG_LAM, chưa CI/merge. Migration 330 tạo counters theo tin/ngày VN; mặc định tắt; DNT/GPC chặn cả UI/server. Chỉ số tổng hợp, không lưu visitor ID/phone/email/IP/GPS trong bảng; tách khỏi WA-005. Hạn mức POST, active publication, loại DEMO/import.
- Dashboard riêng người đăng: lượt xem chi tiết và lần hiện số thành công có consent trong 30 ngày, cùng yêu cầu xem và lịch đã xác nhận. Không gọi unique visitors/giao dịch, không dùng ranking.
- Bổ sung lựa chọn và điều khoản quyền riêng tư, dọn metrics 90 ngày/lịch cũ 180 ngày qua CLI prune (cần xác minh cron VPS), hiển thị dữ liệu tự khai trong admin review, giữ trường chi phí khi lưu nháp.
- Tests backend SQL/consent/HTTP và Playwright opt-in/revoke. Chờ CI. Cần retarget main sau #129, merge khi đủ cổng xanh. Chưa chạy migration hoặc deploy, chưa KYC/phê duyệt xác minh chủ sở hữu.
- Backlog P1 trước đây còn phụ thuộc dữ liệu/hạ tầng/thiết bị thật, WA-005 và P0 giữ nguyên.

## 27/11/2026 GMT+7 — HOLA-P1-115/116/117/118 — lịch xem và quản lý người quan tâm

- Nhánh `feat/p1-115-117-118-housing-viewings-20261127` xếp sau PR #128 (head `eff3ade1b7aaf520fbc6aaa15f0a69a04c3f91a4`), DANG_LAM, chưa merge/deploy. Migration 320 additive.
- Lịch xem riêng giữa tài khoản đăng tin USER/CTV và người gửi; chặn DEMO/import, self-booking, tin ẩn/hết hạn/hết phòng, IDOR, lịch trùng và quá khứ. Chỉ lưu mã tài khoản nội bộ, tên tin snapshot và thời gian; không lấy phone/email/GPS/ghi chú.
- Quản lý lịch vào/ra, xác nhận/từ chối/hủy, giới hạn 10 lịch đang mở và rate-limit; số lượng yêu cầu và lịch đang ACCEPTED 30 ngày riêng chủ tin. Không tuyên bố đã đo lượt xem/hiện số hay giao dịch; analytics consent riêng còn cần thiết kế.
- Chủ tin RENT có thể xác nhận số phòng trống trong luồng gia hạn có sẵn; 0 = FULL, hủy lịch tương lai; không tự xuất bản lại tin archived hoặc thay đổi giá ngoài moderation.
- Tests: backend auth, time, PG16 quyền/trùng/chuyển trạng thái, Playwright login/slot. Chưa có kết quả CI. Phải retarget main sau PR #128, kiểm tra CI đầy đủ trước merge; chưa migration VPS.
- Các P1 cũ cần nghiệm thu thực tế, xác minh hồ sơ chủ nhà và analytics consent chưa hoàn tất; WA-005/P0 giữ nguyên.

## 27/11/2026 GMT+7 — HOLA-P1-113/114/116 — chi phí thuê và vai trò người đăng

- Baseline `main` `d81074a0836773099ea4232d1b19edba1f9f4428` sau PR #127. Nhánh `feat/p1-113-114-116-housing-rental-details-20261127`: DANG_LAM, chờ CI/merge, chưa deploy.
- Bổ sung đơn giá thuê, tiền cọc, điện/nước/xe, số phòng trống tự khai vào form gửi duyệt; lưu vào các cột có sẵn sau duyệt; migration additive chỉ thêm advertiser_role, không xác minh chủ sở hữu. API public chỉ thêm vai trò; không trả phone/Zalo.
- Calculator trang chi tiết RENT dựa trên đơn giá công khai, nhập số người/điện/xe, tách 0 khỏi thiếu dữ liệu; hiển thị ngày người đăng xác nhận riêng khỏi HOLA verification.
- Test validator, phép tính và Playwright mobile bổ sung, chưa có kết quả CI. Chưa hoàn tất lịch xem, CRM lead, thống kê hoặc cập nhật số phòng trên tin cũ.
- Bàn giao: kiểm tra PG16/PostGIS, frontend build/E2E và Security; tiếp tục P1-115/117/118. Không chạy migration VPS hoặc WA-005; P0, dữ liệu thật và thiết bị thật vẫn chờ.

## 26/11/2026 GMT+7 — HOLA-P1-112: ghim giá BĐS, liên hệ sau đăng nhập

- **Đã merge:** [PR #126](https://github.com/hoanglamvu04/bandohoalac/pull/126) vào `main` SHA `9880919a514d36b0855cc44c979cb8356ac8220c`, **9/9 CI/Security checks PASS** trên head PR (frontend build, Playwright 67/67, backend PG16/PostGIS, CodeQL, security, dependency, shell, repository safety, handoff). **DA_MERGE_CHUA_DEPLOY** — chưa pull/build/reload VPS.
- **Ghim bản đồ:** trong HOLA HOUSING hiển thị giá thuê/bán bằng nhãn MapLibre, giữ gom cụm, click/hover như pin thường. Giá rỗng vẫn để biểu tượng mặc định; không áp giá sang lớp POI khác.
- **Liên hệ:** API công khai BĐS không trả `phone` và `contactZalo` trong place/housing; API riêng `GET /api/housing/:placeId/contact` kiểm tra session, published+active+expiry, hạn mức 12 lượt/phút/tài khoản, no-store; demo không trả số giả. Frontend login rồi click mới gọi; có hủy request khi đổi tin/logout.
- **Mở rộng:** thẻ trên map, trang chi tiết mới/cũ có người đăng và nút hiện số; giữ địa điểm không phải BĐS như hiện tại. Không tự đánh dấu chủ nhà đã xác minh.
- **Tests:** backend kiểm tra 401, redaction, hạn chế liên hệ của tin hết hiệu lực và DEMO; Playwright kiểm tra ghim giá, login gate, click reveal và test cũ phù hợp chính sách mới. **9/9 CI/Security checks PASS** trên PR #126; không thay bằng bằng chứng deploy thực tế.
- **Bàn giao VPS:** người vận hành kéo `main`, build `frontend`, reload **chỉ** tiến trình HOLA Maps API, kiểm tra số ẩn trong Network JSON và `GET /api/housing/:id/contact` trả 401 khi chưa đăng nhập. Chưa SSH/deploy, chưa ghi/đọc số điện thoại production trong cuộc trò chuyện này.

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


## 27/11/2026 GMT+7 — HOLA-P1-128 — #136 / room search and moderated QA
- Main baseline eb35db9faa9bc2b4281b13b8fab8be4288b244f7, #137 merged. PR #136 created 23 files for room catalog and moderated POI Q&A. Head 37b9ea68abf849984b575e8a509274cb16992005: Backend migrate and test FAIL (migration 370 syntax at CASE/END; 8/9 other checks passed). Reconciled Sidebar V6, fixed parenthesized CASE, prevented null property type, serialized per-author QA limits, refresh expiry on approved inventory.
- Same-room price/area/availability filtering in search and saved-search matching, SQL regression. Pin/sort still representative; no real-time booking. Migration 370 has never merged; fix only on PR. CI re-run pending; no VPS deployment.
- Seven-wave IDs: P1-128 Housing/QA, P1-129 Smart Search, P1-130 Smart Map, P1-131 Data Intelligence, P2-132 Community, P2-133 SEO/PWA, P0-134 readiness. External source/KYC, devices and staging remain separate gates.


## 27/11/2026 GMT+7 — HOLA-P1-129 — Smart Search V6
- Baseline main eb35db9faa9bc2b4281b13b8fab8be4288b244f7; #136 sửa migration/room match đang CI, PR này độc lập. Tận dụng pg_trgm và Smart Rank V3, bổ sung one-edit typo score, search active partner service title qua POI, chọn kết quả theo danh mục, Enter/Escape/outside dismissal và stale request guard.
- Tùy chọn lưu tối đa 8 từ khóa mặc định tắt; chặn chuỗi liên hệ/toạ độ hiển nhiên, xóa history, chọn tối đa 5 danh mục yêu thích thủ công; dữ liệu local device, không truyền sang X-HUB. Không có AI/cá nhân hóa theo hành vi. Tests bổ sung, CI chưa xác nhận. Không migration/deploy. Tiêu chí: exact/typo/relevance, service visibility, navigation, privacy, regression.

- #136 đã merge `4207d9f` sau 9/9 CI/Security PASS; đồng bộ main và chạy lại CI.


## 27/11/2026 GMT+7 — HOLA-P1-130 — Smart Map V7
- #136 merged 4207d9f (9/9 PASS), #138 stacked base ffa91dadc82db97c653d78123b389747f117f024 đang CI. Lớp lưới giá địa lý MapLibre từ aggregate hiện hữu, minimum sample 5, màu đồng nhất sidebar, xóa khi đổi loại giao dịch/tài sản; phục hồi khi đổi nền map. Không hiển thị giá từng cá nhân hoặc tự tạo mẫu; không phải quy hoạch. Bộ lọc nhanh Housing/Food, truy cập công cụ tìm vùng sẵn có; chia sẻ góc nhìn đã lưu qua URL allowlist (không query text, GPS, token), camera validation. Tests logic bổ sung; CI pending. Không migration/deploy; performance/device benchmark cần môi trường thật.


### 2026-11-27 — HOLA-P1-131 Data Intelligence V6 / HOLA-P1-132 Community area feed
- Reuse existing Data Trust scores, duplicate/image scanners, history/rollback and permissions. Add combined issue/priority/category/accent-insensitive search, selected/current queue CSV (formula neutralization, no contact fields), explicit sample scope; no bulk destructive or auto-verification action.
- Community: explicit bounded viewport activity fetch independent of enabled map layers, type filtering, expiration/status checks, deduplication and source labels; moderated Q&A from #136. No event creation workflow or notification subscription added in this PR.
- Tests added for filtering/export and feed bounds/expiry; CI pending at PR creation. No migration or VPS action. Physical verification, full-coverage audits and per-event submission remain follow-up.


### 2026-11-27 — HOLA-P1-133 SEO, PWA and aggregate search operations
- Migration 380 adds two rental SEO drafts (FPT uses the existing verified campus anchor; VNU remains blocked until a confirmed anchor). No auto-publish. Rental SEO gate requires active, non-demo, structured, available rental inventory and the existing editorial quality checks; housing phone redaction on local API and detail HTML. Existing region/category draft content remains unchanged.
- PWA v6 caches only static offline page/manifest/icon, clears previous HOLA caches, no personalized navigation/API/media cache or forced reload; rental shortcut. Expanded client noindex for account/editor/embed routes.
- Admin Operations counts keyword-bearing HTTP requests by existing places/housing route group in the existing rolling window; no terms, identifiers or new persistent tracking. Counts are not unique users or transactions; no Search Console or WA-005 connection.
- Added migration/SEO/privacy/metrics tests. CI pending at creation; VPS migration and publication remain unexecuted.


### 2026-11-27 — HOLA-P1-128/132 follow-up: advertiser role review and event proposals
- Migration 390 adds private moderated request workflows; owner-only eligible advertiser requests, ADMIN-only approval with explicit offline identity/role checks, no document upload, expiry 90 days and revocation. Public status returns only role/review state, not legal title or KYC; changes in ownership/role/account/listing invalidate the badge.
- Members can submit upcoming public events at existing published non-housing places, source URL required, bounded schedule and duplicate/rate limits; ADMIN/MODERATOR review with explicit source check and no self-approval. Only approved event creates EVENT map feature, revoke archives it; unpublished/moved venue hides it. No automated source fetching or invented events.
- Added owner/detail/admin UI and PostgreSQL integration/validation tests. Real identity/source verification requires staff SOP and evidence outside this system. No production action. CI pending at creation.


### 27/11/2026 (GMT+7) — HOLA-P0-134: seven-wave readiness
- Git evidence: #136, #138, #139, #140, #141 merged with CI 9/9; latest confirmed main at start of readiness work: 45b444fa9660556cefba6f59f91624b30e9ec766. #142 open (f87776b), CI pending when this PR created; readiness is stacked on it. No production deploy or VPS tests performed.
- Added `scripts/release-smoke.mjs`, mock tests in `backend/tests/release-smoke.test.js`, `docs/RELEASE_7_WAVES_RUNBOOK.md`, and `LUU_Y_CODE/ROADMAP_7_WAVES.md` (36-item audit). Read-only anonymous checks, no response body/credential logging; empty sample explicitly incomplete. CI pending for new tests.
- Remaining: batch edit/moderation with rollback, unified relevance/evaluation, area follow/recommendation, full feed, device/load and restore drill, real role/source verification, VNU anchor, draft editorial/data gates, long-term growth analytics. External rights/integrations still blocked. Do not claim full production acceptance; retarget and merge only after checks.


## 27/11/2026 GMT+7 — HOLA-P1-135 — Desktop header V4
- Baseline main `526f774f7a721ff45906dd64de49c74e3e23625d`; #143 merged, main CI/Security successful. New branch `fix/desktop-header-v4-20261127` in progress; PR/CI pending at writing. Desktop 72px, single-line text navigation, partner in navigation, blue property CTA, outlined contribution, compact install/notification/account, More menu at <=1180px, narrower layouts preserve posting through map menu. No changes to mobile paths, backend, auth or migrations. New Playwright tests cover 761–1920px signed-in with install action, secondary menu/Escape and mobile regression. CI and real-browser visual acceptance not yet verified; no VPS deployment.

- PR #145 first CI: Vite build succeeded, CSS performance budget failed (121 KiB gzip > 120 KiB); Security Scan and backend passed, frontend E2E skipped. Consolidated superseded desktop rules in header-clean-v2.css and header-balanced-v3.css; V4 owns desktop geometry, retained dropdown/mobile rules, made install-event test deterministic. Budget unchanged; rerun CI pending. No deployment.
