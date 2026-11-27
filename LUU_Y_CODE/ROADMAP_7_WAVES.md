# HOLA Maps — 7 waves / 36 hạng mục chức năng

Snapshot tại lúc tạo PR nghiệm thu ngày 27/11/2026 (GMT+7). MERGED = mã đã vào main và CI xác nhận, EXISTING = đã có nền code từ trước, PARTIAL = còn phạm vi chưa xong, PR #142 = code đang chờ gate. Không phải biên bản nghiệm thu production. Kiểm tra lại GitHub trước khi báo cáo.

| # | Hạng mục | Trạng thái | Bằng chứng / giới hạn |
|---|---|---|---|
| 01 | Sửa PR 136 | MERGED | Migration 370, CI 9/9; #136. |
| 02 | Quản lý nhiều loại phòng | MERGED | #136 danh mục loại phòng theo tin. |
| 03 | Lọc phòng theo giá/diện tích/phòng trống | MERGED | #136 cùng một loại phòng và saved search. |
| 04 | Kiểm tra vai trò người đăng | PR #142 | Duyệt/thu hồi/hết hạn; cần nhân viên kiểm tra ngoài hệ thống, không KYC/pháp lý. |
| 05 | Nhắc xác nhận tin | EXISTING | housing:remind, expiry 30 ngày; kiểm tra cron VPS. |
| 06 | Báo cáo tin sai/nghi vấn | EXISTING | Contribution/report và moderation; nghiệm thu từng trường hợp hết phòng. |
| 07 | Tìm không dấu/sai chính tả | MERGED | #138 xếp hạng gần đúng; chưa benchmark relevance. |
| 08 | Gợi ý khi gõ | EXISTING | MapSearchV2; kiểm tra trên thiết bị. |
| 09 | Tìm POI, dịch vụ, BĐS | PARTIAL | #138 thêm title dịch vụ; các vertical đã có, chưa xếp hạng trộn thống nhất. |
| 10 | Xếp hạng relevance | PARTIAL | #138 heuristic; chưa tập đánh giá thực tế. |
| 11 | Lịch sử tìm kiếm | MERGED | #138 opt-in local, xóa lịch sử. |
| 12 | Gợi ý theo sở thích | PARTIAL | #138 danh mục yêu thích do người dùng chọn; chưa recommendation cá nhân hóa. |
| 13 | Tìm lại trong vùng | EXISTING | Viewport query/reset và #133 polygon; giữ nguyên. |
| 14 | Bộ lọc nhanh | MERGED | #139 Housing/Food. |
| 15 | Heatmap địa lý | MERGED | #139 polygon overlay, ngưỡng mẫu, loại demo. |
| 16 | Xem nhanh | EXISTING | Map place inspector. |
| 17 | Chia sẻ vùng/bộ lọc | MERGED | #139 chia sẻ camera và allowlist filter. |
| 18 | Hiệu năng bản đồ | PARTIAL | Cluster/cache/list virtualization; chưa đo tải thực tế/mobile. |
| 19 | Điểm chất lượng dữ liệu | EXISTING | Data Trust quality score. |
| 20 | Trùng địa điểm/ảnh | EXISTING | Duplicate scanner; cần người duyệt và benchmark. |
| 21 | Sai tọa độ | EXISTING | Coverage/quality audit. |
| 22 | Hàng chờ thiếu thông tin | MERGED | #140 lọc vấn đề/ưu tiên/danh mục/tên. |
| 23 | Sửa và duyệt hàng loạt | PARTIAL | #140 chọn/xuất CSV; chưa batch write/review có rollback. |
| 24 | Lịch sử và khôi phục | EXISTING | Place revision/rollback; kiểm tra phục hồi ở staging. |
| 25 | Feed cộng đồng theo vùng | PARTIAL | #140 feed sự kiện/cảnh báo; chưa feed bài viết tổng quát. |
| 26 | Theo dõi địa điểm/khu vực | PARTIAL | Favorites/collections và saved map views; chưa follow timeline/push. |
| 27 | Hỏi đáp kiểm duyệt | MERGED | #136 hỏi/trả lời/báo cáo/hàng chờ. |
| 28 | Đóng góp sự kiện | PR #142 | Duyệt nguồn/venue/time, thu hồi; chưa dữ liệu thực. |
| 29 | Nhiệm vụ CTV | EXISTING | Mission và contribution flow. |
| 30 | Uy tín/chống spam | PARTIAL | Trust/rate limits và moderation; chưa abuse/load audit đầy đủ. |
| 31 | SEO thuê quanh FPT/ĐHQG | PARTIAL | #141 2 bản nháp; ĐHQG thiếu mốc xác minh, xuất bản cần dữ liệu/editor. |
| 32 | SEO vùng/xã | PARTIAL | Local SEO draft/gate/sitemap; chưa đủ từng vùng. |
| 33 | SEO ăn uống/vui chơi | PARTIAL | Explore và nội dung theo danh mục; không bịa xếp hạng/nội dung. |
| 34 | SEO chi tiết | MERGED | #141 noindex/contact redaction; nền SEO canonical đã có. |
| 35 | PWA/thông báo | PARTIAL | #141 offline shell an toàn, shortcut; chưa nghiệm thu cài đặt thiết bị/Web Push. |
| 36 | Báo cáo nhu cầu tìm kiếm | PARTIAL | #141 request count theo cửa sổ 15 phút, không phải unique user; chưa lịch sử dài hạn. |

## Đợt 7 — HOLA-P0-134
- Bộ smoke chỉ đọc và unit tests; xem `docs/RELEASE_7_WAVES_RUNBOOK.md`.
- Staging, backup đã xác minh/restore drill, thiết bị thực, P95 và kiểm tra quyền/nguồn thực tế vẫn là cổng độc lập. Chưa triển khai VPS trong phiên này.
- WA-005/X-HUB, 80Land, nguồn quy hoạch, dịch vụ trả phí và Google Search Console cần quyền/nguồn và nghiệm thu riêng. Không seed dữ liệu DEMO vào production.
