-- Explore / SEO content hub for Hola Maps.
-- Re-runnable because this repository currently reapplies migrations on deploy.

CREATE TABLE IF NOT EXISTS explore_articles (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  category_slug TEXT NOT NULL,
  category_label TEXT NOT NULL,
  eyebrow TEXT,
  seo_title TEXT NOT NULL,
  seo_description TEXT NOT NULL,
  body JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  related_query TEXT,
  related_category TEXT,
  reading_minutes INTEGER NOT NULL DEFAULT 5 CHECK (reading_minutes BETWEEN 1 AND 60),
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS explore_articles_status_published_idx
  ON explore_articles (status, published_at DESC);
CREATE INDEX IF NOT EXISTS explore_articles_category_idx
  ON explore_articles (category_slug, published_at DESC);
CREATE INDEX IF NOT EXISTS explore_articles_search_trgm_idx
  ON explore_articles USING GIN (
    (
      lower(
        public.hola_unaccent(
          COALESCE(title, '') || ' ' ||
          COALESCE(excerpt, '') || ' ' ||
          COALESCE(array_to_string(tags, ' '), '')
        )
      )
    ) gin_trgm_ops
  );

INSERT INTO explore_articles (
  slug, title, excerpt, category_slug, category_label, eyebrow,
  seo_title, seo_description, body, tags, featured,
  related_query, related_category, reading_minutes, status, published_at
) VALUES
(
  'hoa-lac-choi-gi',
  'Hòa Lạc chơi gì? Gợi ý địa điểm cho một ngày đổi gió',
  'Từ không gian xanh, khu trải nghiệm đến những điểm check-in quanh Hòa Lạc, đây là cách chọn điểm đi phù hợp với nhóm bạn, gia đình hoặc một buổi chiều thư giãn.',
  'choi-gi', 'Chơi gì', 'CẨM NANG HÒA LẠC',
  'Hòa Lạc chơi gì? Gợi ý địa điểm đáng đi',
  'Hòa Lạc chơi gì? Gợi ý địa điểm, trải nghiệm, check-in và lịch trình ngắn cho cuối tuần, kèm liên kết xem trực tiếp trên HOLA Maps.',
  $json$[
    {"heading":"Chọn trải nghiệm theo thời gian bạn có","paragraphs":["Nếu chỉ có vài giờ, hãy ưu tiên một cụm địa điểm gần nhau để giảm thời gian di chuyển. Với cả ngày, bạn có thể kết hợp một điểm ngoài trời vào buổi sáng, ăn trưa tại khu trung tâm rồi dành buổi chiều cho cafe hoặc check-in.","HOLA Maps giúp mở từng địa điểm trên bản đồ để bạn nhìn khoảng cách thực tế, tuyến đường và các tiện ích xung quanh trước khi đi."],"bullets":["2–4 giờ: cafe, check-in, đi dạo","Nửa ngày: trải nghiệm + ăn uống","Cả ngày: ngoài trời + ăn trưa + cafe"]},
    {"heading":"Nhóm bạn và gia đình nên ưu tiên gì?","paragraphs":["Nhóm bạn thường hợp với nơi có hoạt động, góc chụp ảnh và không gian ngồi lâu. Gia đình nên ưu tiên chỗ có bãi đỗ xe, khu vệ sinh, đồ ăn và khoảng trống cho trẻ nhỏ.","Khi xem danh sách gợi ý, hãy mở từng thẻ địa điểm để kiểm tra giờ hoạt động và tình trạng dữ liệu mới nhất."],"bullets":["Đi nhóm: ưu tiên không gian rộng","Đi gia đình: ưu tiên tiện ích đầy đủ","Đi đôi: ưu tiên nơi yên tĩnh, dễ ngắm cảnh"]},
    {"heading":"Dùng bản đồ để ghép lịch trình","paragraphs":["Thay vì lưu nhiều địa chỉ rời rạc, bạn có thể mở các điểm bên dưới trên HOLA Maps và ghép chúng theo cùng một hướng di chuyển. Cách này đặc biệt hữu ích vào cuối tuần khi một số tuyến đường đông hơn bình thường.","Danh sách này được thiết kế như điểm bắt đầu; dữ liệu địa điểm có thể tiếp tục được cộng đồng cập nhật."]}
  ]$json$::jsonb,
  ARRAY['Hòa Lạc','chơi gì','đi chơi','cuối tuần','check-in'], TRUE,
  NULL, NULL, 6, 'PUBLISHED', NOW() - INTERVAL '19 days'
),
(
  'hoa-lac-co-gi',
  'Hòa Lạc có gì? Bản đồ nhanh cho người mới đến',
  'Một góc nhìn tổng quan về Hòa Lạc: trường đại học, khu công nghệ, khu dân cư, quán ăn, cafe, lưu trú và các điểm vui chơi quanh khu vực.',
  'cam-nang', 'Cẩm nang', 'HOLA GUIDE',
  'Hòa Lạc có gì? Tổng quan ăn uống, vui chơi và tiện ích',
  'Tìm hiểu Hòa Lạc có gì: khu công nghệ, trường học, ăn uống, cafe, homestay và các địa điểm đáng chú ý trên HOLA Maps.',
  $json$[
    {"heading":"Một khu vực đang thay đổi rất nhanh","paragraphs":["Hòa Lạc không chỉ là khu công nghệ. Nhịp sống quanh các trường đại học, khu dân cư và các tuyến kết nối mới khiến hệ sinh thái dịch vụ phát triển nhanh: từ hàng quán sinh viên đến lưu trú cuối tuần.","Vì tốc độ thay đổi cao, dữ liệu địa phương cần được cập nhật thường xuyên. HOLA Maps ưu tiên hiển thị thời điểm cập nhật và đóng góp cộng đồng để người xem có thêm ngữ cảnh."]},
    {"heading":"Các nhu cầu phổ biến nhất","paragraphs":["Người mới đến thường tìm ba nhóm chính: ăn uống gần nơi học hoặc làm việc, cafe để gặp gỡ/làm việc, và nơi ở ngắn ngày cho khách từ Hà Nội hoặc tỉnh khác.","Ngoài ra, nhóm đi cuối tuần thường tìm điểm xanh, nơi check-in hoặc trải nghiệm quanh Hòa Lạc – Thạch Thất – Sơn Tây."],"bullets":["Ăn uống và cafe","Trường học, y tế, cửa hàng","Homestay, villa, điểm trải nghiệm"]},
    {"heading":"Bắt đầu từ bản đồ","paragraphs":["Bạn có thể dùng các bài Khám phá để chọn ý tưởng, sau đó mở địa điểm trên bản đồ để kiểm tra vị trí thực tế. Đây là cách nhanh hơn so với chỉ đọc danh sách địa chỉ."]}
  ]$json$::jsonb,
  ARRAY['Hòa Lạc','có gì','cẩm nang','bản đồ'], TRUE,
  'Hòa Lạc', NULL, 5, 'PUBLISHED', NOW() - INTERVAL '18 days'
),
(
  'an-gi-o-hoa-lac',
  'Ăn gì ở Hòa Lạc? Gợi ý theo từng kiểu cuộc hẹn',
  'Chọn quán ở Hòa Lạc theo nhu cầu: ăn nhanh, đi nhóm, tiếp khách, ăn gia đình hay tìm nơi mở buổi tối.',
  'an-gi', 'Ăn gì', 'ĂN UỐNG',
  'Ăn gì ở Hòa Lạc? Gợi ý quán theo nhu cầu',
  'Ăn gì ở Hòa Lạc? Tham khảo cách chọn quán ăn, nhà hàng và địa điểm ăn uống phù hợp cho sinh viên, gia đình và nhóm bạn.',
  $json$[
    {"heading":"Đừng chọn quán chỉ theo khoảng cách","paragraphs":["Một quán gần chưa chắc phù hợp nếu bạn đi nhóm đông hoặc cần chỗ ngồi lâu. Hãy cân bằng khoảng cách với loại món, không gian, giờ mở cửa và chỗ đỗ xe.","Ở Hòa Lạc, các cụm hàng quán thường tập trung quanh trường học, khu dân cư và trục đường chính."]},
    {"heading":"Chọn theo tình huống","paragraphs":["Ăn nhanh nên ưu tiên quán có món ra nhanh và dễ dừng xe. Đi gia đình nên ưu tiên không gian rộng và menu đa dạng. Tiếp khách có thể chọn nhà hàng yên tĩnh hơn, dễ đặt bàn."],"bullets":["Sinh viên: nhanh, dễ đi, mức giá vừa","Gia đình: chỗ ngồi rộng, menu đa dạng","Nhóm bạn: bàn lớn, mở tối"]},
    {"heading":"Kiểm tra trước khi đi","paragraphs":["Mở từng địa điểm trên HOLA Maps để xem giờ hoạt động và dữ liệu mới nhất. Nếu bạn phát hiện quán đổi giờ hoặc chuyển địa chỉ, có thể gửi đóng góp để cộng đồng cùng cập nhật."]}
  ]$json$::jsonb,
  ARRAY['ăn gì','Hòa Lạc','quán ăn','nhà hàng'], TRUE,
  NULL, 'an-uong', 5, 'PUBLISHED', NOW() - INTERVAL '17 days'
),
(
  'top-quan-cafe-dep-hoa-lac',
  'Top quán cafe đẹp ở Hòa Lạc để ngồi lâu và chụp ảnh',
  'Gợi ý cách chọn cafe đẹp ở Hòa Lạc theo view, không gian, nhu cầu làm việc và khoảng cách từ các khu trung tâm.',
  'cafe', 'Cafe', 'CAFE HÒA LẠC',
  'Top quán cafe đẹp Hòa Lạc: view, check-in, làm việc',
  'Khám phá các quán cafe đẹp ở Hòa Lạc cho check-in, làm việc và gặp gỡ. Mở từng địa điểm trực tiếp trên HOLA Maps.',
  $json$[
    {"heading":"Cafe đẹp không chỉ là góc chụp ảnh","paragraphs":["Một quán đáng quay lại thường cân bằng ba yếu tố: không gian, đồ uống và sự thuận tiện. Với người làm việc, ổ cắm và độ ồn quan trọng; với nhóm đi chơi, ánh sáng và khu ngoài trời lại đáng ưu tiên hơn."]},
    {"heading":"Ba kiểu quán dễ chọn","paragraphs":["Nếu cần làm việc, chọn quán có bàn ghế thoải mái và wifi ổn định. Nếu đi hẹn hò hoặc chụp ảnh, ưu tiên không gian có khoảng thoáng và ánh sáng tự nhiên. Nhóm đông nên kiểm tra khu ngồi lớn trước."],"bullets":["Làm việc: yên tĩnh, bàn rộng","Check-in: ánh sáng và cảnh quan","Đi nhóm: nhiều chỗ ngồi, đỗ xe thuận tiện"]},
    {"heading":"Xem vị trí thật trên bản đồ","paragraphs":["Danh sách bên dưới lấy từ dữ liệu địa điểm hiện có. Bạn có thể mở bản đồ để xem quán nằm ở cụm nào và ghép thêm quán ăn hoặc điểm đi chơi gần đó."]}
  ]$json$::jsonb,
  ARRAY['cafe','Hòa Lạc','cafe đẹp','check-in'], TRUE,
  NULL, 'cafe', 5, 'PUBLISHED', NOW() - INTERVAL '16 days'
),
(
  'quan-cafe-gan-dai-hoc-fpt-hoa-lac',
  'Cafe gần Đại học FPT Hòa Lạc: chọn quán nào cho học và gặp bạn?',
  'Gợi ý chọn cafe quanh Đại học FPT Hòa Lạc theo khoảng cách, mức độ yên tĩnh, làm việc nhóm và nhu cầu ngồi buổi tối.',
  'cafe', 'Cafe', 'GẦN ĐẠI HỌC FPT',
  'Cafe gần Đại học FPT Hòa Lạc cho học tập và gặp bạn',
  'Tìm cafe gần Đại học FPT Hòa Lạc, phù hợp học tập, làm việc nhóm hoặc gặp bạn. Xem vị trí và chỉ đường trên HOLA Maps.',
  $json$[
    {"heading":"Khoảng cách quan trọng nhưng không phải tất cả","paragraphs":["Quán gần trường phù hợp cho những buổi trống giữa lịch học, nhưng khi cần làm bài nhóm bạn nên ưu tiên chỗ có bàn lớn và ít ồn hơn. Nếu ngồi tối, hãy kiểm tra giờ đóng cửa trước khi đi."]},
    {"heading":"Chọn quán theo mục đích","paragraphs":["Học cá nhân cần yên tĩnh và ổ cắm. Làm việc nhóm cần bàn đủ rộng. Gặp bạn cần không gian thoải mái và dễ tìm. HOLA Maps giúp bạn xem vị trí tương quan với khu Đại học FPT thay vì chỉ nhìn địa chỉ chữ."]},
    {"heading":"Mẹo đi nhanh","paragraphs":["Nếu đi xe máy vào giờ cao điểm, ưu tiên quán cùng phía tuyến đường bạn đang di chuyển. Khi có nhiều lựa chọn, hãy mở từng điểm trên bản đồ để tránh vòng đường không cần thiết."]}
  ]$json$::jsonb,
  ARRAY['cafe gần FPT','Đại học FPT','Hòa Lạc','cafe'], FALSE,
  'FPT', 'cafe', 4, 'PUBLISHED', NOW() - INTERVAL '15 days'
),
(
  'quan-an-gan-dai-hoc-fpt',
  'Quán ăn gần Đại học FPT Hòa Lạc: nhanh, tiện và dễ đi',
  'Danh sách gợi ý cho sinh viên và khách đến Đại học FPT khi cần tìm quán ăn gần, ăn nhanh hoặc đi nhóm.',
  'an-gi', 'Ăn gì', 'GẦN ĐẠI HỌC FPT',
  'Quán ăn gần Đại học FPT Hòa Lạc',
  'Tìm quán ăn gần Đại học FPT Hòa Lạc cho sinh viên, nhóm bạn và khách đến trường; xem trực tiếp trên HOLA Maps.',
  $json$[
    {"heading":"Ưu tiên quán phù hợp nhịp học","paragraphs":["Bữa trưa giữa hai ca học thường cần tốc độ và khoảng cách ngắn. Buổi tối hoặc cuối tuần, bạn có thể mở rộng phạm vi để có thêm lựa chọn món và không gian."]},
    {"heading":"Đi nhóm nên xem trước","paragraphs":["Nhóm từ 5 người trở lên nên ưu tiên nơi có bàn lớn và chỗ để xe. Nếu quán có thông tin giờ mở cửa, hãy kiểm tra trước vào ngày cuối tuần hoặc dịp lễ."]},
    {"heading":"Tìm trên HOLA Maps","paragraphs":["Các gợi ý liên quan đến FPT được nối trực tiếp với bản đồ. Bấm vào địa điểm để xem vị trí và tuyến đường thay vì phải sao chép địa chỉ sang ứng dụng khác."]}
  ]$json$::jsonb,
  ARRAY['quán ăn gần FPT','Đại học FPT','ăn uống','Hòa Lạc'], FALSE,
  'FPT', 'an-uong', 4, 'PUBLISHED', NOW() - INTERVAL '14 days'
),
(
  'top-nha-hang-hoa-lac',
  'Nhà hàng ở Hòa Lạc: gợi ý cho gia đình, nhóm đông và tiếp khách',
  'Chọn nhà hàng Hòa Lạc theo quy mô nhóm, không gian, khu vực và thời gian dùng bữa.',
  'an-gi', 'Ăn gì', 'NHÀ HÀNG',
  'Nhà hàng Hòa Lạc cho gia đình, nhóm đông và tiếp khách',
  'Gợi ý nhà hàng ở Hòa Lạc phù hợp đi gia đình, nhóm đông hoặc tiếp khách, kèm bản đồ địa điểm và chỉ đường.',
  $json$[
    {"heading":"Đi gia đình và đi tiếp khách khác nhau","paragraphs":["Gia đình thường cần menu dễ chọn cho nhiều độ tuổi và chỗ ngồi thoải mái. Tiếp khách lại cần sự yên tĩnh, vị trí dễ tìm và khả năng đặt bàn."]},
    {"heading":"Nhóm đông nên đặt tiêu chí trước","paragraphs":["Số người, thời gian đến, nhu cầu phòng riêng và chỗ đỗ xe là bốn câu hỏi nên kiểm tra trước. Điều này giúp tránh phải đổi quán khi đã tập trung đủ người."]},
    {"heading":"Dùng bản đồ để chọn cụm phù hợp","paragraphs":["Nếu nhóm có người đến từ nhiều hướng, chọn quán gần trục đường lớn thường thuận tiện hơn. HOLA Maps cho phép nhìn nhanh vị trí từng nhà hàng trong cùng khu vực."]}
  ]$json$::jsonb,
  ARRAY['nhà hàng','Hòa Lạc','gia đình','tiếp khách'], FALSE,
  'nhà hàng', 'an-uong', 4, 'PUBLISHED', NOW() - INTERVAL '13 days'
),
(
  'top-homestay-hoa-lac',
  'Homestay Hòa Lạc: cách chọn nơi ở cho cặp đôi, gia đình và nhóm bạn',
  'Gợi ý chọn homestay quanh Hòa Lạc theo số người, khoảng cách, nhu cầu riêng tư và lịch trình cuối tuần.',
  'homestay', 'Homestay', 'LƯU TRÚ',
  'Homestay Hòa Lạc cho cặp đôi, gia đình và nhóm bạn',
  'Tìm homestay Hòa Lạc phù hợp theo nhóm, vị trí và lịch trình. Xem các điểm lưu trú trên HOLA Maps.',
  $json$[
    {"heading":"Bắt đầu từ số người và mục đích chuyến đi","paragraphs":["Một chuyến nghỉ đôi cần sự riêng tư; nhóm bạn lại cần không gian sinh hoạt chung và khu nấu nướng. Gia đình có trẻ nhỏ nên ưu tiên an toàn, khuôn viên dễ quan sát và di chuyển thuận tiện."]},
    {"heading":"Khoảng cách ảnh hưởng trải nghiệm","paragraphs":["Nếu lịch trình tập trung quanh Hòa Lạc, ở quá xa có thể làm tăng thời gian di chuyển. Ngược lại, nếu mục tiêu là nghỉ dưỡng yên tĩnh, một vị trí xa trung tâm một chút có thể hợp lý hơn."]},
    {"heading":"Kiểm tra dữ liệu trước khi đặt","paragraphs":["Thông tin trên bản đồ giúp bạn xác định vị trí và các tiện ích xung quanh. Giá và tình trạng phòng có thể thay đổi, vì vậy nên liên hệ trực tiếp cơ sở trước khi thanh toán."]}
  ]$json$::jsonb,
  ARRAY['homestay','Hòa Lạc','lưu trú','cuối tuần'], TRUE,
  NULL, 'homestay', 5, 'PUBLISHED', NOW() - INTERVAL '12 days'
),
(
  'homestay-gan-dai-hoc-fpt',
  'Homestay gần Đại học FPT Hòa Lạc cho phụ huynh và nhóm bạn',
  'Gợi ý tiêu chí chọn nơi lưu trú gần Đại học FPT: dễ di chuyển, phù hợp số người và thuận tiện cho chuyến ở ngắn ngày.',
  'homestay', 'Homestay', 'GẦN ĐẠI HỌC FPT',
  'Homestay gần Đại học FPT Hòa Lạc',
  'Tìm homestay gần Đại học FPT Hòa Lạc cho phụ huynh, khách công tác và nhóm bạn, kèm vị trí trên HOLA Maps.',
  $json$[
    {"heading":"Ai thường cần ở gần FPT?","paragraphs":["Phụ huynh dự sự kiện của trường, khách công tác và bạn bè đến thăm sinh viên thường ưu tiên nơi ở dễ tìm, di chuyển ngắn và có chỗ để xe."]},
    {"heading":"Đừng chỉ nhìn số kilomet","paragraphs":["Khoảng cách đường chim bay có thể khác thời gian đi thực tế. Hãy mở bản đồ để xem tuyến đường kết nối và vị trí lối vào, đặc biệt nếu bạn đến muộn."]},
    {"heading":"Chọn theo thời gian lưu trú","paragraphs":["Ở một đêm nên ưu tiên sự tiện lợi. Ở hai đến ba ngày có thể cân nhắc nơi rộng hơn, có không gian sinh hoạt chung hoặc bếp."]}
  ]$json$::jsonb,
  ARRAY['homestay gần FPT','Đại học FPT','Hòa Lạc'], FALSE,
  'FPT', 'homestay', 4, 'PUBLISHED', NOW() - INTERVAL '11 days'
),
(
  'dia-diem-check-in-hoa-lac',
  'Địa điểm check-in Hòa Lạc: gợi ý cho chiều đẹp trời',
  'Một số tiêu chí giúp chọn nơi chụp ảnh, đi dạo và check-in quanh Hòa Lạc mà không cần lên lịch quá phức tạp.',
  'check-in', 'Check-in', 'CHECK-IN',
  'Địa điểm check-in Hòa Lạc đẹp và dễ đi',
  'Gợi ý địa điểm check-in Hòa Lạc cho chụp ảnh, đi dạo và gặp gỡ; xem vị trí trực tiếp trên HOLA Maps.',
  $json$[
    {"heading":"Ánh sáng quyết định rất nhiều","paragraphs":["Nếu chụp ngoài trời, sáng sớm và cuối chiều thường cho ánh sáng dễ chịu hơn. Giữa trưa phù hợp hơn với các địa điểm có nhiều bóng râm hoặc không gian trong nhà."]},
    {"heading":"Đừng quên yếu tố di chuyển","paragraphs":["Một địa điểm đẹp nhưng quá xa các điểm còn lại có thể khiến lịch trình bị rời rạc. Hãy chọn hai hoặc ba điểm nằm cùng một hướng để có nhiều thời gian trải nghiệm hơn."]},
    {"heading":"Tôn trọng không gian địa phương","paragraphs":["Khi chụp tại khu dân cư, cơ sở kinh doanh hoặc địa điểm cộng đồng, hãy tôn trọng biển chỉ dẫn và không làm cản trở hoạt động của người khác."]}
  ]$json$::jsonb,
  ARRAY['check-in','Hòa Lạc','chụp ảnh','đi chơi'], FALSE,
  NULL, 'check-in', 4, 'PUBLISHED', NOW() - INTERVAL '10 days'
),
(
  'hoa-lac-di-dau-cuoi-tuan',
  'Cuối tuần ở Hòa Lạc đi đâu? Lịch trình nhẹ nhàng không cần đi xa',
  'Một gợi ý đơn giản để kết hợp đi chơi, ăn uống và cafe trong cùng ngày quanh Hòa Lạc.',
  'choi-gi', 'Chơi gì', 'CUỐI TUẦN',
  'Cuối tuần ở Hòa Lạc đi đâu? Gợi ý lịch trình',
  'Cuối tuần ở Hòa Lạc đi đâu? Gợi ý lịch trình ăn uống, đi chơi và cafe, có bản đồ để ghép điểm nhanh.',
  $json$[
    {"heading":"Buổi sáng: ưu tiên ngoài trời","paragraphs":["Nếu thời tiết thuận lợi, buổi sáng phù hợp cho điểm xanh, khu trải nghiệm hoặc một cung đường có cảnh quan. Khởi hành sớm giúp tránh nắng và có nhiều thời gian hơn."]},
    {"heading":"Buổi trưa: chọn điểm ăn thuận đường","paragraphs":["Thay vì quay lại trung tâm chỉ để ăn, hãy chọn quán nằm giữa điểm buổi sáng và điểm buổi chiều. Đây là lúc bản đồ hữu ích nhất khi ghép lịch trình."]},
    {"heading":"Buổi chiều: cafe hoặc check-in","paragraphs":["Kết thúc bằng một quán cafe hoặc địa điểm chụp ảnh giúp lịch trình nhẹ hơn. Nếu đi gia đình, nên để khoảng nghỉ đủ dài trước khi quay về."]}
  ]$json$::jsonb,
  ARRAY['cuối tuần','Hòa Lạc','lịch trình','đi chơi'], FALSE,
  NULL, NULL, 5, 'PUBLISHED', NOW() - INTERVAL '9 days'
),
(
  'lich-trinh-hoa-lac-1-ngay',
  'Lịch trình Hòa Lạc 1 ngày: đi thế nào để không bị vòng đường?',
  'Gợi ý cách xếp một ngày ở Hòa Lạc theo cụm điểm, thời gian ăn uống và khoảng nghỉ.',
  'cam-nang', 'Cẩm nang', 'LỊCH TRÌNH',
  'Lịch trình Hòa Lạc 1 ngày dễ đi, ít vòng đường',
  'Gợi ý lịch trình Hòa Lạc 1 ngày theo cụm địa điểm, ăn uống và cafe để giảm thời gian di chuyển.',
  $json$[
    {"heading":"Chia ngày thành ba chặng","paragraphs":["Một lịch trình dễ theo dõi thường gồm điểm chính buổi sáng, bữa trưa ở khu thuận đường và một hoạt động nhẹ vào buổi chiều. Không nên nhồi quá nhiều địa điểm nếu thời gian di chuyển chưa rõ."]},
    {"heading":"Xếp theo vị trí, không chỉ theo sở thích","paragraphs":["Sau khi chọn danh sách mong muốn, hãy mở từng điểm trên HOLA Maps và loại bỏ các điểm khiến tuyến đường bị zig-zag. Ba điểm hợp tuyến thường mang lại trải nghiệm tốt hơn năm điểm nằm rải rác."]},
    {"heading":"Luôn có phương án B","paragraphs":["Thời tiết hoặc giờ hoạt động có thể thay đổi. Chuẩn bị một quán cafe hoặc điểm trong nhà gần tuyến chính sẽ giúp lịch trình linh hoạt hơn."]}
  ]$json$::jsonb,
  ARRAY['lịch trình','Hòa Lạc','1 ngày','du lịch'], FALSE,
  NULL, NULL, 5, 'PUBLISHED', NOW() - INTERVAL '8 days'
),
(
  'dia-diem-picnic-hoa-lac',
  'Picnic quanh Hòa Lạc: chuẩn bị gì trước khi đi?',
  'Gợi ý cách chọn điểm picnic và chuẩn bị cho chuyến đi ngắn với bạn bè hoặc gia đình quanh Hòa Lạc.',
  'choi-gi', 'Chơi gì', 'PICNIC',
  'Địa điểm picnic quanh Hòa Lạc và checklist trước khi đi',
  'Tìm ý tưởng picnic quanh Hòa Lạc và checklist chuẩn bị cho chuyến đi cùng gia đình hoặc nhóm bạn.',
  $json$[
    {"heading":"Kiểm tra điều kiện thực tế","paragraphs":["Không phải khoảng đất xanh nào cũng phù hợp để picnic. Hãy ưu tiên địa điểm có quy định rõ ràng, lối vào thuận tiện và không ảnh hưởng đất tư hoặc khu sản xuất."]},
    {"heading":"Checklist tối thiểu","paragraphs":["Nước uống, túi rác, đồ chống nắng, thuốc cá nhân và phương án trú mưa là những thứ cơ bản. Nếu có trẻ nhỏ, cần thêm lớp trải, đồ ăn phù hợp và khu vực an toàn."],"bullets":["Nước và đồ ăn gọn","Túi rác cá nhân","Chống nắng hoặc áo mưa","Pin dự phòng"]},
    {"heading":"Giữ nguyên trạng sau khi rời đi","paragraphs":["Một chuyến picnic tốt kết thúc khi khu vực sạch như trước lúc bạn đến. Không để rác, không đốt lửa ở nơi không được phép và hạn chế tiếng ồn gần khu dân cư."]}
  ]$json$::jsonb,
  ARRAY['picnic','Hòa Lạc','gia đình','ngoài trời'], FALSE,
  NULL, 'trai-nghiem', 4, 'PUBLISHED', NOW() - INTERVAL '7 days'
),
(
  'cafe-dep-thach-that',
  'Cafe đẹp ở Thạch Thất: tìm quán theo view, không gian và mục đích',
  'Gợi ý cách tìm cafe ở Thạch Thất khi cần làm việc, gặp bạn, chụp ảnh hoặc nghỉ chân trên hành trình qua Hòa Lạc.',
  'cafe', 'Cafe', 'THẠCH THẤT',
  'Cafe đẹp Thạch Thất gần Hòa Lạc',
  'Tìm cafe đẹp ở Thạch Thất gần Hòa Lạc theo nhu cầu làm việc, gặp gỡ và check-in trên HOLA Maps.',
  $json$[
    {"heading":"Thạch Thất có nhiều kiểu không gian","paragraphs":["Từ quán trong khu dân cư đến những nơi có sân vườn, lựa chọn phù hợp phụ thuộc vào thời gian bạn muốn ngồi và mục đích chuyến đi."]},
    {"heading":"Nếu chỉ ghé nghỉ chân","paragraphs":["Hãy ưu tiên nơi gần trục đường đang đi, có chỗ để xe và phục vụ nhanh. Nếu dành cả buổi, có thể mở rộng phạm vi để chọn không gian phù hợp hơn."]},
    {"heading":"Xem cụm quán trên bản đồ","paragraphs":["Mở HOLA Maps giúp bạn so sánh vị trí quán với các địa điểm khác ở Thạch Thất thay vì chọn dựa trên tên gọi một mình."]}
  ]$json$::jsonb,
  ARRAY['cafe Thạch Thất','cafe đẹp','Hòa Lạc'], FALSE,
  'Thạch Thất', 'cafe', 4, 'PUBLISHED', NOW() - INTERVAL '6 days'
),
(
  'quan-an-ngon-thach-that',
  'Quán ăn ở Thạch Thất: chọn theo khu vực và thời điểm',
  'Cách tìm quán ăn quanh Thạch Thất khi bạn đang ở Hòa Lạc, đi công việc hoặc cần một điểm ăn thuận tuyến.',
  'an-gi', 'Ăn gì', 'THẠCH THẤT',
  'Quán ăn Thạch Thất gần Hòa Lạc',
  'Gợi ý tìm quán ăn ở Thạch Thất và khu vực Hòa Lạc theo vị trí, thời gian và nhu cầu đi nhóm.',
  $json$[
    {"heading":"Khu vực quyết định sự tiện lợi","paragraphs":["Thạch Thất có phạm vi rộng nên tên huyện chưa đủ để biết quán có thực sự gần bạn hay không. Hãy xem địa chỉ cụ thể và vị trí trên bản đồ trước khi đi."]},
    {"heading":"Giờ ăn đông nên có lựa chọn dự phòng","paragraphs":["Buổi trưa và tối cuối tuần, quán đông có thể làm thời gian chờ tăng. Lưu thêm một địa điểm gần đó giúp bạn chủ động hơn."]},
    {"heading":"Đóng góp dữ liệu địa phương","paragraphs":["Nếu phát hiện địa chỉ, giờ mở cửa hoặc trạng thái quán đã thay đổi, bạn có thể gửi cập nhật để dữ liệu phục vụ những người đến sau chính xác hơn."]}
  ]$json$::jsonb,
  ARRAY['quán ăn Thạch Thất','ăn uống','Hòa Lạc'], FALSE,
  'Thạch Thất', 'an-uong', 4, 'PUBLISHED', NOW() - INTERVAL '5 days'
),
(
  'choi-gi-o-thach-that',
  'Thạch Thất chơi gì? Gợi ý kết hợp với một ngày ở Hòa Lạc',
  'Nếu đang ở Hòa Lạc, bạn có thể mở rộng lịch trình sang Thạch Thất với các điểm trải nghiệm, cafe và ăn uống gần tuyến.',
  'choi-gi', 'Chơi gì', 'THẠCH THẤT',
  'Thạch Thất chơi gì? Gợi ý gần Hòa Lạc',
  'Thạch Thất chơi gì? Gợi ý điểm trải nghiệm, cafe và ăn uống có thể kết hợp trong chuyến đi Hòa Lạc.',
  $json$[
    {"heading":"Đi theo cụm thay vì theo danh sách dài","paragraphs":["Thạch Thất có nhiều xã và khoảng cách giữa các điểm có thể lớn hơn bạn tưởng. Chọn một cụm địa điểm cùng hướng sẽ giúp chuyến đi dễ chịu hơn."]},
    {"heading":"Kết hợp ăn và chơi","paragraphs":["Một điểm trải nghiệm buổi sáng, quán ăn trưa thuận tuyến và cafe buổi chiều là công thức đơn giản. Bạn có thể thay đổi thứ tự theo thời tiết."]},
    {"heading":"Kiểm tra trước giờ hoạt động","paragraphs":["Một số điểm địa phương có lịch hoạt động không cố định. Nếu thông tin chưa mới, nên gọi xác nhận trước khi di chuyển xa."]}
  ]$json$::jsonb,
  ARRAY['Thạch Thất','chơi gì','Hòa Lạc','đi chơi'], FALSE,
  'Thạch Thất', NULL, 4, 'PUBLISHED', NOW() - INTERVAL '4 days'
),
(
  'dia-diem-hen-ho-hoa-lac',
  'Hẹn hò ở Hòa Lạc: chọn nơi nào để nói chuyện thoải mái?',
  'Gợi ý chọn địa điểm hẹn hò ở Hòa Lạc theo thời gian trong ngày, độ yên tĩnh và khoảng cách di chuyển.',
  'choi-gi', 'Chơi gì', 'HẸN HÒ',
  'Địa điểm hẹn hò Hòa Lạc: cafe, đi dạo và ăn tối',
  'Gợi ý địa điểm hẹn hò ở Hòa Lạc cho cafe, đi dạo hoặc ăn tối; xem vị trí và khoảng cách trên HOLA Maps.',
  $json$[
    {"heading":"Buổi đầu nên chọn nơi dễ nói chuyện","paragraphs":["Một quán quá ồn hoặc quá đông có thể khiến cuộc gặp gượng gạo. Không gian vừa phải, dễ tìm và có lựa chọn đồ uống đơn giản thường an toàn hơn."]},
    {"heading":"Ghép hai hoạt động gần nhau","paragraphs":["Cafe rồi đi dạo, hoặc đi chơi rồi ăn tối, sẽ tự nhiên hơn nếu hai địa điểm gần nhau. Hãy kiểm tra bản đồ trước để tránh mất nhiều thời gian di chuyển."]},
    {"heading":"Tôn trọng sở thích của cả hai","paragraphs":["Một người thích chụp ảnh chưa chắc người còn lại thích nơi đông. Chọn phương án trung tính cho buổi đầu và lưu các trải nghiệm đặc biệt hơn cho những lần sau."]}
  ]$json$::jsonb,
  ARRAY['hẹn hò','Hòa Lạc','cafe','ăn tối'], FALSE,
  NULL, 'cafe', 4, 'PUBLISHED', NOW() - INTERVAL '3 days'
),
(
  'quan-cafe-lam-viec-hoa-lac',
  'Cafe làm việc ở Hòa Lạc: cần nhìn gì ngoài wifi?',
  'Chọn quán cafe để học hoặc làm việc ở Hòa Lạc theo độ ồn, bàn ghế, ổ cắm và thời gian ngồi.',
  'cafe', 'Cafe', 'LÀM VIỆC',
  'Cafe làm việc Hòa Lạc: yên tĩnh, bàn rộng, dễ ngồi lâu',
  'Gợi ý tiêu chí chọn cafe làm việc ở Hòa Lạc: độ ồn, bàn ghế, ổ cắm, giờ mở cửa và vị trí.',
  $json$[
    {"heading":"Wifi chỉ là điều kiện đầu tiên","paragraphs":["Một buổi làm việc dài cần bàn đủ rộng, ghế ổn, ánh sáng dễ chịu và không gian không quá ồn. Ổ cắm cũng quan trọng nếu bạn dùng laptop nhiều giờ."]},
    {"heading":"Chọn khung giờ thông minh","paragraphs":["Một quán yên vào sáng ngày thường có thể rất đông vào tối cuối tuần. Nếu cần tập trung, hãy cân nhắc thời điểm trước cả việc chọn quán."]},
    {"heading":"Lưu vài lựa chọn gần nhau","paragraphs":["Nếu quán đầu tiên kín chỗ, có một phương án thứ hai trong bán kính ngắn sẽ tiết kiệm thời gian. HOLA Maps phù hợp để lưu và so sánh các điểm gần nhau."]}
  ]$json$::jsonb,
  ARRAY['cafe làm việc','Hòa Lạc','học tập','wifi'], FALSE,
  NULL, 'cafe', 4, 'PUBLISHED', NOW() - INTERVAL '2 days'
),
(
  'an-dem-o-hoa-lac',
  'Ăn đêm ở Hòa Lạc: cách tìm quán còn mở mà không đi lòng vòng',
  'Gợi ý tìm đồ ăn tối muộn quanh Hòa Lạc và những điều nên kiểm tra trước khi lên đường.',
  'an-gi', 'Ăn gì', 'ĂN ĐÊM',
  'Ăn đêm ở Hòa Lạc: tìm quán mở muộn',
  'Tìm quán ăn đêm ở Hòa Lạc và cách kiểm tra giờ mở cửa, vị trí, khoảng cách trước khi đi.',
  $json$[
    {"heading":"Giờ mở cửa là dữ liệu dễ thay đổi","paragraphs":["Quán mở muộn có thể thay lịch theo ngày trong tuần hoặc mùa. Vì vậy trạng thái trên bản đồ nên được xem như thông tin tham khảo nếu dữ liệu đã lâu chưa cập nhật."]},
    {"heading":"Ưu tiên tuyến đường quen và sáng","paragraphs":["Khi đi muộn, sự thuận tiện và an toàn quan trọng hơn việc cố tìm một quán xa chỉ vì nổi tiếng. Chọn điểm trên tuyến đường rõ ràng, dễ dừng xe và gần khu có hoạt động."]},
    {"heading":"Cập nhật cho người đi sau","paragraphs":["Nếu bạn tới nơi và thấy quán đã đóng hoặc đổi giờ, một đóng góp ngắn trên HOLA Maps có thể giúp rất nhiều người khác."]}
  ]$json$::jsonb,
  ARRAY['ăn đêm','Hòa Lạc','mở muộn','quán ăn'], FALSE,
  NULL, 'an-uong', 4, 'PUBLISHED', NOW() - INTERVAL '1 day'
),
(
  'dia-diem-moi-o-hoa-lac',
  'Địa điểm mới ở Hòa Lạc: cách theo dõi nơi vừa được cộng đồng cập nhật',
  'Hòa Lạc thay đổi nhanh. Đây là cách dùng dữ liệu cộng đồng để tìm những địa điểm mới và kiểm tra mức độ cập nhật trước khi đi.',
  'cam-nang', 'Cẩm nang', 'MỚI Ở HÒA LẠC',
  'Địa điểm mới ở Hòa Lạc được cộng đồng cập nhật',
  'Theo dõi địa điểm mới ở Hòa Lạc và kiểm tra dữ liệu cộng đồng, thời điểm cập nhật, vị trí trên HOLA Maps.',
  $json$[
    {"heading":"Địa điểm mới cần thời gian để hoàn thiện dữ liệu","paragraphs":["Một địa điểm vừa xuất hiện trên bản đồ có thể chưa có đủ ảnh, đánh giá hoặc giờ hoạt động. Điều đó không có nghĩa dữ liệu kém; nó chỉ cho thấy cộng đồng đang ở giai đoạn đầu bổ sung thông tin."]},
    {"heading":"Xem thời điểm cập nhật","paragraphs":["HOLA Maps hiển thị tín hiệu về độ mới của dữ liệu để người dùng cân nhắc. Với địa điểm mới, ảnh thực tế và xác nhận của nhiều người là những dữ kiện đặc biệt hữu ích."]},
    {"heading":"Bạn cũng có thể đóng góp","paragraphs":["Nếu đã ghé một nơi mới, bạn có thể thêm ảnh hoặc đề xuất chỉnh sửa. Những cập nhật nhỏ nhưng đúng thực tế tạo giá trị lớn cho bản đồ địa phương."]}
  ]$json$::jsonb,
  ARRAY['địa điểm mới','Hòa Lạc','cộng đồng','bản đồ'], TRUE,
  NULL, NULL, 4, 'PUBLISHED', NOW()
)
ON CONFLICT (slug) DO NOTHING;
