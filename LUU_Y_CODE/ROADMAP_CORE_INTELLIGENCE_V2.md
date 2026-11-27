# HOLA Core Intelligence V2 — Backend, thuật toán và hệ thống

> Lập kế hoạch: 16:04 27/11/2026 GMT+7. Baseline Git đã xác minh: `main` `526f774f7a721ff45906dd64de49c74e3e23625d`, PR #143 đã merge. **60/60 hạng mục được lập kế hoạch, chưa đánh dấu triển khai.** Các nền chức năng đã có từ roadmap cũ phải được đối chiếu trước khi sửa. Không suy diễn đã deploy hoặc nghiệm thu VPS từ Git/CI hay nhận xét trải nghiệm của người dùng.

> Đồng bộ 17:05 27/11/2026: main `509b077d56685f861a62ad5c4b9d5303a9a4afe6` đã merge #145 Desktop header V4. Dải ID V2 đổi thành 301–310 để tránh trùng HOLA-P1-135; mọi phạm vi và thứ tự giữ nguyên.

## 1. Phạm vi và thứ tự

- Giữ Node.js/Express + PostgreSQL 16/PostGIS (modular monolith); không chuyển microservices, không viết lại hệ thống đang chạy. Redis chỉ cân nhắc sau khi có số đo và chủ dự án duyệt hạ tầng. Ưu tiên khoảng 90% backend/DB/thuật toán/test, 10% admin UI cần thiết; không redesign public UI.
- **Thứ tự:** 1 → 2 → 3 → 10 (nền tảng), sau đó 4 → 5 → 6 → 7 → 8 → 9. Cổng P0 hiện hành, bảo mật và privacy được áp dụng ngay từ công việc đầu, không chờ đến đợt 10.
- Giữ nguyên [ROADMAP_72](ROADMAP_72.md), [ROADMAP_7_WAVES](ROADMAP_7_WAVES.md) và backlog P0/P1/P2 cũ. Một số hạng mục là nâng cấp code sẵn có; không làm lại hoặc tự đóng việc cũ. PR #56 (Housing V3), #57 (security), #54 (backup) và #92 (WA-005) cùng các PR cũ/dependencies đang mở cần đối chiếu; không tự merge theo roadmap này.
- Mỗi đợt có ID chính; mỗi hạng mục có ID con 01–60 và trạng thái **CHUA_LAM** (nghĩa là phạm vi nâng cấp V2 chưa thực hiện/đối chiếu đầy đủ, không khẳng định tính năng nền chưa có). Khi nhận task, ghi hiện trạng code, phạm vi thực hiện, phụ thuộc, kiểm thử, PR, SHA, blocker; nếu một phần đã có, giữ lại và nêu phần còn thiếu.

## 2. Danh sách 10 đợt / 60 hạng mục

### Đợt 1 — Database Intelligence (`HOLA-P1-301`)

**Ưu tiên:** Nền tảng — thứ 1.  
**Phụ thuộc:** P0 backup/restore và DB staging có dữ liệu đại diện; đo baseline trước mọi thay đổi.  
**Nghiệm thu:** Schema/FK/unique/index audit có bằng chứng; EXPLAIN (ANALYZE, BUFFERS) trên staging cho truy vấn trọng điểm; benchmark trước/sau, kiểm thử migration PG16/PostGIS, cursor ổn định; không đánh đổi tính đúng để lấy tốc độ.

| ID con | Hạng mục | Yêu cầu thực hiện | Trạng thái V2 |
|---|---|---|---|
| HOLA-P1-301.01 | Kiểm toán database, quan hệ bảng và ràng buộc dữ liệu | Kiểm kê schema/migrations, FK/UNIQUE/CHECK, orphan và invariant nghiệp vụ; ghi lỗi theo mức độ, không tự xóa dữ liệu. | CHUA_LAM |
| HOLA-P1-301.02 | Tối ưu index PostgreSQL/PostGIS và truy vấn phổ biến | Đo selectivity, index thừa/thiếu, truy vấn spatial; lập migration additive và kiểm tra lock/index size. | CHUA_LAM |
| HOLA-P1-301.03 | Phân tích truy vấn chậm bằng EXPLAIN ANALYZE | Chạy trên DB kiểm thử, ưu tiên read-only; không chạy ANALYZE cho write ở production. | CHUA_LAM |
| HOLA-P1-301.04 | Tối ưu connection pool, statement timeout | Chốt ngân sách kết nối theo tài nguyên VPS; timeout, queue, rollback/cleanup và load test. | CHUA_LAM |
| HOLA-P1-301.05 | Bảng tổng hợp thống kê | Chọn materialized/aggregate theo phép đo, cập nhật idempotent, đối chiếu source, freshness/retention. | CHUA_LAM |
| HOLA-P1-301.06 | Phân trang cursor | Keyset sort ổn định có tie-breaker, validation cursor, tương thích API cũ, chống lọt bản ghi khi cập nhật. | CHUA_LAM |

### Đợt 2 — Backend Performance Engine (`HOLA-P1-302`)

**Ưu tiên:** Nền tảng — thứ 2.  
**Phụ thuộc:** Đợt 1 và baseline API/DB; audit cache hiện hữu.  
**Nghiệm thu:** Cache key đúng filter/scope, invalidation khi publish/revoke; không cache response riêng tư; request coalescing bounded; benchmark P95/error trên cùng fixture và concurrency; không breaking API.

| ID con | Hạng mục | Yêu cầu thực hiện | Trạng thái V2 |
|---|---|---|---|
| HOLA-P1-302.07 | Cache nhiều tầng API công khai | TTL, capacity, key chuẩn, chỉ public payload; đo hit/miss, bộ nhớ và cold/warm latency. | CHUA_LAM |
| HOLA-P1-302.08 | Tự động làm mới cache khi dữ liệu đổi | Invalidate sau commit, version/TTL; moderation, expiry và thu hồi quyền không để dữ liệu cũ công khai. | CHUA_LAM |
| HOLA-P1-302.09 | Gộp request giống nhau đang chạy | Single-flight bounded, timeout/cancel phù hợp, không gộp qua quyền truy cập hoặc user khác. | CHUA_LAM |
| HOLA-P1-302.10 | Chuẩn hóa API response, lỗi, request ID | Giữ contract client hiện tại, mã lỗi nhất quán, log request ID không lộ stack/secrets/PII. | CHUA_LAM |
| HOLA-P1-302.11 | Giới hạn truy vấn nặng | Cap viewport/geometry/limit/filter/timeout, throttle, tránh N+1, test input bất thường. | CHUA_LAM |
| HOLA-P1-302.12 | Load test và phát hiện regression | Dataset staging giả lập có nhãn, kịch bản cold/warm, concurrency, báo cáo percentile và lỗi, baseline có phiên bản. | CHUA_LAM |

### Đợt 3 — Background Job Engine (`HOLA-P1-303`)

**Ưu tiên:** Nền tảng — thứ 3.  
**Phụ thuộc:** Đợt 1–2, kiểm kê housing:expire/remind/match-alerts, soft-launch:prune, cron và backup; migration staging.  
**Nghiệm thu:** Worker có lease/lock và recovery, thử lỗi/crash/concurrency, retry có giới hạn; side effect idempotent; admin phân quyền; không gửi thật trong test; kế hoạch chuyển cron tránh chạy trùng.

| ID con | Hạng mục | Yêu cầu thực hiện | Trạng thái V2 |
|---|---|---|---|
| HOLA-P1-303.13 | Hàng đợi tác vụ nền lưu trong DB | Job type/payload allowlist, scheduled/queued/running/succeeded/failed, lease, claim atomically và retention. | CHUA_LAM |
| HOLA-P1-303.14 | Retry với backoff | Phân loại lỗi, exponential backoff+jitter, max attempts, dead-letter, không retry vô hạn. | CHUA_LAM |
| HOLA-P1-303.15 | Khóa chống chạy trùng/gửi trùng | Idempotency key, dedupe uniqueness, transactional outbox khi phù hợp; không tuyên bố exactly-once qua external provider. | CHUA_LAM |
| HOLA-P1-303.16 | Thông báo theo sự kiện nghiệp vụ | Tái dùng notification/opt-in hiện hữu; gửi khi có sự kiện được phép, không lưu/sao chép liên hệ tùy tiện. | CHUA_LAM |
| HOLA-P1-303.17 | Lịch sử chạy và lỗi | Duration, attempts, run ID, lỗi đã redact, heartbeat/lag, retention và metric không chứa PII. | CHUA_LAM |
| HOLA-P1-303.18 | API quản trị worker, lịch và job lỗi | RBAC, danh sách, retry có xác nhận/audit, allowlist job; không thực thi arbitrary command. | CHUA_LAM |

### Đợt 4 — HOLA Search Engine V7 (`HOLA-P1-304`)

**Ưu tiên:** Thuật toán — thứ 5.  
**Phụ thuộc:** Đợt 1–3 và kiểm soát Governance cơ bản; tái dùng Smart Search V6, pg_trgm/unaccent, housing parser, route engine.  
**Nghiệm thu:** Golden queries tiếng Việt có version/expected results, đo Recall@K/NDCG@K và latency; không bịa kết quả, điều kiện thiếu dữ liệu phải báo unknown; chỉ public/active/authorized inventory.

| ID con | Hạng mục | Yêu cầu thực hiện | Trạng thái V2 |
|---|---|---|---|
| HOLA-P1-304.19 | Kết hợp Full-text Search và Trigram | Candidate generation bounded, exact match/diacritics/typo, cấu hình tiếng Việt phù hợp, index và benchmark. | CHUA_LAM |
| HOLA-P1-304.20 | Từ điển địa phương, tên cũ/viết tắt/đồng nghĩa | Alias có nguồn, phạm vi thời gian, admin duyệt; không tự suy diễn địa danh hành chính. | CHUA_LAM |
| HOLA-P1-304.21 | Nhận diện ý định tiếng Việt | Tách loại tài sản, giá, diện tích, tiện nghi, landmark, thời gian đi; xử lý phủ định/mơ hồ; không gọi AI ngoài khi chưa duyệt. | CHUA_LAM |
| HOLA-P1-304.22 | Xếp hạng thống nhất POI/dịch vụ/BĐS | Candidate theo vertical, chuẩn hóa score, cùng quyền/availability và tránh trùng thực thể. | CHUA_LAM |
| HOLA-P1-304.23 | Gợi ý/sửa lỗi/truy vấn không kết quả | Autocomplete bounded, đề xuất nới điều kiện minh bạch; không tự đổi ngân sách/ý định. | CHUA_LAM |
| HOLA-P1-304.24 | Bộ đánh giá tìm kiếm | Fixture có dấu/không dấu, typo, địa danh, dịch vụ, BĐS; baseline, expected order, relevance metrics. | CHUA_LAM |

### Đợt 5 — HOLA Ranking Engine (`HOLA-P1-305`)

**Ưu tiên:** Thuật toán — thứ 6.  
**Phụ thuộc:** Đợt 4; dữ liệu chất lượng/đánh giá hợp lệ và kết quả kiểm thử; không trộn paid placement vào organic score.  
**Nghiệm thu:** Score phiên bản hóa, deterministic và giải thích được; benchmark theo vertical, test missing data/abuse/diversity; không penalize dữ liệu chưa xác minh như gian lận; sở thích opt-in.

| ID con | Hạng mục | Yêu cầu thực hiện | Trạng thái V2 |
|---|---|---|---|
| HOLA-P1-305.25 | HOLA Rank thống nhất, có phiên bản | Baseline trọng số 30 relevance/25 trust/20 access/10 freshness/10 reviews/5 completeness; hiệu chỉnh bằng benchmark, không mặc định đây là trọng số cuối. | CHUA_LAM |
| HOLA-P1-305.26 | Trọng số Food/Housing/Education/Business | Profile theo nhu cầu; ghi rõ feature, unknown handling, normalization và phiên bản. | CHUA_LAM |
| HOLA-P1-305.27 | Giảm thao túng đánh giá | Bayesian shrinkage/recency/trust signals hợp lý; đánh dấu nghi vấn để review, không tự cáo buộc. | CHUA_LAM |
| HOLA-P1-305.28 | Đa dạng kết quả | Giới hạn kết quả trùng tài sản/chủ đăng khi thích hợp; vẫn tôn trọng relevance và quyền riêng tư. | CHUA_LAM |
| HOLA-P1-305.29 | Giải thích lý do đề xuất | Các lý do có thật từ dữ liệu, không công bố private signals hay vị trí cá nhân. | CHUA_LAM |
| HOLA-P1-305.30 | Gợi ý theo sở thích chủ động | Tùy chọn danh mục/điều kiện explicit, có reset; không profiling ẩn, không suy luận thông tin nhạy cảm. | CHUA_LAM |

### Đợt 6 — Geospatial Intelligence (`HOLA-P1-306`)

**Ưu tiên:** Thuật toán — thứ 7.  
**Phụ thuộc:** Đợt 1–4, PostGIS/OSRM đang có, kiểm tra điều khoản nguồn và năng lực VPS; Vector Tiles/isochrone chỉ khi dữ liệu và phép đo phù hợp.  
**Nghiệm thu:** Kiểm thử CRS/SRID, bounds, edge cases và độ chính xác, cap geometry/tiles; privacy và public-only; phân biệt estimate, đường thẳng và thời gian theo routing; đo transfer/P95 trước sau.

| ID con | Hạng mục | Yêu cầu thực hiện | Trạng thái V2 |
|---|---|---|---|
| HOLA-P1-306.31 | Phân vùng dữ liệu theo lưới | Grid key ổn định, nhiều độ phân giải; phân biệt lưới và ranh hành chính, ngưỡng mẫu. | CHUA_LAM |
| HOLA-P1-306.32 | Phân cụm backend theo zoom | Cluster deterministic trong viewport, cap count, drilldown; kiểm tra trùng/thiếu khi chuyển zoom. | CHUA_LAM |
| HOLA-P1-306.33 | Vector Tiles lớp lớn | ST_AsMVT hoặc cơ chế tương thích sau benchmark, cache/invalidation, public-only và tile-size limit. | CHUA_LAM |
| HOLA-P1-306.34 | Vùng tiếp cận theo thời gian | Isochrone từ mạng đường/routing phù hợp, mode/thời điểm/giả định rõ, không giả lập thành dữ liệu thật. | CHUA_LAM |
| HOLA-P1-306.35 | Chỉ số tiếp cận tiện ích | Trường/y tế/mua sắm/giao thông, coverage/source/freshness, không khẳng định chất lượng dịch vụ chỉ từ khoảng cách. | CHUA_LAM |
| HOLA-P1-306.36 | Cache ma trận khoảng cách/thời gian/tuyến | Bounded key theo điểm công khai và mode, TTL nguồn, không lưu GPS cá nhân trong analytics. | CHUA_LAM |

### Đợt 7 — Data Trust Engine V7 (`HOLA-P1-307`)

**Ưu tiên:** Dữ liệu — thứ 8.  
**Phụ thuộc:** Đợt 1–3, audit Data Trust V5/V6, revision history, duplicate/image scanner và quyền CTV/Admin.  
**Nghiệm thu:** Precision/recall trên tập cặp có nhãn, không tự xóa/gộp; preview diff, duyệt có quyền, revision/rollback được test staging, nguồn/quyền ảnh rõ; giới hạn truy cập PII.

| ID con | Hạng mục | Yêu cầu thực hiện | Trạng thái V2 |
|---|---|---|---|
| HOLA-P1-307.37 | Phát hiện trùng tên/địa chỉ/điện thoại/tọa độ | Blocking theo vùng/loại, chuẩn hóa có kiểm soát, đối chiếu private signals nội bộ; phân biệt từng căn/tòa. | CHUA_LAM |
| HOLA-P1-307.38 | Perceptual hash ảnh | So khớp ảnh đã được phép xử lý, bounded/timeout, test crop/resize và false positive. | CHUA_LAM |
| HOLA-P1-307.39 | Mã định danh thống nhất giữa nguồn | Canonical place ID + source external ID, uniqueness, namespace, sync/lineage. | CHUA_LAM |
| HOLA-P1-307.40 | Provenance từng trường dữ liệu | Nguồn, thời điểm, người duyệt, quyền sử dụng và freshness; không gán VERIFIED tự động. | CHUA_LAM |
| HOLA-P1-307.41 | Gộp trùng có duyệt/hoàn tác | Preview, kiểm tra FK/references, audit, transactional merge/revision, rollback drill; không xóa cứng dữ liệu thật. | CHUA_LAM |
| HOLA-P1-307.42 | Tạo nhiệm vụ rà soát | Quality threshold/TTL, dedupe task, phân công CTV/Admin, không công khai nghi vấn chưa kiểm tra. | CHUA_LAM |

### Đợt 8 — Housing Core V3 (`HOLA-P1-308`)

**Ưu tiên:** Dữ liệu — thứ 9.  
**Phụ thuộc:** Đợt 1–3/7; #136 room types, #128–130, #142 role review, old open #56 cần đối chiếu để tránh chồng chéo; migration tương thích một ghim hiện tại.  
**Nghiệm thu:** Schema asset/building/unit type/unit additive/backfill trên staging; không mất dữ liệu; race/ownership/RBAC test, public fields sanitized; pin/sort/filter đúng, không biến yêu cầu lịch hẹn thành booking bảo đảm.

| ID con | Hạng mục | Yêu cầu thực hiện | Trạng thái V2 |
|---|---|---|---|
| HOLA-P1-308.43 | Tài sản/tòa nhà/loại phòng/từng căn | Canonical building + unit identifiers, mapping legacy listing/room_types, giữ một ghim, kiểm tra migration trước khi chuyển read path. | CHUA_LAM |
| HOLA-P1-308.44 | Tồn phòng và concurrent update | Optimistic version/transactional locks, invariant count, availability, audit và xung đột; không overbook. | CHUA_LAM |
| HOLA-P1-308.45 | Nhiều người đăng cùng tài sản | Ownership/manager/agent scope, listing riêng, review claims/revocation; không xác minh pháp lý tự động. | CHUA_LAM |
| HOLA-P1-308.46 | Trùng tin giữa môi giới | Cùng asset/unit, price/area/photo/contact signal nội bộ, review threshold; không tự hợp nhất khác căn. | CHUA_LAM |
| HOLA-P1-308.47 | Điểm phù hợp nhu cầu từng phòng | Hard constraints cùng unit type, mềm theo giá/diện tích/tiện nghi/access, unknown rõ ràng. | CHUA_LAM |
| HOLA-P1-308.48 | Lead, lịch xem, lịch sử xử lý | Tái dùng viewings/consented metrics, lifecycle, quyền từng tài nguyên và retention; không thêm PII không cần thiết. | CHUA_LAM |

### Đợt 9 — Real Estate Market Intelligence (`HOLA-P1-309`)

**Ưu tiên:** Dữ liệu — thứ 10.  
**Phụ thuộc:** Đợt 1–3/6/7/8, nguồn dữ liệu thật đủ mẫu, provenance, snapshot cron; thống kê nhu cầu cần consent/retention và ngưỡng riêng tư.  
**Nghiệm thu:** Chỉ giá chào/tin đang đủ điều kiện; loại DEMO và nguồn không được phép, chống đếm trùng, ngưỡng mẫu theo phân nhóm; không backfill lịch sử giả; công thức/giả định rõ, dữ liệu nhỏ trả insufficient.

| ID con | Hạng mục | Yêu cầu thực hiện | Trạng thái V2 |
|---|---|---|---|
| HOLA-P1-309.49 | Trung vị, P25, P75 | Cùng loại/giao dịch/vùng, đơn vị nhất quán, sample count/date và suppression. | CHUA_LAM |
| HOLA-P1-309.50 | Đối chiếu tài sản tương đồng | Comparable theo loại, diện tích, tiện nghi/vị trí và freshness, loại bản sao; không gọi định giá chính thức. | CHUA_LAM |
| HOLA-P1-309.51 | Biến động và giá bất thường | Robust quantiles/MAD hoặc tương đương có ngưỡng kiểm thử, cảnh báo review chứ không kết luận lừa đảo. | CHUA_LAM |
| HOLA-P1-309.52 | Biến động nguồn cung phòng trọ | Snapshot từ lần đo thật, phân biệt tin và số phòng, series có coverage/missing; không dựng lịch sử. | CHUA_LAM |
| HOLA-P1-309.53 | Nhu cầu tìm kiếm theo vùng/ngân sách | Chỉ aggregate có phép và đủ mẫu, bucket thô, không lưu query/GPS/user identifiers, không đồng nhất request với người dùng. | CHUA_LAM |
| HOLA-P1-309.54 | Mô phỏng đầu tư/lấp đầy/hoàn vốn | Tái dùng calculator, scenario từ giả định người dùng, chi phí vận hành/vốn, sensitivity; không bảo đảm lợi nhuận. | CHUA_LAM |

### Đợt 10 — System Governance & Integration (`HOLA-P0-310`)

**Ưu tiên:** Nền tảng — thứ 4; kiểm soát P0 áp dụng ngay từ đầu.  
**Phụ thuộc:** Các P0 launch gate hiện hành không bị thay thế; audit PR #54/#57/#92 và deps đang mở; 80Land/X-HUB/XSPACE cần phê duyệt, hợp đồng và credential/sandbox riêng.  
**Nghiệm thu:** Test auth/RBAC/IDOR/2FA/rate limit; không lộ PII/contact/token; audit retention, backup offsite + isolated restore drill, incident runbook; external integration BLOCKED đến khi có quyền, chưa merge WA-005 tự động.

| ID con | Hạng mục | Yêu cầu thực hiện | Trạng thái V2 |
|---|---|---|---|
| HOLA-P0-310.55 | Kiểm toán RBAC/IDOR theo API và tài nguyên | Ma trận role/resource, cross-account/owner/manager/CTV negative tests, admin security, không tự duyệt. | CHUA_LAM |
| HOLA-P0-310.56 | Chống spam/bot scraping/lạm dụng liên hệ | Quota/rate limit theo scope, contact reveal cần auth/explicit action, giới hạn mass extraction và test bypass; không dùng tracking xâm phạm. | CHUA_LAM |
| HOLA-P0-310.57 | Audit log/PII/retention | Event nghiệp vụ và actor tối thiểu, access control, redact, expiry/prune, no secrets/GPS/form contents. | CHUA_LAM |
| HOLA-P0-310.58 | Monitoring/cảnh báo/backup/restore | Health/readiness, P95/lag/errors, backup độc lập, restore DB/media trên staging, kiểm tra job và incident drill. | CHUA_LAM |
| HOLA-P0-310.59 | API Gateway đối tác | API key hashed/revoke/rotation, scope/quota, allowlisted endpoints, audit/redaction; chưa mở API trả phí khi chưa có hợp đồng. | CHUA_LAM |
| HOLA-P0-310.60 | Đồng bộ 80Land/X-HUB/XSPACE | Contract-first, opt-in/rights, provenance và dedupe/idempotency, sync sandbox; WA-005 #92 giữ cổng duyệt riêng, không tự scrape/kết nối thật. | CHUA_LAM |

## 3. Mục tiêu kỹ thuật đề xuất (không phải SLA hoặc số đo đã có)

| Chỉ số | Mục tiêu staging |
|---|---|
| API nội bộ phổ biến | P95 < 300 ms |
| API tìm kiếm | P95 < 500 ms |
| Tải ban đầu | 100 người dùng đồng thời, workload và dataset đại diện được mô tả |
| Lỗi server | < 0,5% trong kịch bản tải đã xác định |
| Job | Không có side effect trùng khi retry trong test; idempotency, lease/recovery |
| Quyền | Không có truy cập vượt quyền/lộ dữ liệu riêng tư trong test matrix |
| Backup | Hằng ngày, bản sao độc lập và kiểm chứng |
| Restore | Drill database riêng, đối chiếu dữ liệu và media |
| Migration | PG16/PostGIS, từ trạng thái sạch và DB snapshot staging, phương án xử lý lỗi |

Đo baseline trước và sau trên cùng môi trường, dữ liệu, concurrency, warm/cold cache. Ghi thông số VPS/staging, số mẫu, P50/P95/P99, error, CPU/RAM/DB pool/lock. Mục tiêu cần hiệu chỉnh theo thực tế; không công bố benchmark khi chưa chạy. Không tự load test production.

## 4. Cổng bắt buộc mỗi PR

1. Đọc AGENTS.md và LUU_Y_CODE; xác minh main, PR liên quan, migration/code, CI và quyền. Chọn ID task; lập phạm vi nhỏ và kế hoạch test.
2. Giữ hợp đồng API, moderation, 2FA/RBAC, privacy và consent. Không public tin chưa duyệt; không đưa PII/GPS/token/query nhạy cảm vào logs/analytics; không xóa, gộp hay seed dữ liệu thật tự động.
3. Migration additive có kiểm thử nâng cấp và đánh giá lock/backfill; không sửa migration đã deploy tùy tiện. Chạy test PostgreSQL/PostGIS, backend, build/E2E nếu ảnh hưởng, security/safety gate; chỉ merge sau kiểm tra phù hợp và CI thành công.
4. Cập nhật cùng PR ba file BAO_CAO_TIEN_DO, KE_HOACH_TIEP_THEO, NHAT_KY_CODE; cập nhật trạng thái ID con trong roadmap này, giữ lịch sử. Sau merge xác minh SHA, ghi evidence mới. Phân biệt code/CI, deployed, acceptance.
5. Không tự deploy VPS. Follow docs/PUBLIC_LAUNCH_P0_RUNBOOK.md và docs/RELEASE_7_WAVES_RUNBOOK.md; backup/restore drill, readiness, smoke, physical-device/performance acceptance. Không đưa credential/dump vào Git.
6. WA-005/X-HUB, 80Land, quy hoạch, routing provider, Search Console và dữ liệu bên ngoài chỉ dùng theo quyền, nguồn và hợp đồng đã duyệt. Mục phụ thuộc chưa được phép phải ghi BLOCKED, không tạo dữ liệu hoặc bằng chứng giả.

## 5. Việc bắt đầu tiếp theo

Nhận `HOLA-P1-301.01`: kiểm toán database/migrations/indexes và ràng buộc hiện hữu; báo cáo phát hiện có file/line, mức độ, nguyên nhân, đề xuất và test. Lập baseline staging trước tối ưu. Đồng thời xác minh các cổng P0: backup độc lập, restore, cron/worker, CI/security và dữ liệu thật. Nếu không có môi trường/credential để đo, chỉ hoàn thành phần audit tĩnh và ghi rõ blocker; không ghi đã đo hiệu năng.
