# NHẬT KÝ CODE & BÀN GIAO

**Nguyên tắc append-only:** mục mới thêm trên đầu, **không xóa/sửa mất mục cũ**. Nếu báo cáo trước sai, thêm mục đính chính kèm đường dẫn Git/CI. Không ghi dữ liệu cá nhân, secret, log VPS có token hoặc ảnh người dùng.


## 16:04 27/11/2026 GMT+7 — HOLA Core Intelligence V2: mở roadmap kỹ thuật (tài liệu, chưa code)

- Baseline xác minh `main` `526f774f7a721ff45906dd64de49c74e3e23625d`; PR #143 đã merge vào commit này. Các 7 đợt trước đã có code merge; không xác nhận đã nghiệm thu production. Người dùng báo trải nghiệm có vẻ OK, chưa có log smoke/backup/restore/load/device để xác nhận.
- Lập [ROADMAP_CORE_INTELLIGENCE_V2.md](ROADMAP_CORE_INTELLIGENCE_V2.md): 10 đợt, 60 ID con, phạm vi, phụ thuộc, nghiệm thu, P0 gates. Trạng thái mới CHUA_LAM; nền chức năng cũ cần đối chiếu, không làm lại.
- Thứ tự nền tảng 1→2→3→10, sau đó 4→5→6→7→8→9. Không đổi stack hoặc tự cài Redis/microservices; 90% backend/DB/thuật toán/test, 10% admin cần thiết.
- Docs-only PR đang được tạo; không sửa ứng dụng/schema/workflow, không chạy migration, seed, triển khai hay đo load. CI của PR tài liệu cần xác minh trước merge. WA-005 #92 và P0 blockers cũ giữ nguyên; không coi tất cả backlog đã hoàn thành.

- File đổi: README.md, ROADMAP_CORE_INTELLIGENCE_V2.md (mới), BAO_CAO_TIEN_DO.md, KE_HOACH_TIEP_THEO.md, NHAT_KY_CODE.md. Bằng chứng Git trước thay đổi: SHA nêu trên; kiểm thử runtime không áp dụng cho docs-only. Bàn giao: bắt đầu HOLA-P1-135.01, đọc AGENTS.md và kiểm tra PR/CI hiện tại.

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

## 26/11/2026 GMT+7 — HOLA-P1-112 — xác minh merge ghim giá và reveal theo đăng nhập

- **Đã merge:** [PR #126](https://github.com/hoanglamvu04/bandohoalac/pull/126) vào `main` `9880919a514d36b0855cc44c979cb8356ac8220c`; 9/9 CI/Security checks PASS (bao gồm PG16/PostGIS, Playwright 67/67, CodeQL).
- **Code:** MapLibre hiện nhãn giá thuê/bán tại layer BĐS, click/hover/chọn tin giữ nguyên, clusters hoạt động; ContactReveal trong inspector + trang chi tiết cũ/mới. Phone/Zalo BĐS không có trong API công khai, chỉ trả ở endpoint authenticated, rate limited, explicit click; DEMO không có số thật; login đưa về đúng URL cũ.
- **Test:** xử lý tương thích E2E với luật ẩn số, và tránh kiểm tra nhãn giá trong lúc MapLibre thay style; lượt CI cuối tất cả PASS.
- **Chưa làm:** chưa SSH hoặc reload PM2, chưa kiểm chứng thay đổi trên website production; không kết luận data live không lộ số cho đến khi reload API thực tế.
- **Tiếp theo:** chủ VPS kéo main, build frontend, reload riêng backend HOLA Maps, kiểm tra 401 chưa login và luồng login/hiện số, đo mobile thực. Không thay WA-005.

## 26/11/2026 GMT+7 — HOLA-P1-112 — BĐS ghim giá và contact reveal

- **Baseline:** main `a034b2d75a061c6bf4c1f3d462522b611c715953`; PR #124 đã merge, #125 vẫn là PR tài liệu chờ CI ở thời điểm bắt đầu.
- **Nhánh/trạng thái:** `feat/p1-112-housing-price-pins-contact-reveal-20261126` đang code/PR, chưa qua CI/merge, chưa triển khai VPS.
- **Backend:** thêm service/contact controller/route có auth session, rate limit và no-store; BĐS công khai ẩn số điện thoại và Zalo, không ảnh hưởng contact POI khác. Demo 30 tin không có số điện thoại thật.
- **Frontend:** MapLibre price badge cho BĐS trong mode housing, có selection/hover, cluster vẫn giữ; component `HousingContactReveal` trên popup và trang chi tiết, request chỉ phát sau click, hủy khi đổi tin/tài khoản.
- **Tests:** tạo backend test redaction/401/expired/demo/validation và Playwright test ghim giá + login gate/reveal; tài liệu `docs/HOUSING_PRICE_PINS_CONTACT_REVEAL_P1_112.md`. Chưa có kết quả CI thật tại thời điểm ghi.
- **Bàn giao:** xem PR/CI, sửa lỗi nếu có; merge khi xanh. Sau merge phải cập nhật LUU_Y_CODE và đưa lệnh VPS kéo/build/reload đúng tiến trình. Không tự SSH hoặc lấy số riêng từ production.

## 26/11/2026 GMT+7 — HOLA-P1-111: production opt-in cho 30 BĐS DEMO

- **Trước:** `main` `e70b9ec672be0343f261ed5ef790d9e6d61d7e65`; code seed #122 đã merge. Chủ website yêu cầu xuất bản demo lên DB production để kiểm thử.
- **Mã:** thêm xác nhận riêng `HOLA_DEMO_LIVE_CONFIRM` ngoài xác nhận apply/clean hiện có, không chuyển NODE_ENV sang development; chỉ làm việc trên đúng database kiểm tra tên. Thêm noindex cho trang demo và loại dữ liệu DEMO khỏi thống kê phân vị giá và trang SEO địa phương.
- **Test:** mở rộng kiểm thử seed production confirmation, identity, SEO noindex và truy vấn giá (chờ GitHub CI).
- **Vận hành:** chưa SSH, chưa backup/seed PM2, chưa xác minh ảnh bên ngoài. Người vận hành phải backup rồi chạy script từ `/var/www/bandohoalac/backend`.
- **Bàn giao:** chỉ merge khi CI/Security PASS, tiếp theo kiểm thử demo live sau khi chủ VPS chạy lệnh có xác nhận, ghi rõ kết quả.

## 26/11/2026 GMT+7 — HOLA-P1-110: tạo mã seed DEMO 30 BĐS Thạch Thất cũ

- **Trước:** main `18cf197b2368828377f5cecc1efbb2535a8b8748` sau PR #121, đã đọc AGENTS.md/5 file LUU_Y_CODE và schema+migrations housing.
- **Nhánh/trạng thái:** `feat/p1-110-thach-that-demo-30-20261126`, code đang PR, CI/merge chưa xác minh.
- **Dữ liệu:** 15 phòng trọ khép kín 19–32m², giá 1,9–3,6 triệu/tháng; 10 BĐS bán và 5 cho thuê khác; tất cả ảnh Unsplash minh họa, 4 ảnh/tin, tên/giá rõ DEMO, tọa độ mô phỏng theo khu vực huyện Thạch Thất cũ. Không đại diện căn nhà thật.
- **Code:** `thachThatDemoData.js`, `seedThachThatDemo.js` (preview/apply/clean, guard production/DB name/confirmation, SQL UPSERT theo external ID, giao dịch), `thachThatDemoSeed.test.js` unit + integration, `backend/package.json`, `docs/DEMO_THACH_THAT_30.md`.
- **Tests:** đã viết ca số lượng, ảnh, tiền, vị trí, guard và database idempotency/cleanup; **chưa có kết quả CI ở thời điểm này**.
- **Chưa làm:** không deploy/seed VPS, không có ảnh tải trực tiếp đã xác minh, không biết database staging đã tồn tại. Cần test staging độc lập và ghi kết quả thật.
- **Bàn giao:** merge sau CI, cập nhật trạng thái LUU_Y_CODE sau merge, QA trên staging và xóa demo an toàn sau test.

## 26/11/2026 GMT+7 — Xác nhận merge 3 đợt HOLA-P0-005 / P0-004 / P1-102

- **Mã:** [PR #120](https://github.com/hoanglamvu04/bandohoalac/pull/120) merge vào main `086c91ac5e543a983da8e444a4709d19e1e13aeb`; toàn bộ 9/9 checks head PR PASS, gồm Backend migrate and test (PostGIS), Frontend build/E2E, CodeQL và security gates.
- **PR #119:** đóng không merge, vì mọi file đã nằm trong #120. Job Playwright của riêng #119 chậm ở cài Chromium, không lấy trạng thái đó làm chứng nhận sản phẩm; #120 đã PASS full E2E.
- **Bàn giao mã:** cron installer fail-closed/test giả; PostgreSQL copy audit preflight + unit tests và runbook; cluster WebGL + Playwright ghim dày; cập nhật `LUU_Y_CODE`.
- **Chưa làm bằng chứng thật:** không có snapshot PostgreSQL readonly để xuất số liệu #115; chưa bật GitHub ruleset #118; chưa đo mobile thật #117; offsite/restore/VPS chưa nghiệm thu; WA-005 #92 chưa phê duyệt.
- **Bước tiếp:** chạy kiểm toán copy thật theo runbook sau khi operator xác minh, kiểm tra Android/iOS/P95, bật bảo vệ main, hoàn tất adversarial & backup review. Không tự deploy.

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
