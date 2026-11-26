# HOLA Maps — Ma trận kiểm tra 72 hạng mục (27/11/2026, GMT+7)

Đây là đối chiếu mã nguồn/PR, không phải biên bản nghiệm thu. Trạng thái: MERGED = đã vào main; EXISTING = có code trước phiên; NEW_PR = code mới trong PR/đợt này, không mặc định đã merge hoặc live; PARTIAL = có nền hoặc chỉ một phần; MISSING = chưa code; BLOCKED = cần dữ liệu, phê duyệt hoặc môi trường. #131 đã merge khi ghi file; NEW_PR mô tả phạm vi đợt code, không nói PR vẫn mở. Kiểm tra trạng thái GitHub/CI mới nhất trước mỗi lần tiếp tục. Không coi đủ 72 mục là xong.

| # | Hạng mục | Trạng thái code | Bằng chứng / điều kiện còn thiếu |
|---|---|---|---|
| 01 | Đóng P1 cũ | MERGED | #128–130; PR #131 cũng đã merge; kiểm tra lại main/CI. |
| 02 | E2E đăng/duyệt/hiển thị/liên hệ/đóng tin | PARTIAL | Đã có workflow contribution, lifecycle, reveal, nhiều E2E. Chưa nghiệm thu toàn chuỗi môi trường đích. |
| 03 | Xác minh chủ nhà/môi giới/quản lý | PARTIAL | #128 role tự khai, claim đối tác cũ; chưa quy trình bằng chứng chủ sở hữu/duyệt KYC. |
| 04 | Tách demo và dữ liệu thật | PARTIAL | #120/131/132 và bộ audit loại demo khỏi giá; đối chiếu dữ liệu thật trên DB đích. |
| 05 | Android/iOS/desktop/mạng yếu | BLOCKED | Cần thiết bị, môi trường đích và đo thực tế. CI Playwright không thay thế. |
| 06 | Bảo mật/hiệu năng/production | PARTIAL | Security CI, readiness, runbook; thiếu P95, backup/restore, vận hành đích. |
| 07 | Subtype BĐS | NEW_PR | #131 migration 340, PropertyDetailsFields. |
| 08 | Số tầng/phòng/hướng/mặt tiền/đường vào | NEW_PR | #131 property_details; dữ liệu tự khai, không xác minh. |
| 09 | Pháp lý tự khai/đã xác minh | PARTIAL | #131 enum tự khai; không có xác minh hồ sơ pháp lý thật. |
| 10 | Lọc nội thất/tiện nghi/giờ giấc/đối tượng | PARTIAL | #131/132 subtype, furnishings, amenities; thiếu toàn bộ lọc giờ giấc/đối tượng. |
| 11 | Một tòa nhiều loại phòng/inventory một pin | MISSING | Cần mô hình building–unit type–inventory, lifecycle và migration test. |
| 12 | Lịch sử giá và tình trạng phòng | NEW_PR | #131 history trigger; không hồi tố. Cần nghiệm thu migration trên DB thật. |
| 13 | Tìm không dấu và sửa lỗi | PARTIAL | Postgres hola_unaccent, tìm kiếm cũ và #132 parser; typo recovery đầy đủ chưa làm. |
| 14 | Tìm theo nhu cầu tự nhiên | NEW_PR | #132 parser quy tắc có giới hạn; không phải LLM. |
| 15 | Xếp hạng theo ngân sách/tiện nghi/khoảng cách | PARTIAL | Sort, bộ lọc và ranking discovery có sẵn; chưa cá nhân hóa/đánh giá relevance. |
| 16 | Tin tương tự | NEW_PR | #131 getSimilarHousing, detail panel. |
| 17 | So sánh chi phí/tiện ích | PARTIAL | #131 so sánh chi phí, amenities API cũ; chưa mọi tiêu chí và UX tiện ích ngang nhau. |
| 18 | Lưu tìm kiếm và cảnh báo | PARTIAL | #131/132 mở rộng bộ lọc lưu; matcher và notification đã có; cần cron thực tế. |
| 19 | Heatmap giá bán/m² | PARTIAL | #132 lưới màu theo viewport, không phải polygon overlay địa lý hoàn chỉnh. |
| 20 | Heatmap giá thuê | PARTIAL | #132 lưới màu giá thuê/tháng, chưa overlay. |
| 21 | Giá chào theo khu/loại | NEW_PR | Market insights cũ + #132 grid, ngưỡng mẫu; cần dữ liệu thật. |
| 22 | Xu hướng tháng | NEW_PR | #132 migration 350 snapshot từ lần chạy thật, không backfill. |
| 23 | Cảnh báo giá bất thường | NEW_PR | #135 price-reference, ngưỡng ≥8 mẫu; không phán định gian lận. |
| 24 | Dòng tiền/hoàn vốn | NEW_PR | #132 calculator theo giả định người dùng. |
| 25 | Vẽ vùng tìm kiếm | NEW_PR | #133 polygon PostGIS, kết quả riêng tối đa 30, không thay pin cũ. |
| 26 | Bật nhiều lớp dữ liệu | EXISTING | MapPage / MapView layer toggles; cần thử thiết bị. |
| 27 | POI dọc tuyến | NEW_PR | #133 corridor trên geometry OSRM, khoảng cách thẳng không phải detour. |
| 28 | Thời gian đi thực | EXISTING | TravelTimeDiscovery, OSRM routing; cần kiểm tra dịch vụ đích. |
| 29 | Lưu vùng/góc nhìn | NEW_PR | #132 bookmark browser-only, 10 góc nhìn/layers; chưa đồng bộ. |
| 30 | Cụm/cache/viewport | PARTIAL | MapLibre clusters, bounded requests/cache; thiếu benchmark thực địa. |
| 31 | Lớp khu đô thị/dự án | PARTIAL | Map editor/BUILDING/LANDMARK/PLANNING; chưa taxonomy dự án và inventory chính thức. |
| 32 | Trường/đại học/KCN | PARTIAL | Danh mục, campus/anchor hiện có; chưa kiểm kê đủ nguồn. |
| 33 | Y tế/thương mại/công cộng | PARTIAL | Danh mục POI sẵn; độ phủ cần dữ liệu thực. |
| 34 | Hạ tầng đang triển khai | BLOCKED | Lớp ROAD/ALERT hỗ trợ; cần danh mục dự án, mốc và nguồn hợp pháp. |
| 35 | Quy hoạch có nguồn/ngày/scope | BLOCKED | PLANNING layer đã có; cần nguồn chính thức, quyền sử dụng, quality gate provenance. |
| 36 | Hồ sơ khu vực | PARTIAL | #133 viewport category summary; không phải ranh giới hành chính. |
| 37 | Tuyến/bến xe buýt | BLOCKED | Danh mục giao thông; cần GTFS/lịch tuyến hợp pháp, import và kiểm thử. |
| 38 | Bãi xe/xăng/sạc | PARTIAL | Danh mục hiện hữu + #133 corridor; kiểm kê độ phủ. |
| 39 | Ngập/tắc đường/công trình | PARTIAL | FLOOD/ROAD_CLOSURE/ALERT + cộng đồng; chưa dữ liệu giao thông realtime. |
| 40 | Xác nhận tình trạng đường | EXISTING | roadStatus.service, community confirmations; cần thực địa. |
| 41 | Gợi ý tuyến đường | EXISTING | OSRM direction, hazard annotation; không bảo đảm tuyến an toàn. |
| 42 | Lịch trình nhiều điểm | EXISTING | TripPlanner, OSRM trip/optimization. |
| 43 | Hồ sơ doanh nghiệp | EXISTING | Place detail, PartnerDashboard, owner edits. |
| 44 | Xác minh quyền quản lý doanh nghiệp | PARTIAL | placeClaim review và place_managers; không thay thế kiểm chứng giấy tờ. |
| 45 | Danh mục dịch vụ/bảng giá | NEW_PR | #134 active partner catalog; create/ẩn, chưa edit đầy đủ. |
| 46 | Khuyến mại/voucher | EXISTING | Partner vouchers, rewards, redemption; cần đối tác thật. |
| 47 | Thống kê hiệu quả doanh nghiệp | PARTIAL | #134 30-day request counts, voucher dashboard cũ; chưa toàn funnel/attribution. |
| 48 | Yêu cầu tư vấn/đặt lịch | NEW_PR | #134 service appointment request + private inbox, không thanh toán. |
| 49 | Feed cộng đồng địa phương | PARTIAL | #134 danh sách sự kiện/cảnh báo từ mapData đang tải; chưa feed bài cộng đồng đầy đủ. |
| 50 | Hỏi đáp POI | MISSING | Cần Q&A schema, moderation, report, antispam. |
| 51 | Sự kiện địa phương | PARTIAL | EVENT layer + #134 list; cần event submission/review, nguồn thực tế. |
| 52 | Đánh giá/ảnh | EXISTING | PlaceReviews/Contribution/HALO; quyền ảnh phải kiểm tra. |
| 53 | Hạng/nhiệm vụ cộng tác | EXISTING | Reputation, leaderboard, missions. |
| 54 | Chống spam/fraud/điểm thưởng | PARTIAL | Rate limiting, trust, moderation, voucher guard; chưa kiểm toán abuse end-to-end. |
| 55 | 80Land đồng bộ có phép | BLOCKED | Chưa có thỏa thuận, hợp đồng API/sandbox/credential và phạm vi dữ liệu. Không scrape. |
| 56 | Trùng tin đa nguồn | PARTIAL | realEstateDuplicates + Data Trust V5; thử nghiệm partner real pending. |
| 57 | Nguồn/quyền ảnh/sync provenance | PARTIAL | external_source, ingestion, consent, Data Trust; thiếu partner-specific license/retention evidence. |
| 58 | Đô Thị Hòa Lạc tin tức | BLOCKED | Cần interface/cross-site editorial contract và feed chính thức; không bịa bài. |
| 59 | Kiến Trúc Hòa Lạc lead | BLOCKED | Cần approved endpoint, explicit consent, routing owner và retention. |
| 60 | X-HUB WA-005 | BLOCKED | PR #92 chờ nghiệm thu database/nguồn và chấp thuận X-HUB. Không tự merge. |
| 61 | SEO khu vực/xã/cụm dân cư | PARTIAL | local_seo_pages, editorial gate, sitemap; cần coverage/nội dung thật. |
| 62 | SEO nhà đất/phòng trọ | PARTIAL | Housing publication gate, local SEO hiện có; chưa đầy đủ trang chủ đề. |
| 63 | SEO tiện ích campus | PARTIAL | Campus local SEO templates; cần đủ ảnh, POI, nội dung. |
| 64 | Sitemap có gate | EXISTING | listLocalSeoSitemapEntries, server HTML, sitemap tests. |
| 65 | Internal linking | PARTIAL | Nearby detail, explore/local landing links; chưa audit toàn site. |
| 66 | Dashboard index/keyword/errors | PARTIAL | #135 filter, index eligibility internal, CSV; chưa Search Console thật. |
| 67 | AI hội thoại tìm kiếm | PARTIAL | #132 parser local; chưa LLM/API/đánh giá chất lượng/chi phí. |
| 68 | AI hỗ trợ soạn tin | PARTIAL | #135 quy tắc local từ form, preview/consent; không phải LLM. |
| 69 | AI kiểm duyệt nghi vấn/ảnh trùng | PARTIAL | Data Trust, photo scanner, #135 price flag; chưa AI provider/eval, không tự kết luận. |
| 70 | Tin nổi bật có nhãn quảng cáo | PARTIAL | AdvertisementCarousel/admin ads; chưa sponsored property product/label riêng. |
| 71 | Gói chủ trọ/doanh nghiệp | BLOCKED | Cần bảng giá, điều khoản, entitlement, chính sách thanh toán và hóa đơn. |
| 72 | Gói dữ liệu/API đối tác | PARTIAL | Developer API/embed/public integration cũ; chưa gói trả phí, SLA và cấp quyền dữ liệu tổng hợp. |

## Cổng nghiệm thu chung
- Merge theo thứ tự #132 → #133 → #134 → #135 sau CI/Security thành công (đối chiếu head SHA). Không bypass gate.
- Backup/restore, migration 310–360, rollback và test trên staging/DB bản sao. Chỉ chủ dự án triển khai VPS theo AGENTS.md. Không seed DEMO vào production.
- Chưa có xác minh live, thiết bị vật lý, đủ mẫu dữ liệu, hợp đồng 80Land, feed DTHL/KTHL, Search Console, AI provider, thu tiền hoặc chấp thuận WA-005.
- Ưu tiên sau khi CI: #11 building/inventory; #03 KYC; #50 Q&A; #70 quảng cáo BĐS riêng; #13–15 relevance/typo; #19–20 overlay; kế hoạch import nguồn chính thức và QA staging. Các mục phụ thuộc không đánh dấu hoàn thành.
