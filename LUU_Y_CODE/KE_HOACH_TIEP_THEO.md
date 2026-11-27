# KẾ HOẠCH CODE TIẾP THEO — HOLA Maps

> **Rà soát:** 16:57 25/11/2026 GMT+7, `main` `c02640c9ec5399c003f3e1a7fd9115921e5a25d5` sau [PR #113](https://github.com/hoanglamvu04/bandohoalac/pull/113).


## 16:04 27/11/2026 GMT+7 — HOLA Core Intelligence V2: mở roadmap kỹ thuật (tài liệu, chưa code)

- Baseline xác minh `main` `526f774f7a721ff45906dd64de49c74e3e23625d`; PR #143 đã merge vào commit này. Các 7 đợt trước đã có code merge; không xác nhận đã nghiệm thu production. Người dùng báo trải nghiệm có vẻ OK, chưa có log smoke/backup/restore/load/device để xác nhận.
- Lập [ROADMAP_CORE_INTELLIGENCE_V2.md](ROADMAP_CORE_INTELLIGENCE_V2.md): 10 đợt, 60 ID con, phạm vi, phụ thuộc, nghiệm thu, P0 gates. Trạng thái mới CHUA_LAM; nền chức năng cũ cần đối chiếu, không làm lại.
- Thứ tự nền tảng 1→2→3→10, sau đó 4→5→6→7→8→9. Không đổi stack hoặc tự cài Redis/microservices; 90% backend/DB/thuật toán/test, 10% admin cần thiết.
- Docs-only PR đang được tạo; không sửa ứng dụng/schema/workflow, không chạy migration, seed, triển khai hay đo load. CI của PR tài liệu cần xác minh trước merge. WA-005 #92 và P0 blockers cũ giữ nguyên; không coi tất cả backlog đã hoàn thành.

| Đợt | ID | Phạm vi | Trạng thái V2 |
|---|---|---|---|
| 1 | HOLA-P1-135 | Database Intelligence | CHUA_LAM |
| 2 | HOLA-P1-136 | Backend Performance Engine | CHUA_LAM |
| 3 | HOLA-P1-137 | Background Job Engine | CHUA_LAM |
| 4 | HOLA-P1-138 | HOLA Search Engine V7 | CHUA_LAM |
| 5 | HOLA-P1-139 | HOLA Ranking Engine | CHUA_LAM |
| 6 | HOLA-P1-140 | Geospatial Intelligence | CHUA_LAM |
| 7 | HOLA-P1-141 | Data Trust Engine V7 | CHUA_LAM |
| 8 | HOLA-P1-142 | Housing Core V3 | CHUA_LAM |
| 9 | HOLA-P1-143 | Real Estate Market Intelligence | CHUA_LAM |
| 10 | HOLA-P0-144 | System Governance & Integration | CHUA_LAM |

**Việc tiếp theo:** HOLA-P1-135.01 — audit database/migration/index/constraints; ghi baseline và blocker staging trước tối ưu. 60 hạng mục chi tiết và cổng nghiệm thu ở roadmap V2.

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


## Quy ước

- Mỗi hạng mục có **ID ổn định**, phạm vi, tiêu chí nghiệm thu, blocker và trạng thái.
- Ưu tiên **P0** = chặn rủi ro/sẵn sàng public; **P1** = hoàn thiện luồng sản phẩm; **P2** = tối ưu/tăng trưởng.
- Trạng thái dùng chung: `CHUA_LAM`, `DANG_LAM`, `CHO_DUYET`, `DA_MERGE_CHUA_DEPLOY`, `DA_DEPLOY_CHUA_NGHIEM_THU`, `DA_NGHIEM_THU`.
- **Không có hạn chót tự suy đoán.** Mỗi phiên nhận việc phải chọn ID và ghi rõ cái gì sẽ làm, cái gì không làm.

## Nhiệm vụ tài liệu đang thực hiện

| ID | Trạng thái tại thời điểm ghi | Kết quả mong đợi |
|---|---|---|
| HOLA-DOC-001 | ĐÃ MERGE — [PR #106](https://github.com/hoanglamvu04/bandohoalac/pull/106), CI PASS | Tiếp tục duy trì nhật ký và kế hoạch ở mỗi PR sửa code; kiểm tra định kỳ PR code có cập nhật ba file |

## P0 — Cổng an toàn và ra mắt

| ID | Trạng thái | Việc cần làm tiếp | Điều kiện hoàn thành |
|---|---|---|---|
| HOLA-P0-001 | CHUA_LAM (cần quyền VPS) | Audit backup offsite, checksum và restore drill độc lập; đối chiếu PostgreSQL 16, Cloudinary/local media | Có log thực tế + bằng chứng restore test, không tác động DB production |
| HOLA-P0-002 | CHUA_LAM (cần thiết bị/hạ tầng thật) | Nghiệm thu Nginx/TLS, PM2, API, cron, mobile Android/iOS, 3G/4G và Web Vitals | Checklist runbook hoàn tất, rủi ro P0 được xử lý và có người duyệt |
| HOLA-P0-003 | CHO_DUYET | Rà WA-005 PR #92 và hợp đồng X-HUB; chỉ merge khi X-HUB chấp thuận dữ liệu/phân quyền/consent | PR đạt CI + nghiệm thu nguồn/đích, không có PII/GPS/token đưa ra frontend |
| HOLA-P0-004 | DA_MERGE_CHUA_DEPLOY #108/#120 (preflight); CHỜ DỮ LIỆU THẬT issue #115 | CLI và Admin dùng cùng điều kiện kiểm toán BĐS công khai. Kiểm toán dữ liệu thật chờ ảnh kết quả từ chủ dự án sau khi chạy [lệnh trong runbook](../docs/PUBLIC_LAUNCH_P0_RUNBOOK.md#kiểm-toán-tiện-ích-và-bđs-trên-bản-sao-postgresql) | Ghi số tổng hợp trên bản sao; rà quyền ảnh, tin hết hạn, thiếu liên hệ và giá/diện tích |
| HOLA-P0-005 | DA_MERGE_CHUA_DEPLOY #120 (cron); vẫn rà bảo mật PR #54/#57 trong issue #116 | Sửa legacy cron installer fail closed; kiểm thử giả lập, rà upload/WebP; đối chiếu PR #54/#57 trên main, không merge nguyên trạng | CI/Security PASS, backlog phần còn lại và VPS chưa nghiệm thu được ghi rõ |
| HOLA-OPS-118 | CHO_QUAN_TRI_VIEN — issue #118 | Bật bảo vệ `main` trong GitHub Settings theo `docs/MAIN_BRANCH_PROTECTION_OPERATOR.md` | Có bằng chứng Ruleset active và branch protected; **chưa được bật bằng mã nguồn** |

## P1 — Hoàn thiện các phần sản phẩm chưa nghiệm thu full

| ID | Sprint | Trạng thái | Việc tiếp theo và tiêu chí nghiệm thu |
|---|---|---|---|
| HOLA-P1-101 | 6 | CHUA_LAM | Đo số mẫu theo loại/vùng từ dữ liệu thật, giữ cảnh báo giá chào; không suy ra giá giao dịch khi thiếu dữ liệu |
| HOLA-P1-102 | 7 | DA_MERGE_CHUA_DEPLOY #113/#120 (cluster WebGL); CHỜ TEST MOBILE THẬT issue #117 | Đợt tiếp theo đo P95, cụm ghim và thao tác Android/iOS thật trên mạng chậm và vùng dày dữ liệu. |
| HOLA-P1-103 | 8 | CHUA_LAM | Kiểm thử từ đăng tin→duyệt→ghim→liên hệ→tạm ẩn→đã giao dịch→báo nghi vấn; không cấp quyền tự xuất bản |
| HOLA-P1-104 | 9 | DA_MERGE_CHUA_DEPLOY — [PR #109](https://github.com/hoanglamvu04/bandohoalac/pull/109), 9 checks PASS | Đưa tiện ích vào trang chi tiết BĐS, chọn 500 m/1 km/2 km, kết quả POI công khai, loading/error/retry, Playwright mobile; tiếp theo đo độ phủ theo khu và chỉ tính thời gian di chuyển khi có routing thật được xác minh |
| HOLA-P1-109 | 9 | DA_MERGE_CHUA_DEPLOY — [PR #111](https://github.com/hoanglamvu04/bandohoalac/pull/111), 9/9 checks PASS | Hiện bằng chứng POI trong 8 nhóm trên trang chi tiết và đo số tin có POI/xác minh gần đây theo khu phục vụ trong 1 km. Kiểm toán dữ liệu thật chờ chủ dự án chạy [lệnh trong runbook](../docs/PUBLIC_LAUNCH_P0_RUNBOOK.md#kiểm-toán-tiện-ích-và-bđs-trên-bản-sao-postgresql) trên bản sao chỉ đọc. Routing chỉ triển khai khi có nguồn được xác minh. |
| HOLA-P1-112 | Housing UX & contact | DA_MERGE_CHUA_DEPLOY — [PR #126](https://github.com/hoanglamvu04/bandohoalac/pull/126), 9/9 CI/Security PASS | Ghim giá bán/thuê trong MapLibre, click mở thẻ BĐS; API liên hệ riêng sau đăng nhập và click, không lộ phone/Zalo trên API công khai; giới hạn rate, test 401/demo/expired, Playwright, build và Security. Sau merge chờ deploy và QA trên web thật. |
| HOLA-P1-111 | DEMO live | DANG_LAM — `feat/production-optin-thachthat-demo-20261126` | Cho phép admin seed 30 tin DEMO trên DB live bằng 2 xác nhận; giữ nhãn DEMO, noindex, không dùng giá giả làm phân vị. Kiểm thử + CI; chỉ chạy VPS sau backup đã kiểm tra. |
| HOLA-P1-110 | QA DEMO | DANG_LAM — nhánh `feat/p1-110-thach-that-demo-30-20261126` | Seed 30 BĐS mô phỏng vùng Thạch Thất cũ (15 phòng trọ, 15 loại khác), 120 ảnh Unsplash; có giá, diện tích, tiện ích, source DEMO; idempotent, clean riêng; CLI từ chối production, test PG16/PostGIS/CI; sau merge chỉ staging chạy thật, kiểm tra ảnh và map |
| HOLA-P1-105 | 10 | CHUA_LAM | Rà thực tế kết quả Data Trust V5, false positive trùng tin và khả năng Admin giải quyết backlog |
| HOLA-P1-106 | 11–12 | CHUA_LAM | Kiểm thử CTV và Partner từ đăng ký, RBAC, duyệt, xác minh, báo cáo, quyền sở hữu; kiểm tra dữ liệu của từng tổ chức |
| HOLA-P1-107 | 13 | CHUA_LAM | Audit sitemap/index/canonical, trang địa phương, ảnh quyền sử dụng; chỉ xuất bản trang SEO đạt điều kiện dữ liệu thật |
| HOLA-P1-108 | 15–16 | CHUA_LAM | Đo P95 API, tải đồng thời, memory cache theo instance, lỗi mạng; tạo ngân sách hiệu năng và kiểm thử hồi quy |

## P2 — Tăng trưởng, quan sát và vận hành dài hạn

| ID | Trạng thái | Mục tiêu |
|---|---|---|
| HOLA-P2-201 | CHUA_LAM | Thiết kế phân tích hiệu quả hành trình BĐS có consent, ẩn danh, chính sách giữ dữ liệu; không âm thầm thu thập PII |
| HOLA-P2-202 | CHUA_LAM | Theo dõi lỗi vận hành, backup/restore định kỳ, dashboard gọn, cảnh báo có người chịu trách nhiệm |
| HOLA-P2-203 | CHUA_LAM | Đánh giá UX, nội dung địa phương, cộng tác viên/đối tác dựa trên phản hồi thật; không thay số liệu bằng dữ liệu giả |

## Lưu ý thực hiện ngày 25/11/2026 — P1-104

Đã merge **tiện ích quanh BĐS ngay ở trang chi tiết** tại [PR #109](https://github.com/hoanglamvu04/bandohoalac/pull/109), SHA `d55f50d5f21d207a2e10d093576018be0ac43f8f`, 9 PR checks PASS. Chưa triển khai hay nghiệm thu VPS. Tiêu chí code: có nút gọi API theo yêu cầu, danh mục, bán kính, lỗi/retry, giao diện mobile, không lấy GPS và không coi khoảng cách thẳng là đường đi. Sau khi CI đạt/merge cần cập nhật trạng thái thực tế vào cả ba file. **Việc tiếp:** HOLA-P1-109 khảo sát dữ liệu thiếu theo xã/khu, mở rộng POI; HOLA-P0-002 thử Android/iOS thật và kiểm chứng VPS; chỉ ước tính thời gian di chuyển khi có routing hợp lệ. HOLA-P0-004 hiện có PR #108 riêng, không làm trùng.

## Nhiệm vụ điều phối 26/11/2026 — P0-004 và P1-102

- **P0-004/#115:** preflight role và transaction read-only đã merge [PR #120](https://github.com/hoanglamvu04/bandohoalac/pull/120). Sau CI/merge vẫn **CHỜ** người vận hành xác minh bản sao độc lập và gửi hai bảng tổng hợp BĐS/POI; không ghi production READY.
- **P1-102/#117:** cluster WebGL và test ghim dày trên mobile giả lập đã merge PR #120. Sau CI/merge cần Android Chrome + iOS Safari trên thiết bị thật, mạng chậm, đo P50/P95 thật và kiểm tra ghim/camera.
- **P0-005/#116:** code cron đã merge qua #120. PR #119 được đóng vì trùng nội dung, không merge riêng; tiếp tục triage draft #54/#57, không merge nguyên trạng.
- **OPS/#118:** cần quản trị viên bật protection/ruleset; CI không thay thế việc này.
- **P0-003:** WA-005 #92 tiếp tục chờ nghiệm thu, không tự merge/bật.

## Trạng thái điều phối sau merge 26/11/2026

- **Đã merge code cả ba đợt:** PR #120 `086c91ac5e543a983da8e444a4709d19e1e13aeb`. Đây là code + CI, **chưa deploy VPS hoặc public launch acceptance**.
- **Blocker P0:** #115 cần bản sao PostgreSQL **độc lập** và tài khoản chỉ đọc, #118 GitHub admin bật protection, P0-001 backup offsite/restore, P0-003 WA-005 chờ phê duyệt.
- **Blocker P1:** #117 Android/iOS thật và P50/P95 mạng chậm. Không lấy Playwright synthetic làm chứng nhận thiết bị thật.
- **Triage còn lại:** issue #116 kiểm tra PR #54/#57, giữ lại phần thực sự chưa có trên main; xử lý từng PR với test riêng.

## 26/11/2026 — HOLA-P1-110: DEMO QA Thạch Thất cũ

**Mục tiêu code:** fixture 30 tin / 15 phòng trọ, 4 ảnh minh họa mỗi tin, giá/diện tích/phòng trống rõ, không chứa dữ liệu bất động sản hoặc điện thoại thật. Seed + clean theo namespace, idempotent, có xác nhận và từ chối DB production. Nhánh `feat/p1-110-thach-that-demo-30-20261126` chờ CI.

**Phụ thuộc ngoài repo:** cần người vận hành tạo database test/staging đã migrate, chạy CLI và kiểm tra 120 URL hình bên ngoài trên UI. Không được dùng demo trong báo cáo độ phủ thật, SEO hoặc production. Sau đó kiểm thử filter giá, 15 room rental, gallery và xóa demo không mất dữ liệu thật. Các P0/#115/#118/WA-005 vẫn giữ nguyên.

## Ưu tiên HOLA-P1-112 (26/11/2026 GMT+7)

- **Code:** giá hiện ngay trên ghim BĐS, giữ cụm ở zoom thấp; số liên hệ chỉ lấy sau login và thao tác chủ động. Liên hệ DEMO ghi rõ không có số thật.
- **Bảo mật:** các API công khai phải ẩn phone/Zalo của BĐS; không chỉ dùng che chữ ở frontend. Hạn mức reveal theo tài khoản; không log/analytics số.
- **Nghiệm thu code:** PR #126 đã merge `9880919a514d36b0855cc44c979cb8356ac8220c`, 9/9 CI/Security PASS. **Chưa nghiệm thu VPS:** cần pull/build/reload đúng backend và kiểm tra 401 khi ẩn danh, số không có trong public JSON. Backlog: xác minh chủ nhà/môi giới thật, chi phí vào ở, lịch hẹn xem và routing.
- **Giữ nguyên:** WA-005 #92 chờ duyệt, P0 backup/restore và mobile Android/iOS chưa nghiệm thu.

## Công việc gần nhất được ưu tiên

1. **HOLA-P0-003:** làm rõ các bước nghiệm thu còn thiếu của WA-005, giữ PR #92 ở trạng thái chờ nếu chưa có phê duyệt.
2. **HOLA-P0-001 / 002:** chuẩn bị checklist, thu bằng chứng VPS thật trước khi tuyên bố đã public-ready.
3. **HOLA-P0-004 / 005:** xử lý dữ liệu công khai có rủi ro và các PR bảo mật đang mở.
4. Sau P0, chọn từng hạng mục P1 có tiêu chí nghiệm thu thực tế, không triển khai “full” chỉ dựa vào tên Sprint.

### Cách cập nhật kế hoạch

Khi bắt đầu task: gắn ID, đổi sang `DANG_LAM` và ghi PR/dự kiến kiểm thử. Sau code: cập nhật nội dung đã làm, trở ngại, thứ tự ưu tiên, bước tiếp. Khi PR chưa merge **không đổi thành đã merge**. Sau merge phải có phiên cập nhật lại cùng bằng chứng.

**Việc tiếp của HOLA-P1-109:** chạy báo cáo trên bản sao PostgreSQL được cấp quyền, rà nhóm và khu có ít quan sát, đối chiếu với nguồn POI độc lập trước khi kết luận độ phủ thực tế.

## 27/11/2026 — HOLA Housing P1 tiếp theo

| ID | Trạng thái | Tiêu chí |
|---|---|---|
| HOLA-P1-113 | DA_MERGE_CHUA_DEPLOY #128 (9/9 PASS) | Calculator giá thuê/cọc/điện/nước/xe, không đánh đồng giá chưa biết với 0; mobile, test tính toán. |
| HOLA-P1-114 | DA_MERGE_CHUA_DEPLOY #128 (vai trò tự khai) | Vai trò người đăng tự khai, qua moderation; không tự cấp xác minh chủ sở hữu. Hồ sơ xác minh đầy đủ cần quy trình bằng chứng riêng. |
| HOLA-P1-115 | DANG_LAM | API, UI lịch xem, requester/owner, trạng thái, chống spam, PG + Playwright; chờ CI. |
| HOLA-P1-116 | DANG_LAM | Tin mới + cập nhật room count khi gia hạn, 0 = FULL; hủy lịch tương lai; chờ CI. |
| HOLA-P1-117 | DANG_LAM | Danh sách lịch khách tới tin của tôi/lịch tôi gửi, trạng thái và RBAC. |
| HOLA-P1-118 | DANG_LAM | Metrics first-party opt-in, 30 ngày, retention 90 ngày; lịch xem/lead #129, rate-limit và kiểm thử; WA-005 không thay đổi. |

Các mục P1 trước đây và P0 blockers giữ nguyên; không coi việc merge các module mới là nghiệm thu toàn bộ P1.

| HOLA-P1-119 | DANG_LAM | Đặc điểm BĐS, history, similar, compare; migration 340; CI và nghiệm thu thật trước hoàn thành. |

| HOLA-P1-120 | DANG_LAM | Parser, subtype/furnishing, market grid + monthly snapshots, dòng tiền; chờ CI + cron thực tế. |
| HOLA-P2-121 | DANG_LAM | Lưu góc nhìn/layers local, không GPS/đồng bộ; chờ CI. |


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
