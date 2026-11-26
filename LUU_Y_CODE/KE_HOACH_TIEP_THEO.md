# KẾ HOẠCH CODE TIẾP THEO — HOLA Maps

> **Rà soát:** 16:57 25/11/2026 GMT+7, `main` `c02640c9ec5399c003f3e1a7fd9115921e5a25d5` sau [PR #113](https://github.com/hoanglamvu04/bandohoalac/pull/113).

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
