-- HOLA Local SEO: curated area/category landing pages with dynamic inventory quality gates.
-- Re-runnable. Existing editorial copy and publication decisions are never overwritten.

CREATE TABLE IF NOT EXISTS local_seo_pages (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  page_type TEXT NOT NULL DEFAULT 'AREA_CATEGORY'
    CHECK (page_type IN ('AREA_CATEGORY', 'CAMPUS_RADIUS')),
  title TEXT NOT NULL,
  seo_title TEXT NOT NULL,
  seo_description TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  area_name TEXT NOT NULL,
  area_terms TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  center GEOMETRY(Point, 4326),
  radius_m INTEGER NOT NULL DEFAULT 8000 CHECK (radius_m BETWEEN 250 AND 50000),
  category_slug TEXT,
  include_category_slugs TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  exclude_category_slugs TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  map_region_slug TEXT,
  map_supported BOOLEAN NOT NULL DEFAULT FALSE,
  body JSONB NOT NULL DEFAULT '[]'::jsonb,
  min_place_count INTEGER NOT NULL DEFAULT 5 CHECK (min_place_count BETWEEN 1 AND 100),
  min_photo_places INTEGER NOT NULL DEFAULT 3 CHECK (min_photo_places BETWEEN 0 AND 100),
  min_recent_verified INTEGER NOT NULL DEFAULT 3 CHECK (min_recent_verified BETWEEN 0 AND 100),
  freshness_days INTEGER NOT NULL DEFAULT 180 CHECK (freshness_days BETWEEN 1 AND 730),
  min_word_count INTEGER NOT NULL DEFAULT 350 CHECK (min_word_count BETWEEN 100 AND 5000),
  min_sections INTEGER NOT NULL DEFAULT 3 CHECK (min_sections BETWEEN 1 AND 20),
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  published_at TIMESTAMPTZ,
  editorial_reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  editorial_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (center IS NOT NULL OR cardinality(area_terms) > 0),
  CHECK (status <> 'PUBLISHED' OR (map_supported = TRUE AND editorial_reviewed_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS local_seo_pages_status_idx
  ON local_seo_pages (status, published_at DESC);

CREATE INDEX IF NOT EXISTS local_seo_pages_center_idx
  ON local_seo_pages USING GIST (center)
  WHERE center IS NOT NULL;

CREATE INDEX IF NOT EXISTS local_seo_pages_area_terms_idx
  ON local_seo_pages USING GIN (area_terms);

INSERT INTO local_seo_pages (
  slug, page_type, title, seo_title, seo_description, excerpt,
  area_name, area_terms, center, radius_m, category_slug,
  include_category_slugs, exclude_category_slugs, map_region_slug, map_supported,
  body, status
) VALUES
(
  'cafe-hoa-lac',
  'AREA_CATEGORY',
  'Cafe Hòa Lạc: tìm quán phù hợp để học tập, làm việc và gặp gỡ',
  'Cafe Hòa Lạc: địa điểm học tập, làm việc và gặp gỡ',
  'Tìm cafe tại Hòa Lạc theo nhu cầu học tập, làm việc, gặp gỡ và thư giãn. Xem địa điểm thực tế, ảnh, thông tin xác minh và bản đồ HOLA Maps.',
  'Không phải quán cafe nào cũng phù hợp cho mọi cuộc hẹn. Trang này giúp bạn chọn theo mục đích, vị trí và thông tin thực tế được cập nhật trên HOLA Maps.',
  'Hòa Lạc',
  ARRAY['Hòa Lạc', 'Khu Công nghệ cao Hòa Lạc'],
  ST_SetSRID(ST_MakePoint(105.515, 21.015), 4326),
  8000,
  'cafe',
  ARRAY[]::TEXT[],
  ARRAY[]::TEXT[],
  'hoa-lac',
  TRUE,
  $json$[
    {
      "heading":"Chọn cafe theo việc bạn định làm",
      "paragraphs":[
        "Nếu cần một chỗ học cá nhân, hãy ưu tiên bàn ghế đủ thoải mái, ánh sáng dễ chịu, ổ cắm thuận tiện và mức độ ồn có thể chấp nhận. Một quán đẹp để chụp ảnh chưa chắc là nơi phù hợp để ngồi tập trung hai hoặc ba giờ. Ngược lại, không gian quá yên tĩnh có thể không phù hợp với buổi trao đổi nhóm.",
        "Với cuộc hẹn bạn bè hoặc gặp đối tác, hãy xem thêm cách bố trí bàn, khoảng cách giữa các chỗ ngồi và khả năng trò chuyện. Khi đi theo nhóm, nên kiểm tra trước số chỗ có thể ngồi cùng nhau thay vì chỉ nhìn ảnh chụp một góc quán."
      ],
      "bullets":["Học cá nhân: ánh sáng, ổ cắm và độ yên tĩnh","Làm việc nhóm: bàn rộng và chỗ ngồi linh hoạt","Gặp gỡ: không gian dễ trò chuyện và thuận tiện di chuyển"]
    },
    {
      "heading":"Xem vị trí trong bối cảnh Hòa Lạc",
      "paragraphs":[
        "Hòa Lạc có các cụm trường học, khu công nghệ, khu dân cư và những tuyến kết nối khác nhau. Vì vậy, khoảng cách trên địa chỉ chữ chưa đủ để quyết định. Một quán có thể gần nơi bạn học nhưng lại nằm khác hướng di chuyển, hoặc thuận tiện khi đi xe nhưng không phù hợp nếu bạn cần đi bộ giữa hai lịch hẹn.",
        "Hãy mở từng địa điểm trên bản đồ để quan sát vị trí tương quan với nơi xuất phát. Nếu lịch trình có nhiều điểm, chọn các quán nằm cùng một hướng sẽ giúp giảm thời gian vòng lại và dễ chủ động hơn."
      ]
    },
    {
      "heading":"Những thông tin nên kiểm tra trước khi đến",
      "paragraphs":[
        "Giờ hoạt động, số điện thoại, địa chỉ và ảnh thực tế là những thông tin có thể thay đổi. Trước khi đi vào buổi tối, ngày nghỉ hoặc dịp cao điểm, hãy kiểm tra lần cập nhật gần nhất và liên hệ địa điểm nếu thông tin chưa rõ. Không nên mặc định một quán vẫn mở chỉ vì ảnh hoặc bài giới thiệu cũ còn xuất hiện trên mạng.",
        "Nếu bạn cần học hoặc làm việc lâu, hãy tự xác nhận các tiện ích quan trọng như Wi-Fi, ổ cắm và quy định sử dụng chỗ ngồi. HOLA Maps chỉ hiển thị những thuộc tính có dữ liệu; phần nào chưa được xác minh sẽ không được coi là cam kết của địa điểm."
      ]
    },
    {
      "heading":"Cách sử dụng danh sách cafe trên HOLA Maps",
      "paragraphs":[
        "Danh sách bên dưới lấy từ hồ sơ địa điểm đã xuất bản trong cơ sở dữ liệu HOLA MAP, không phải danh sách tên quán được tạo tự động. Bạn có thể xem ảnh, địa chỉ, đánh giá nếu có và mở bản đồ tương tác để kiểm tra vị trí trước khi lựa chọn.",
        "Nếu phát hiện quán đổi địa chỉ, thay giờ hoạt động hoặc đã ngừng kinh doanh, hãy gửi báo cáo để thông tin được kiểm tra. Chất lượng danh sách phụ thuộc vào dữ liệu địa điểm thực tế và quá trình xác minh liên tục của cộng đồng."
      ]
    }
  ]$json$::jsonb,
  'DRAFT'
),
(
  'quan-an-thach-that',
  'AREA_CATEGORY',
  'Quán ăn Thạch Thất: chọn địa điểm theo bữa ăn và nhu cầu',
  'Quán ăn Thạch Thất: địa điểm ăn uống, thông tin thực tế và bản đồ',
  'Tìm quán ăn tại Thạch Thất theo bữa sáng, bữa trưa, bữa tối hoặc đi nhóm. Xem địa chỉ, ảnh thực tế, thông tin xác minh và vị trí trên HOLA Maps.',
  'Một lựa chọn ăn uống phù hợp cần nhiều hơn khoảng cách gần. Hãy cân nhắc thời điểm, số người, cách di chuyển và thông tin đang có của từng địa điểm.',
  'Thạch Thất',
  ARRAY['Thạch Thất', 'xã Thạch Thất'],
  ST_SetSRID(ST_MakePoint(105.585, 21.030), 4326),
  7000,
  'an-uong',
  ARRAY[]::TEXT[],
  ARRAY[]::TEXT[],
  'thach-that',
  TRUE,
  $json$[
    {
      "heading":"Bắt đầu từ thời điểm và kiểu bữa ăn",
      "paragraphs":[
        "Nhu cầu tìm quán ăn thay đổi theo thời điểm. Bữa sáng thường cần phục vụ nhanh và thuận đường đi học hoặc đi làm; bữa trưa cần cân bằng thời gian chờ với khoảng cách; còn bữa tối có thể ưu tiên không gian ngồi lâu hơn. Khi tìm địa điểm tại Thạch Thất, hãy xác định trước bạn cần ăn nhanh, ăn đủ bữa hay dành thời gian trò chuyện.",
        "Không nên suy luận giờ mở cửa chỉ từ loại hình quán. Một địa điểm có thể thay đổi lịch hoạt động theo ngày trong tuần hoặc mùa. Hãy kiểm tra giờ được công bố và gọi xác nhận khi bạn có lịch trình cố định."
      ]
    },
    {
      "heading":"Đi một mình, đi gia đình hay đi theo nhóm",
      "paragraphs":[
        "Nếu đi một mình, vị trí thuận đường và tốc độ phục vụ có thể quan trọng hơn không gian. Với gia đình, hãy xem ảnh thực tế để đánh giá chỗ ngồi, lối đi và mức độ phù hợp với trẻ nhỏ. Nhóm đông nên ưu tiên nơi có bàn ghép được hoặc khả năng tiếp nhận nhiều người cùng lúc.",
        "Thông tin về chỗ đỗ xe, đặt bàn, thực đơn và mức giá chỉ nên được sử dụng khi hồ sơ địa điểm có cập nhật tương ứng. Nếu chưa có dữ liệu, hãy liên hệ trực tiếp thay vì mặc định rằng địa điểm cung cấp dịch vụ đó."
      ],
      "bullets":["Ăn nhanh: ưu tiên vị trí thuận tuyến","Gia đình: xem không gian và tiện ích","Nhóm đông: xác nhận chỗ ngồi và khả năng phục vụ"]
    },
    {
      "heading":"Đọc địa chỉ và xem bản đồ trước khi xuất phát",
      "paragraphs":[
        "Tên khu vực Thạch Thất có thể xuất hiện trong nhiều cách ghi địa chỉ. Bản đồ giúp bạn kiểm tra điểm ghim thực tế, tuyến đường tiếp cận và các địa điểm khác trong cùng khu vực. Điều này hữu ích khi bạn chưa quen đường hoặc muốn kết hợp ăn uống với một công việc khác.",
        "Nếu đi từ khu vực Hòa Lạc hoặc từ nơi khác, hãy xem vị trí cụ thể thay vì chỉ dựa vào tên xã hoặc tên huyện. Địa chỉ văn bản có thể ngắn gọn, trong khi tọa độ bản đồ cho biết vị trí mà hệ thống đang lưu."
      ]
    },
    {
      "heading":"Ưu tiên thông tin mới và có thể kiểm chứng",
      "paragraphs":[
        "Một danh sách hữu ích cần cho biết địa điểm nào có ảnh thực tế, địa chỉ rõ ràng và thời điểm xác minh gần nhất. Đánh giá chỉ có ý nghĩa khi có số lượng đánh giá đi kèm; một con số đơn lẻ không nên được hiểu là kết luận chắc chắn về chất lượng.",
        "HOLA Maps kết nối danh sách với hồ sơ địa điểm gốc. Khi bạn phát hiện quán đã chuyển đi, đổi giờ hoặc có thông tin sai, hãy gửi báo cáo để cộng đồng và đội ngũ kiểm duyệt cập nhật dữ liệu."
      ]
    }
  ]$json$::jsonb,
  'DRAFT'
),
(
  'check-in-quoc-oai',
  'AREA_CATEGORY',
  'Địa điểm check-in Quốc Oai: gợi ý cách chọn điểm đi và chụp ảnh',
  'Địa điểm check-in Quốc Oai: khám phá điểm đến và trải nghiệm',
  'Tìm địa điểm check-in tại Quốc Oai, xem thông tin thực tế, ảnh, vị trí và lưu ý trước chuyến đi. Trang chỉ được xuất bản khi dữ liệu và phạm vi bản đồ đáp ứng điều kiện HOLA Maps.',
  'Một chuyến đi chụp ảnh tốt cần chọn đúng thời điểm, kiểm tra quyền tiếp cận và hiểu rõ điều kiện tại điểm đến. Hãy dùng danh sách đã xác minh thay vì dựa vào ảnh lan truyền.',
  'Quốc Oai',
  ARRAY['Quốc Oai', 'huyện Quốc Oai', 'xã Quốc Oai'],
  NULL,
  12000,
  'check-in',
  ARRAY[]::TEXT[],
  ARRAY[]::TEXT[],
  NULL,
  FALSE,
  $json$[
    {
      "heading":"Chọn điểm check-in theo trải nghiệm mong muốn",
      "paragraphs":[
        "Trước khi chọn điểm đến, hãy xác định bạn muốn chụp ảnh kiến trúc, cảnh quan, không gian ngoài trời hay ghi lại một hoạt động trải nghiệm. Mỗi kiểu địa điểm có yêu cầu khác nhau về thời gian lưu lại, trang phục, thiết bị và cách di chuyển. Việc xác định mục đích giúp bạn tránh chọn một nơi chỉ vì ảnh đẹp nhưng không phù hợp với chuyến đi thực tế.",
        "Với nhóm bạn hoặc gia đình, nên thống nhất trước thời lượng tham quan và phương tiện di chuyển. Nếu điểm đến có nhiều khu vực, hãy xem thông tin hướng dẫn của đơn vị quản lý để biết nơi nào được phép tiếp cận và chụp ảnh."
      ]
    },
    {
      "heading":"Kiểm tra quyền tham quan và điều kiện tại chỗ",
      "paragraphs":[
        "Không phải mọi vị trí nhìn thấy trên ảnh đều là điểm tham quan công cộng. Một số khu vực có thể thuộc khuôn viên tư nhân, công trình đang hoạt động hoặc vùng cần xin phép trước. Hãy xác nhận quy định vào cửa, phí tham quan nếu có, thời gian hoạt động và những giới hạn chụp ảnh trước khi lên đường.",
        "Nếu đi vào ngày mưa hoặc thời tiết nắng nóng, hãy cân nhắc đường tiếp cận, nơi trú và điều kiện an toàn. Không tự ý đi vào khu vực có biển cấm, công trường hoặc đất tư nhân chỉ để có góc chụp."
      ]
    },
    {
      "heading":"Lên lịch trình hợp lý cho một buổi đi chơi",
      "paragraphs":[
        "Nếu có nhiều điểm muốn ghé, hãy nhóm các điểm theo vị trí và khoảng cách thực tế. Một lịch trình ngắn với ít điểm nhưng đủ thời gian trải nghiệm thường dễ thực hiện hơn danh sách dài phải di chuyển liên tục. Bạn cũng nên dự phòng thời gian nghỉ, ăn uống và thay đổi kế hoạch nếu địa điểm đóng cửa hoặc không thể tiếp cận.",
        "Trước chuyến đi, lưu lại địa chỉ và thông tin liên hệ của từng nơi. Khi dữ liệu trên bản đồ chưa có xác minh gần đây, hãy coi đó là tín hiệu cần kiểm tra thêm, không phải bảo đảm rằng điểm đến vẫn hoạt động như mô tả."
      ]
    },
    {
      "heading":"Cách HOLA Maps chọn lọc dữ liệu check-in",
      "paragraphs":[
        "Một địa điểm chỉ nên xuất hiện trong danh sách công khai khi hồ sơ có vị trí hợp lệ, ảnh thực tế và đủ tín hiệu xác minh. HOLA Maps không tự tạo tên điểm đến, giờ mở cửa hay đánh giá để làm đầy nội dung. Những hồ sơ thiếu dữ liệu sẽ tiếp tục ở trạng thái chờ bổ sung.",
        "Quốc Oai hiện chưa nằm trong vùng bản đồ tương tác đang phục vụ. Vì vậy, trang này được giữ ở trạng thái bản nháp cho đến khi phạm vi bản đồ và dữ liệu địa điểm được mở rộng phù hợp. Điều này giúp tránh dẫn người dùng tới một bản đồ không thể hiện đúng các điểm được giới thiệu."
      ]
    }
  ]$json$::jsonb,
  'DRAFT'
),
(
  'homestay-ba-vi',
  'AREA_CATEGORY',
  'Homestay Ba Vì: chọn nơi lưu trú theo nhóm và kế hoạch nghỉ dưỡng',
  'Homestay Ba Vì: thông tin lưu trú, tiện nghi và vị trí',
  'Tìm homestay tại Ba Vì theo quy mô nhóm, nhu cầu nghỉ ngơi, tiện nghi và vị trí. Xem hồ sơ địa điểm thực tế khi dữ liệu và phạm vi bản đồ đáp ứng điều kiện xuất bản.',
  'Chọn homestay không chỉ dựa trên ảnh. Hãy so sánh vị trí, sức chứa, tiện nghi được xác nhận và điều kiện đặt phòng trước khi thanh toán.',
  'Ba Vì',
  ARRAY['Ba Vì', 'huyện Ba Vì', 'xã Ba Vì'],
  NULL,
  15000,
  'homestay',
  ARRAY[]::TEXT[],
  ARRAY[]::TEXT[],
  NULL,
  FALSE,
  $json$[
    {
      "heading":"Chọn nơi lưu trú theo thành phần đoàn",
      "paragraphs":[
        "Một cặp đôi, gia đình có trẻ nhỏ và nhóm bạn đông người sẽ có những tiêu chí khác nhau. Trước khi tìm homestay tại Ba Vì, hãy xác định số người lớn, trẻ em, số phòng cần dùng và mức độ riêng tư mong muốn. Những thông tin này giúp bạn loại bỏ lựa chọn không phù hợp ngay từ đầu.",
        "Nếu đi theo nhóm, cần xác nhận sức chứa thực tế và cách bố trí chỗ ngủ thay vì chỉ nhìn số phòng hoặc ảnh tổng thể. Với gia đình, hãy hỏi rõ về cầu thang, khu vệ sinh, khu vực bếp và các tiện ích liên quan đến trẻ nhỏ nếu đó là nhu cầu của đoàn."
      ]
    },
    {
      "heading":"Đọc kỹ vị trí và cách tiếp cận",
      "paragraphs":[
        "Ba Vì có nhiều dạng địa hình và cung đường khác nhau. Một nơi lưu trú có thể phù hợp cho chuyến nghỉ ngơi nhưng không thuận tiện nếu lịch trình của bạn tập trung ở một khu vực khác. Hãy xác định các điểm dự định ghé, phương tiện di chuyển và thời gian đi đường trước khi chốt nơi ở.",
        "Địa chỉ, tọa độ và đường vào cần được kiểm tra cùng nhau. Nếu đường tiếp cận có đoạn nhỏ, dốc hoặc khó đi vào ban đêm, hãy hỏi đơn vị lưu trú để được hướng dẫn cụ thể. Không nên dựa hoàn toàn vào ảnh chụp hoặc mô tả quảng cáo."
      ]
    },
    {
      "heading":"Tiện nghi, giá và điều kiện đặt phòng",
      "paragraphs":[
        "Các tiện ích như bếp, bể bơi, khu nướng, chỗ đỗ xe, điều hòa hoặc dịch vụ ăn uống cần được xác nhận cho đúng cơ sở và đúng thời điểm lưu trú. Một số tiện ích có thể tính phí riêng, yêu cầu đặt trước hoặc chỉ hoạt động theo mùa. Hãy yêu cầu báo giá tổng thể, bao gồm phụ thu và điều kiện hoàn hủy.",
        "Giá phòng có thể thay đổi theo ngày thường, cuối tuần, ngày lễ và số lượng khách. Nếu thông tin giá chưa được cập nhật trên hồ sơ, hãy liên hệ trực tiếp với chủ cơ sở trước khi chuyển tiền hoặc đặt cọc."
      ]
    },
    {
      "heading":"Kiểm tra hồ sơ địa điểm trước khi đặt",
      "paragraphs":[
        "Một hồ sơ lưu trú hữu ích cần có địa chỉ rõ ràng, ảnh thực tế, thông tin liên hệ và thời điểm xác minh gần nhất. Hãy đối chiếu tên cơ sở và vị trí trên bản đồ với thông tin mà đơn vị cung cấp. Nếu có điểm khác nhau, nên yêu cầu giải thích trước khi xác nhận đặt phòng.",
        "Ba Vì hiện nằm ngoài phạm vi bản đồ tương tác đang phục vụ của HOLA MAP. Trang này được giữ ở trạng thái bản nháp cho đến khi có dữ liệu địa điểm đủ chất lượng và phạm vi bản đồ tương ứng. HOLA Maps không hiển thị bản đồ thiếu điểm ghim như thể đó là một danh sách đã được xác minh."
      ]
    }
  ]$json$::jsonb,
  'DRAFT'
),
(
  'dich-vu-quanh-dai-hoc-fpt',
  'CAMPUS_RADIUS',
  'Dịch vụ quanh Đại học FPT Hòa Lạc: tìm tiện ích theo nhu cầu',
  'Dịch vụ quanh Đại học FPT Hòa Lạc: ăn uống, mua sắm và tiện ích',
  'Khám phá dịch vụ quanh Đại học FPT Hòa Lạc trong bán kính tìm kiếm thực tế: ăn uống, cafe, cửa hàng và tiện ích. Xem địa điểm đã xuất bản trên HOLA Maps.',
  'Từ nhu cầu hằng ngày đến những việc cần xử lý nhanh, trang này tập hợp các địa điểm dịch vụ thực tế quanh khu Đại học FPT và kết nối trực tiếp với bản đồ.',
  'Đại học FPT Hòa Lạc',
  ARRAY['Đại học FPT', 'Trường Đại học FPT', 'Khu Giáo dục và Đào tạo'],
  ST_SetSRID(ST_MakePoint(105.52522, 21.01354), 4326),
  3000,
  NULL,
  ARRAY['cafe', 'an-uong', 'dich-vu', 'sieu-thi', 'y-te', 'ngan-hang-atm', 'nhien-lieu-sac'],
  ARRAY['truong-hoc', 'bat-dong-san'],
  'hoa-lac',
  TRUE,
  $json$[
    {
      "heading":"Tìm dịch vụ theo việc cần giải quyết",
      "paragraphs":[
        "Khu vực quanh Đại học FPT có nhiều nhu cầu khác nhau theo lịch học và sinh hoạt: tìm nơi ăn uống, mua vật dụng cần thiết, sử dụng dịch vụ cá nhân hoặc xử lý những việc phát sinh trong ngày. Thay vì tìm một danh sách chung chung, hãy bắt đầu bằng nhu cầu cụ thể để chọn đúng nhóm địa điểm.",
        "Một địa điểm gần trường về mặt địa lý chưa chắc nằm trên tuyến đường thuận tiện cho bạn. Hãy kiểm tra điểm ghim, hướng tiếp cận và khoảng cách thực tế trên bản đồ trước khi rời khuôn viên."
      ],
      "bullets":["Ăn uống và cafe","Cửa hàng và mua sắm thiết yếu","Y tế, ngân hàng và dịch vụ cá nhân"]
    },
    {
      "heading":"Ưu tiên thông tin cần thiết trước khi di chuyển",
      "paragraphs":[
        "Với cửa hàng hoặc dịch vụ, các thông tin hữu ích thường là địa chỉ, giờ hoạt động, số điện thoại và nhóm dịch vụ đang cung cấp. Nếu bạn cần đến ngoài giờ hành chính hoặc vào cuối tuần, hãy xác nhận lịch mở cửa trước. Không nên mặc định mọi cơ sở quanh trường đều hoạt động theo cùng một khung giờ.",
        "Với những nhu cầu cần chuẩn bị trước như sửa chữa, chăm sóc cá nhân hoặc dịch vụ có lịch hẹn, hãy gọi điện để hỏi khả năng tiếp nhận. HOLA Maps chỉ hiển thị thông tin đã có trong hồ sơ; phần chưa cập nhật cần được xác nhận trực tiếp."
      ]
    },
    {
      "heading":"Phạm vi tìm kiếm quanh khuôn viên",
      "paragraphs":[
        "Danh sách này tập trung vào các địa điểm trong phạm vi tìm kiếm quanh tọa độ khu Đại học FPT Hòa Lạc, thay vì gom tất cả dịch vụ ở một khu vực quá rộng. Cách giới hạn bán kính giúp người dùng dễ hình dung lựa chọn nào thực sự gần trường và có thể tiếp cận trong một chuyến đi ngắn.",
        "Khi xem danh sách, hãy để ý địa chỉ và vị trí ghim. Một số địa điểm có thể nằm ở rìa bán kính hoặc ở phía bên kia trục đường; bản đồ tương tác giúp bạn kiểm tra bối cảnh trước khi quyết định."
      ]
    },
    {
      "heading":"Dữ liệu địa phương cần được duy trì",
      "paragraphs":[
        "Một trang dịch vụ quanh trường chỉ hữu ích khi địa điểm còn hoạt động và thông tin liên hệ không bị lỗi thời. HOLA Maps ưu tiên hồ sơ có ảnh thực tế, tọa độ hợp lệ và xác minh gần đây. Những địa điểm không đạt ngưỡng chất lượng sẽ không được dùng để tạo một danh sách công khai chỉ nhằm tăng số lượng kết quả.",
        "Nếu bạn phát hiện cửa hàng chuyển địa chỉ, thay giờ hoặc ngừng hoạt động, hãy gửi báo cáo kèm thông tin có thể kiểm chứng. Việc cập nhật dữ liệu giúp sinh viên, giảng viên, khách đến trường và cư dân quanh khu vực tìm được lựa chọn phù hợp hơn."
      ]
    }
  ]$json$::jsonb,
  'DRAFT'
)
ON CONFLICT (slug) DO NOTHING;
