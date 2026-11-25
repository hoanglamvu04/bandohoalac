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
| HOLA-P0-004 | DA_MERGE_CHUA_DEPLOY — [PR #108](https://github.com/hoanglamvu04/bandohoalac/pull/108), 9/9 checks PASS | CLI và Admin dùng cùng điều kiện kiểm toán BĐS công khai. Kiểm toán dữ liệu thật chờ ảnh kết quả từ chủ dự án sau khi chạy [lệnh trong runbook](../docs/PUBLIC_LAUNCH_P0_RUNBOOK.md#kiểm-toán-tiện-ích-và-bđs-trên-bản-sao-postgresql) | Ghi số tổng hợp trên bản sao; rà quyền ảnh, tin hết hạn, thiếu liên hệ và giá/diện tích |
| HOLA-P0-005 | CHUA_LAM | Triage các PR đang mở về bảo mật, Cloudinary, auth, test tấn công; không merge hàng loạt | Mỗi PR đối chiếu base, schema, RBAC, tests/CodeQL; có quyết định merge/close và nhật ký |

## P1 — Hoàn thiện các phần sản phẩm chưa nghiệm thu full

| ID | Sprint | Trạng thái | Việc tiếp theo và tiêu chí nghiệm thu |
|---|---|---|---|
| HOLA-P1-101 | 6 | CHUA_LAM | Đo số mẫu theo loại/vùng từ dữ liệu thật, giữ cảnh báo giá chào; không suy ra giá giao dịch khi thiếu dữ liệu |
| HOLA-P1-102 | 7 | DA_MERGE_CHUA_DEPLOY — [PR #113](https://github.com/hoanglamvu04/bandohoalac/pull/113), 9/9 checks PASS | Đợt tiếp theo đo P95, cụm ghim và thao tác Android/iOS thật trên mạng chậm và vùng dày dữ liệu. |
| HOLA-P1-103 | 8 | CHUA_LAM | Kiểm thử từ đăng tin→duyệt→ghim→liên hệ→tạm ẩn→đã giao dịch→báo nghi vấn; không cấp quyền tự xuất bản |
| HOLA-P1-104 | 9 | DA_MERGE_CHUA_DEPLOY — [PR #109](https://github.com/hoanglamvu04/bandohoalac/pull/109), 9 checks PASS | Đưa tiện ích vào trang chi tiết BĐS, chọn 500 m/1 km/2 km, kết quả POI công khai, loading/error/retry, Playwright mobile; tiếp theo đo độ phủ theo khu và chỉ tính thời gian di chuyển khi có routing thật được xác minh |
| HOLA-P1-109 | 9 | DA_MERGE_CHUA_DEPLOY — [PR #111](https://github.com/hoanglamvu04/bandohoalac/pull/111), 9/9 checks PASS | Hiện bằng chứng POI trong 8 nhóm trên trang chi tiết và đo số tin có POI/xác minh gần đây theo khu phục vụ trong 1 km. Kiểm toán dữ liệu thật chờ chủ dự án chạy [lệnh trong runbook](../docs/PUBLIC_LAUNCH_P0_RUNBOOK.md#kiểm-toán-tiện-ích-và-bđs-trên-bản-sao-postgresql) trên bản sao chỉ đọc. Routing chỉ triển khai khi có nguồn được xác minh. |
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

## Công việc gần nhất được ưu tiên

1. **HOLA-P0-003:** làm rõ các bước nghiệm thu còn thiếu của WA-005, giữ PR #92 ở trạng thái chờ nếu chưa có phê duyệt.
2. **HOLA-P0-001 / 002:** chuẩn bị checklist, thu bằng chứng VPS thật trước khi tuyên bố đã public-ready.
3. **HOLA-P0-004 / 005:** xử lý dữ liệu công khai có rủi ro và các PR bảo mật đang mở.
4. Sau P0, chọn từng hạng mục P1 có tiêu chí nghiệm thu thực tế, không triển khai “full” chỉ dựa vào tên Sprint.

### Cách cập nhật kế hoạch

Khi bắt đầu task: gắn ID, đổi sang `DANG_LAM` và ghi PR/dự kiến kiểm thử. Sau code: cập nhật nội dung đã làm, trở ngại, thứ tự ưu tiên, bước tiếp. Khi PR chưa merge **không đổi thành đã merge**. Sau merge phải có phiên cập nhật lại cùng bằng chứng.

**Việc tiếp của HOLA-P1-109:** chạy báo cáo trên bản sao PostgreSQL được cấp quyền, rà nhóm và khu có ít quan sát, đối chiếu với nguồn POI độc lập trước khi kết luận độ phủ thực tế.
