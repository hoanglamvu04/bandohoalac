-- HOLA Maps local SEO content batch 02.
-- These are intent-specific guides that extend the existing 20-article hub.
-- No venue hours, prices, phone numbers, rankings or review claims are invented.
-- Related place cards are resolved dynamically from published HOLA Maps records.
-- Re-runnable: the production migration runner reapplies every SQL migration.

INSERT INTO explore_articles (
  slug, title, excerpt, category_slug, category_label, eyebrow,
  seo_title, seo_description, body, tags, featured,
  related_query, related_category, reading_minutes, status, published_at
) VALUES
(
  'quan-an-sang-hoa-lac',
  'Ăn sáng ở Hòa Lạc: chọn quán theo giờ học và làm việc',
  'Tìm quán ăn sáng Hòa Lạc theo thời gian, vị trí và nhu cầu ăn nhanh hay ngồi lại; biết cách kiểm tra thông tin trước khi xuất phát.',
  'an-gi', 'Ăn gì', 'ĂN SÁNG HÒA LẠC',
  'Ăn sáng ở Hòa Lạc: tìm quán phù hợp gần bạn',
  'Tìm quán ăn sáng ở Hòa Lạc theo vị trí, thời gian và nhu cầu ăn nhanh hay ngồi lại. Xem địa điểm đã xuất bản trên bản đồ HOLA Maps.',
  $json$[
    {
      "heading":"Ăn sáng ở Hòa Lạc nên bắt đầu từ lịch trình",
      "paragraphs":[
        "Một bữa sáng phù hợp không chỉ phụ thuộc món ăn. Với người đi học hoặc đi làm sớm, thời gian phục vụ và vị trí trên tuyến đường quan trọng không kém khoảng cách tính theo đường chim bay. Với người có nhiều thời gian hơn, chỗ ngồi, không gian và khả năng đi cùng bạn bè lại đáng cân nhắc.",
        "Hòa Lạc có nhiều cụm trường học, nơi làm việc và khu dân cư nằm cách nhau. Vì vậy, hãy xác định điểm xuất phát và nơi cần đến trước khi chọn quán. Một địa điểm nằm gần điểm đến nhưng ngược hướng di chuyển đôi khi khiến hành trình mất thêm thời gian."
      ],
      "bullets":[
        "Trước giờ học hoặc làm: ưu tiên quán thuận tuyến, phục vụ nhanh và dễ dừng xe.",
        "Có khoảng nghỉ dài: cân nhắc nơi có chỗ ngồi thoải mái và dễ tìm.",
        "Đi cùng nhóm: kiểm tra sức chứa, chỗ để xe và khả năng gọi món cho nhiều người."
      ]
    },
    {
      "heading":"Chọn quán theo kiểu bữa sáng",
      "paragraphs":[
        "Nếu chỉ có một khoảng nghỉ ngắn, hãy chọn món dễ gọi và không cần chờ lâu. Khi đi cùng đồng nghiệp hoặc bạn học, thực đơn đa dạng và chỗ ngồi đủ rộng sẽ giúp cả nhóm dễ thống nhất hơn. Gia đình có trẻ nhỏ nên ưu tiên không gian thuận tiện, vệ sinh và lối ra vào an toàn.",
        "Không nên mặc định một quán mở cửa sớm chỉ vì từng thấy quán hoạt động vào buổi sáng. Giờ phục vụ có thể thay đổi theo ngày, mùa hoặc ngày nghỉ. Nếu lịch trình phụ thuộc vào bữa ăn, hãy kiểm tra thông tin mới nhất và liên hệ trực tiếp khi cần."
      ]
    },
    {
      "heading":"Ba thông tin nên kiểm tra trước khi đi",
      "paragraphs":[
        "Địa chỉ trên bản đồ cần khớp với tên quán và khu vực bạn định đến. Hãy xem ảnh thực tế, lối vào và vị trí đỗ xe nếu có; điều này đặc biệt hữu ích khi quán nằm trong ngõ hoặc trong khu dân cư.",
        "Giá món và thực đơn chỉ nên dùng để tham khảo khi có nguồn cập nhật rõ ràng. Nếu trang địa điểm chưa có menu hoặc mức giá, đừng suy đoán từ ảnh hay từ một quán khác cùng loại."
      ],
      "bullets":[
        "Giờ mở cửa và thời gian phục vụ bữa sáng.",
        "Địa chỉ, lối vào và chỗ dừng xe.",
        "Thực đơn, mức giá và phương thức thanh toán nếu đã được công bố."
      ]
    },
    {
      "heading":"Tìm địa điểm ăn sáng trên HOLA Maps",
      "paragraphs":[
        "Mở bản đồ, chọn nhóm Ăn uống và thu hẹp khu vực quanh điểm xuất phát hoặc điểm đến. Xem các địa điểm đã được xuất bản, đối chiếu ảnh và thông tin hiện có rồi mở trang chi tiết để kiểm tra vị trí.",
        "Nếu phát hiện giờ mở cửa, địa chỉ hoặc hình ảnh không còn đúng, hãy gửi đóng góp kèm thông tin có thể kiểm chứng. Một cập nhật chính xác giúp người đến sau chọn quán dễ hơn."
      ]
    }
  ]$json$::jsonb,
  ARRAY['ăn sáng','quán ăn sáng','Hòa Lạc','ăn uống Hòa Lạc'], FALSE,
  'ăn sáng', 'an-uong', 5, 'PUBLISHED', NOW()
),
(
  'an-toi-o-hoa-lac',
  'Ăn tối ở Hòa Lạc: chọn quán cho nhóm bạn và gia đình',
  'Cách tìm địa điểm ăn tối ở Hòa Lạc theo số người, không gian, tuyến đường và giờ hoạt động; những điều nên xác nhận trước khi đi.',
  'an-gi', 'Ăn gì', 'ĂN TỐI HÒA LẠC',
  'Ăn tối ở Hòa Lạc: chọn quán theo nhóm và nhu cầu',
  'Tìm địa điểm ăn tối ở Hòa Lạc cho cá nhân, nhóm bạn hoặc gia đình. So sánh vị trí, thông tin quán và đường đi trên HOLA Maps.',
  $json$[
    {
      "heading":"Ăn tối ở Hòa Lạc: chọn theo người đi cùng",
      "paragraphs":[
        "Một địa điểm phù hợp cho hai người chưa chắc phù hợp với nhóm đông. Khi đi một mình hoặc đi đôi, vị trí thuận đường và thời gian chờ có thể là ưu tiên chính. Với nhóm bạn, gia đình hoặc buổi gặp mặt, hãy quan tâm thêm sức chứa, cách bố trí bàn và khả năng đặt chỗ.",
        "Nếu có người đi từ nhiều khu vực khác nhau, nên chọn một điểm dễ xác định trên bản đồ thay vì chỉ chọn quán gần một người. Thống nhất địa điểm và giờ đến trước giúp cả nhóm tránh phải đổi quán vào phút cuối."
      ],
      "bullets":[
        "Đi nhanh sau giờ học hoặc làm: ưu tiên vị trí thuận tuyến và thời gian phục vụ phù hợp.",
        "Đi nhóm: xác nhận số chỗ, bàn lớn và khả năng đặt trước.",
        "Đi gia đình: xem lối vào, chỗ để xe và tiện ích cần thiết."
      ]
    },
    {
      "heading":"Đừng chỉ nhìn ảnh món ăn",
      "paragraphs":[
        "Ảnh đẹp giúp hình dung không gian nhưng không thay thế được thông tin về giờ hoạt động, thực đơn và sức chứa. Một số quán có thể phục vụ khác nhau giữa ngày thường và cuối tuần; một số nơi cần đặt bàn khi đi nhóm đông.",
        "Nếu muốn ăn món cụ thể, hãy kiểm tra menu hiện tại thay vì dựa vào bài đăng cũ. Mức giá có thể thay đổi theo khẩu phần, combo hoặc thời điểm; chỉ sử dụng mức giá được quán công bố gần đây."
      ]
    },
    {
      "heading":"Lên đường thuận tiện và tránh đi vòng",
      "paragraphs":[
        "Trước khi rời nhà, hãy mở vị trí quán và xem lối tiếp cận từ hướng bạn đang đi. Khoảng cách ngắn trên bản đồ không phải lúc nào cũng đồng nghĩa với thời gian di chuyển ngắn nếu điểm đến nằm bên kia trục đường hoặc có lối vào hạn chế.",
        "Nếu dự định kết hợp ăn tối với cà phê hoặc một điểm dạo chơi, hãy chọn các địa điểm cùng khu vực để giảm thời gian quay đầu. Đừng xếp quá nhiều điểm nếu nhóm có trẻ nhỏ hoặc cần về sớm."
      ],
      "bullets":[
        "Lưu sẵn vị trí quán và gửi cho các thành viên.",
        "Xác nhận giờ phục vụ vào ngày dự định đi.",
        "Hỏi trước về đặt bàn nếu nhóm đông hoặc đi vào cuối tuần."
      ]
    },
    {
      "heading":"Dùng HOLA Maps để so sánh địa điểm",
      "paragraphs":[
        "Trong HOLA Maps, chọn nhóm Ăn uống rồi xem các địa điểm quanh khu vực bạn muốn đến. Mở từng hồ sơ để kiểm tra ảnh, địa chỉ, thông tin liên hệ và thời điểm cập nhật nếu được hiển thị.",
        "Thông tin còn thiếu nên được xem là chưa xác nhận, không phải mặc nhiên đúng. Khi cần chắc chắn về giờ mở cửa, bàn trống hoặc menu, hãy liên hệ trực tiếp với cơ sở trước khi di chuyển."
      ]
    }
  ]$json$::jsonb,
  ARRAY['ăn tối','quán ăn tối','nhà hàng Hòa Lạc','ăn uống'], FALSE,
  'ăn tối', 'an-uong', 5, 'PUBLISHED', NOW()
),
(
  'quan-lau-hoa-lac',
  'Ăn lẩu ở Hòa Lạc: cách chọn quán cho nhóm đông',
  'Tìm quán lẩu ở Hòa Lạc theo số người, loại món, không gian và khả năng đặt bàn; checklist giúp nhóm chọn địa điểm phù hợp.',
  'an-gi', 'Ăn gì', 'ẨM THỰC HÒA LẠC',
  'Quán lẩu ở Hòa Lạc: kinh nghiệm chọn địa điểm đi nhóm',
  'Tìm quán lẩu ở Hòa Lạc cho nhóm bạn và gia đình. Kiểm tra sức chứa, thực đơn, vị trí và thông tin đặt bàn trước khi đi.',
  $json$[
    {
      "heading":"Vì sao nên chọn quán lẩu theo quy mô nhóm?",
      "paragraphs":[
        "Bữa lẩu thường phù hợp với những buổi gặp mặt cần thời gian ngồi cùng nhau. Tuy nhiên, trải nghiệm phụ thuộc nhiều vào số người, cách bố trí bàn và khả năng phục vụ của quán. Nhóm nhỏ có thể linh hoạt hơn; nhóm đông nên xác nhận trước để tránh phải tách bàn hoặc chờ lâu.",
        "Trước khi tìm quán, hãy thống nhất số người, thời gian đến và nhu cầu ăn uống. Nếu có trẻ nhỏ, người lớn tuổi hoặc người cần chế độ ăn riêng, nên hỏi quán về lựa chọn món và cách bố trí chỗ ngồi."
      ],
      "bullets":[
        "Số người thực tế và khả năng có mặt cùng giờ.",
        "Nhu cầu bàn chung, phòng riêng hoặc chỗ ngồi thoáng.",
        "Các yêu cầu ăn uống đặc biệt cần báo trước."
      ]
    },
    {
      "heading":"Kiểm tra thực đơn và cách tính giá",
      "paragraphs":[
        "Khi xem menu, hãy phân biệt giá theo nồi, theo suất, theo combo hay theo món gọi thêm. Một mức giá hiển thị riêng lẻ chưa chắc phản ánh tổng chi phí của cả nhóm. Nên hỏi rõ khẩu phần, món đi kèm, đồ uống và các khoản phụ thu nếu có.",
        "Nếu muốn ăn một loại lẩu cụ thể, hãy xác nhận món đó còn phục vụ vào ngày bạn đến. Không nên mặc định quán có món chỉ vì món ấy xuất hiện trong ảnh cũ hoặc trong bài giới thiệu từ lâu."
      ]
    },
    {
      "heading":"Không gian, chỗ để xe và thời gian chờ",
      "paragraphs":[
        "Với nhóm đông, bàn đủ rộng và lối đi thuận tiện quan trọng không kém món ăn. Hãy xem ảnh không gian, vị trí quán và thông tin đỗ xe nếu được công bố. Nếu đi vào khung giờ cao điểm, đặt bàn trước là cách giảm rủi ro phải chờ.",
        "Địa điểm nằm gần nhau trên bản đồ có thể có lối vào khác nhau. Mở trang chi tiết và kiểm tra điểm ghim trước khi xuất phát, nhất là khi đi theo nhóm nhiều xe."
      ],
      "bullets":[
        "Xác nhận giờ mở cửa và khả năng nhận khách tại thời điểm đến.",
        "Hỏi về đặt bàn, số chỗ và chỗ để xe.",
        "Kiểm tra địa chỉ và lối vào chính xác."
      ]
    },
    {
      "heading":"Tìm quán lẩu trên bản đồ Hòa Lạc",
      "paragraphs":[
        "Mở danh mục Ăn uống trên HOLA Maps và xem các địa điểm đã xuất bản quanh khu vực phù hợp. Dùng ảnh, mô tả và thông tin liên hệ để lập danh sách ngắn, sau đó xác nhận menu và bàn trống trực tiếp với quán.",
        "Các thẻ địa điểm bên dưới được lấy từ dữ liệu đã xuất bản trên HOLA Maps. Nếu một địa điểm chưa có thông tin món lẩu, hãy coi đó là gợi ý để kiểm tra thêm chứ không phải xác nhận rằng quán chắc chắn đang phục vụ món này."
      ]
    }
  ]$json$::jsonb,
  ARRAY['quán lẩu','ăn lẩu Hòa Lạc','đi ăn nhóm','nhà hàng'], FALSE,
  'lẩu', 'an-uong', 5, 'PUBLISHED', NOW()
),
(
  'ca-phe-gan-ho-tan-xa',
  'Cà phê gần hồ Tân Xã: chọn chỗ ngồi và ngắm cảnh',
  'Gợi ý cách tìm quán cà phê quanh hồ Tân Xã theo vị trí, không gian ngoài trời, thời điểm ghé và những thông tin cần xác nhận.',
  'cafe', 'Cafe', 'CÀ PHÊ TÂN XÃ',
  'Cà phê gần hồ Tân Xã: tìm quán quanh Hòa Lạc',
  'Tìm quán cà phê quanh hồ Tân Xã, Hòa Lạc theo vị trí, không gian và nhu cầu nghỉ chân. Xem địa điểm trên bản đồ HOLA Maps.',
  $json$[
    {
      "heading":"Chọn quán quanh hồ Tân Xã theo trải nghiệm mong muốn",
      "paragraphs":[
        "Khu vực hồ Tân Xã phù hợp để đưa vào một lịch trình nghỉ chân hoặc dạo quanh Hòa Lạc. Khi tìm quán cà phê gần hồ, hãy xác định bạn muốn ngồi ngoài trời, trò chuyện, chụp ảnh hay chỉ dừng lại uống nước trước khi tiếp tục hành trình.",
        "Không phải quán nào có địa chỉ gần hồ cũng có tầm nhìn trực tiếp ra mặt nước. Hãy xem ảnh do cơ sở hoặc cộng đồng đóng góp, kiểm tra vị trí ghim và đọc mô tả trước khi kỳ vọng về view."
      ],
      "bullets":[
        "Muốn ngắm cảnh: kiểm tra ảnh thực tế và khu vực chỗ ngồi ngoài trời.",
        "Muốn trò chuyện: ưu tiên không gian, độ ồn và cách bố trí bàn.",
        "Chỉ nghỉ chân: ưu tiên lối vào thuận tiện và vị trí trên tuyến đường."
      ]
    },
    {
      "heading":"Thời điểm ghé quán cũng ảnh hưởng trải nghiệm",
      "paragraphs":[
        "Buổi sáng và đầu giờ chiều có thể phù hợp với người muốn ngồi lâu hoặc làm việc nhẹ. Cuối buổi chiều, nhiều người chọn khu vực hồ để thư giãn và chụp ảnh. Tuy nhiên, ánh sáng, thời tiết và lượng khách thay đổi theo ngày nên không có một khung giờ tốt cho mọi chuyến đi.",
        "Nếu chọn chỗ ngồi ngoài trời, hãy chuẩn bị phương án khi trời mưa hoặc nắng gắt. Vào buổi tối, kiểm tra giờ hoạt động và đường về trước khi quyết định ở lại lâu."
      ]
    },
    {
      "heading":"Kiểm tra vị trí thay vì chỉ tìm theo tên",
      "paragraphs":[
        "Tên quán hoặc tên khu vực đôi khi được viết khác nhau trên các nền tảng. Khi đã tìm được lựa chọn, hãy mở bản đồ, kiểm tra điểm ghim và đối chiếu địa chỉ. Nếu đi cùng người khác, gửi đường dẫn vị trí để cả nhóm đến cùng một điểm.",
        "Thông tin giờ mở cửa, số điện thoại và dịch vụ ngoài trời có thể thay đổi. Nếu những chi tiết này quyết định chuyến đi, hãy xác nhận trực tiếp với quán trước khi khởi hành."
      ]
    },
    {
      "heading":"Tìm quán cà phê quanh Tân Xã trên HOLA Maps",
      "paragraphs":[
        "Chọn danh mục Cafe và tìm quanh khu vực Tân Xã. Xem ảnh, địa chỉ, mô tả và thời điểm cập nhật của từng hồ sơ; sau đó mở chỉ đường để so sánh các lựa chọn trên cùng một hành trình.",
        "Nếu bạn biết một quán mới hoặc phát hiện vị trí ghim chưa chính xác, hãy gửi đóng góp kèm ảnh và thông tin có thể kiểm chứng. Điều đó giúp người tìm cà phê quanh hồ Tân Xã có dữ liệu tốt hơn."
      ]
    }
  ]$json$::jsonb,
  ARRAY['cà phê Tân Xã','hồ Tân Xã','quán cafe Hòa Lạc','cafe view hồ'], FALSE,
  'Tân Xã', 'cafe', 5, 'PUBLISHED', NOW()
),
(
  'cam-trai-quanh-hoa-lac',
  'Cắm trại quanh Hòa Lạc: checklist trước khi chọn địa điểm',
  'Những điều cần kiểm tra khi chọn điểm cắm trại quanh Hòa Lạc: đặt chỗ, tiện ích, an toàn, thời tiết, di chuyển và vệ sinh môi trường.',
  'trai-nghiem', 'Trải nghiệm', 'TRẢI NGHIỆM CUỐI TUẦN',
  'Cắm trại quanh Hòa Lạc: checklist chọn điểm đi',
  'Lên kế hoạch cắm trại quanh Hòa Lạc với checklist về đặt chỗ, tiện ích, an toàn, thời tiết và di chuyển trước chuyến đi.',
  $json$[
    {
      "heading":"Chọn điểm cắm trại theo kiểu chuyến đi",
      "paragraphs":[
        "Một buổi dã ngoại trong ngày có yêu cầu khác với chuyến cắm trại qua đêm. Đi trong ngày thường cần lối vào thuận tiện, khu vực nghỉ chân và phương án ăn uống. Ở lại qua đêm cần kiểm tra kỹ hơn về nơi dựng lều, vệ sinh, chiếu sáng, an ninh và quy định của đơn vị quản lý.",
        "Không nên coi mọi bãi đất trống hoặc khu vực ven hồ là điểm cắm trại được phép. Hãy ưu tiên địa điểm có thông tin quản lý rõ ràng và xác nhận trước hoạt động nào được cho phép."
      ],
      "bullets":[
        "Đi trong ngày: lối vào, chỗ nghỉ, nước uống và nhà vệ sinh.",
        "Qua đêm: quy định lưu trú, khu dựng lều, an ninh và chiếu sáng.",
        "Đi cùng trẻ nhỏ: địa hình, rào chắn, nguồn nước và khoảng cách di chuyển."
      ]
    },
    {
      "heading":"Xác nhận đặt chỗ và tiện ích trước khi đi",
      "paragraphs":[
        "Ảnh trên mạng có thể chỉ phản ánh một góc của khu trải nghiệm. Trước khi đặt chỗ, hãy hỏi rõ phí vào cửa, phí thuê lều hoặc dụng cụ, khu vực được sử dụng, giờ nhận và trả chỗ, cũng như chính sách khi thời tiết xấu.",
        "Nếu cần nấu ăn, đốt lửa hoặc mang thú cưng, phải hỏi quy định cụ thể của địa điểm. Không tự ý nhóm lửa ở nơi chưa được cho phép và không sử dụng bếp hoặc thiết bị sinh nhiệt trong lều kín."
      ]
    },
    {
      "heading":"Chuẩn bị an toàn và giữ gìn môi trường",
      "paragraphs":[
        "Thời tiết khu vực ngoài trời có thể thay đổi nhanh. Kiểm tra dự báo gần ngày đi, chuẩn bị áo mưa, nước uống, thuốc cá nhân và pin dự phòng. Nếu đi theo nhóm, thống nhất điểm tập trung và cách liên lạc khi tách đoàn.",
        "Hãy mang túi đựng rác, thu dọn khu vực trước khi rời đi và tuân thủ hướng dẫn của đơn vị quản lý. Không gây tiếng ồn quá mức vào buổi tối và không xâm phạm khu vực riêng tư hoặc đất chưa được phép sử dụng."
      ],
      "bullets":[
        "Xác nhận thời tiết và quy định của địa điểm.",
        "Chuẩn bị nước uống, đồ sơ cứu cơ bản và thiết bị chiếu sáng phù hợp.",
        "Không đốt lửa nếu chưa được cho phép; dọn sạch rác trước khi rời đi."
      ]
    },
    {
      "heading":"Tìm điểm trải nghiệm quanh Hòa Lạc trên bản đồ",
      "paragraphs":[
        "Trên HOLA Maps, mở nhóm Trải nghiệm và tìm các địa điểm đã được xuất bản quanh khu vực bạn muốn đến. Đọc mô tả, xem ảnh và kiểm tra vị trí trước khi liên hệ đơn vị vận hành để xác nhận dịch vụ cắm trại còn được cung cấp.",
        "Thẻ địa điểm bên dưới là dữ liệu địa phương đã xuất bản, không thay thế việc xác nhận quy định, tình trạng chỗ trống hoặc dịch vụ theo ngày. Hãy liên hệ trực tiếp trước khi lên đường, đặc biệt khi đi nhóm đông hoặc qua đêm."
      ]
    }
  ]$json$::jsonb,
  ARRAY['cắm trại Hòa Lạc','camping Hòa Lạc','dã ngoại','trải nghiệm cuối tuần'], FALSE,
  'cắm trại', 'trai-nghiem', 6, 'PUBLISHED', NOW()
),
(
  'di-hoa-lac-tu-ha-noi',
  'Đi Hòa Lạc từ Hà Nội: cách chọn tuyến và sắp xếp điểm dừng',
  'Cách lên kế hoạch đi Hòa Lạc từ Hà Nội theo điểm xuất phát, tuyến đường, thời gian dừng và các địa điểm muốn ghé trong ngày.',
  'cam-nang', 'Cẩm nang', 'HƯỚNG DẪN DI CHUYỂN',
  'Đi Hòa Lạc từ Hà Nội: chọn tuyến và điểm dừng',
  'Lên lịch đi Hòa Lạc từ Hà Nội theo điểm xuất phát, tuyến đường và các điểm muốn ghé. Dùng HOLA Maps để kiểm tra vị trí và chỉ đường.',
  $json$[
    {
      "heading":"Bắt đầu từ điểm xuất phát thực tế",
      "paragraphs":[
        "Hà Nội có nhiều khu vực xuất phát khác nhau, vì vậy không có một thời gian di chuyển cố định phù hợp cho tất cả mọi người. Hãy nhập đúng vị trí đang đứng, điểm đến cụ thể và thời gian dự kiến khởi hành để xem tuyến phù hợp tại thời điểm đi.",
        "Nếu điểm đến là một quán ăn, khu trải nghiệm hoặc cơ sở lưu trú, hãy dùng địa chỉ và vị trí ghim của chính địa điểm đó. Tìm chung chung theo tên khu vực có thể đưa bạn đến một điểm trung tâm khác với nơi cần tới."
      ]
    },
    {
      "heading":"Chọn tuyến theo mục đích chuyến đi",
      "paragraphs":[
        "Nếu chỉ đến một địa điểm, ưu tiên tuyến dễ đi và điểm đỗ xe thuận tiện. Nếu đi nhiều nơi trong ngày, hãy nhóm các điểm theo khu vực để hạn chế quay đầu hoặc di chuyển qua lại nhiều lần. Đừng xếp lịch quá sát vì thời gian dừng ở mỗi nơi thường khó dự đoán.",
        "Với chuyến đi gia đình hoặc nhóm đông, thống nhất điểm hẹn và gửi vị trí cho mọi người trước khi xuất phát. Nếu có người tự đi bằng phương tiện khác, nên chia sẻ cùng một điểm ghim thay vì chỉ gửi tên địa điểm."
      ],
      "bullets":[
        "Một điểm đến: kiểm tra đúng lối vào và nơi gửi xe.",
        "Nhiều điểm: sắp xếp theo cụm địa lý và thời gian mở cửa đã xác nhận.",
        "Đi theo nhóm: thống nhất điểm hẹn, người liên hệ và phương án khi đến muộn."
      ]
    },
    {
      "heading":"Chuẩn bị cho hành trình trong ngày",
      "paragraphs":[
        "Trước khi đi, kiểm tra tình trạng giao thông, thời tiết và các thông tin có thể ảnh hưởng đến hành trình. Mang theo nước uống, sạc điện thoại và lưu lại địa chỉ cần thiết trong trường hợp kết nối mạng không ổn định.",
        "Nếu lịch trình có bữa ăn hoặc hoạt động cần đặt chỗ, hãy liên hệ trước để xác nhận giờ phục vụ và tình trạng tiếp nhận khách. Không dựa vào một bài viết cũ để kết luận địa điểm vẫn mở hoặc còn chỗ."
      ]
    },
    {
      "heading":"Dùng HOLA Maps để ghép các điểm dừng",
      "paragraphs":[
        "Tìm địa điểm theo danh mục, mở hồ sơ để xem vị trí và chọn các điểm phù hợp với thời gian của bạn. Khi đã có danh sách ngắn, hãy so sánh khoảng cách và hướng di chuyển thay vì chỉ chọn từng nơi riêng lẻ.",
        "Sau chuyến đi, bạn có thể đóng góp ảnh hoặc cập nhật thông tin nếu phát hiện thay đổi. Những dữ liệu như lối vào, vị trí đỗ xe và tình trạng hoạt động có giá trị thực tế cho người đi sau."
      ]
    }
  ]$json$::jsonb,
  ARRAY['đi Hòa Lạc','đường đi Hòa Lạc','Hà Nội đi Hòa Lạc','chỉ đường'], FALSE,
  NULL, NULL, 5, 'PUBLISHED', NOW()
)
ON CONFLICT (slug) DO NOTHING;
