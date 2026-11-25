# BÁO CÁO TIẾN ĐỘ & TRẠNG THÁI — HOLA Maps

> **Chốt kiểm tra:** 25/11/2026 (GMT+7). Sau khi [PR #106](https://github.com/hoanglamvu04/bandohoalac/pull/106) merge, đối chiếu `main` SHA `7eb2078c938fbb7c291ae5ea5c2866db5d36c5fe` và toàn bộ CI/Security của PR #106 PASS. Dữ liệu thay đổi theo Git; khi đọc lần sau cần xác minh lại GitHub.

## Đang phát triển — HOLA-P1-104 (25/11/2026, GMT+7)

- **Nhánh:** `feat/p1-104-housing-amenities-detail-20261125` (PR cần ghi sau khi mở).
- **Trạng thái:** ĐANG LÀM — chờ CI/merge; KHÔNG coi là đã lên `main` hoặc VPS.
- **Nâng cấp:** Trang chi tiết BĐS công khai có tìm tiện ích trong bán kính 500 m / 1 km / 2 km, hiển thị nhóm địa điểm, khoảng cách đường thẳng, link POI, retry và cảnh báo dữ liệu chưa đầy đủ.
- **Phạm vi mã:** component/CSS trang chi tiết, Playwright, tài liệu chức năng. Không đổi schema/API server, tracking, moderation hoặc quyền riêng tư.
- **Kiểm thử:** mới bổ sung test E2E; kết quả CI sẽ đối chiếu trên PR. Không tự nhận PASS trước khi Actions hoàn thành.
- **Phụ thuộc:** đánh giá độ phủ POI và routing thật vẫn là việc cần làm; production backup/restore và WA-005 PR #92 vẫn chưa nghiệm thu.

## Tóm tắt có thể kiểm chứng

- **Repository:** [hoanglamvu04/bandohoalac](https://github.com/hoanglamvu04/bandohoalac), branch chính `main`.
- **Kết quả tại baseline:** GitHub Actions **Hola Maps CI = PASS**, **Security Scan = PASS** trên SHA ở trên.
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
