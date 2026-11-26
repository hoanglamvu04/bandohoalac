# HOLA-P1-110 — 30 BĐS DEMO tại huyện Thạch Thất cũ (chỉ staging)

## Phạm vi và nhãn an toàn

Bộ dữ liệu mô phỏng dành riêng cho **PostgreSQL test/staging**, không phải rao bán/cho thuê có thật.

- **30 tin**, gồm **15 phòng trọ** (RENT, property_type=NULL), **10 tài sản bán** và **5 tài sản khác cho thuê**.
- **120 hình minh họa** (4 ảnh/tin) dạng URL Unsplash; là ảnh mẫu, **không phải ảnh tài sản**. Liên kết ảnh bên ngoài cần kiểm tra trước khi nghiệm thu UI và có thể hỏng theo thời gian.
- Tất cả 30 tin có **diện tích**, **giá VND**, **mô tả**, **vị trí khu vực xấp xỉ**, và với phòng trọ còn có cọc/điện/nước/chỗ đỗ/tiện ích để kiểm thử bộ lọc.
- Các khu vực mang tên đơn vị hành chính **cũ của huyện Thạch Thất**, ví dụ Thạch Hòa, Tân Xã, Hạ Bằng, Bình Yên, Liên Quan, Đại Đồng, Lại Thượng, Phú Kim, Thạch Xá, Phùng Xá, Tiến Xuân, Yên Bình. **Tọa độ được tạo giả định trong vùng phục vụ HOLA**, không phải vị trí nhà/lô đất thật.
- Tiêu đề [DEMO xx], mô tả [DEMO - KHÔNG PHẢI TIN THẬT], giá có (DEMO). Số điện thoại 0000000001–0000000030 là **số không hợp lệ, chỉ để thử giao diện**, không có chủ nhà/CTV thực. Không dùng để liên hệ.
- Hình trên images.unsplash.com dùng làm minh họa theo [Unsplash License](https://unsplash.com/license). Không tự lưu ảnh từ tin rao thực tế, không sử dụng ảnh người nhận diện/thương hiệu và không ngụ ý chủ sở hữu ảnh cho thuê tài sản ở Thạch Thất. Không tải ảnh thực lên Cloudinary.
- Dữ liệu chỉ được gắn nhãn source='ADMIN' trong **fixture staging** và đặt status='PUBLISHED' để thử luồng trang công khai. Điều này **không cấp quyền xuất bản** cho người dùng thật hoặc vượt qua kiểm duyệt thông thường.

## Trước khi chạy

**KHÔNG chạy trên database production hoặc website hiện đang phục vụ khách thật.** Tạo DB riêng có tên rõ _demo, _test, _staging, _dev hoặc _ci đã áp dụng schema/migrations và kiểm tra kết nối trong máy chủ thử nghiệm. Tài khoản có quyền trên database thử nghiệm đó.

Lệnh guard chủ động từ chối:
1. NODE_ENV=production.
2. Tên DB không có hậu tố/đoạn demo|test|staging|dev|ci.
3. Thiếu câu xác nhận khác nhau cho seed và xóa.
4. Tên DB trả về từ SELECT current_database() khác URL khai báo.

Các guard không tự chứng minh database thật sự tách biệt; người vận hành phải xác nhận bằng hạ tầng.

## Preview, tạo và xóa

Chạy **tại thư mục backend của môi trường staging/test**, đã cài dependencies:

~~~bash
npm run demo:thachthat:preview
~~~

Để thêm **đúng 30 tin, 15 phòng trọ, 120 ảnh**, đặt DATABASE_URL trỏ tới DB staging bằng cơ chế bí mật của môi trường (không đưa vào Git/ảnh chụp terminal), NODE_ENV=development hoặc test, rồi chạy:

~~~bash
HOLA_DEMO_SEED_CONFIRM=SEED_30_THACH_THAT_DEMO npm run demo:thachthat:seed
~~~

Chạy lại lệnh seed vẫn giữ 30 tin vì upsert theo external_source + external_id, thay ảnh mẫu cùng namespace thay vì tạo trùng. Lệnh clean chỉ xóa đúng các cặp external_source, external_id, slug của 30 mẫu:

~~~bash
HOLA_DEMO_SEED_CONFIRM=REMOVE_30_THACH_THAT_DEMO npm run demo:thachthat:clean
~~~

Mọi thao tác ghi chạy trong **một transaction** và rollback nếu lỗi; không sửa các bản ghi bình thường. Nếu đã thêm ảnh không thuộc bộ DEMO vào một tin DEMO, lệnh seed từ chối ghi đè ảnh đó. Lệnh xóa vẫn xóa bản ghi DEMO theo khóa chính và cascade các bản ghi liên quan; hãy dùng ở môi trường test được kiểm soát.

## Kiểm tra UI trên staging

- Bản đồ: /map?vertical=housing&category=bat-dong-san
- Mẫu chi tiết: /dia-diem/demo-thach-that-2026-01 (phòng trọ số 01), /dia-diem/demo-thach-that-2026-16 (nhà bán số 16)
- Tìm bằng từ khóa DEMO, chọn thuê/bán, lọc giá/diện tích/phòng trống, xem vị trí, nhóm ghim và slideshow 4 ảnh.
- Kiểm tra đường dẫn ảnh trực tiếp và phản hồi khi CDN thất bại. Không có kết quả hiển thị trên site production nếu chưa triển khai/seed.
- Kiểm thử DB: npm test --prefix backend (trong PG16/PostGIS test CI). Test tạo/rà/xóa bộ fixture trong một transaction rollback.

## Giới hạn nghiệm thu

Đây là dữ liệu **giả lập**, không đưa vào báo cáo độ phủ BĐS, định giá, thống kê thị trường hoặc SEO của website đang hoạt động. Chỉ công bố bộ demo trên bản staging có chặn index/bot và thông báo nội bộ. Khi xóa demo, không chạm tới POI, BĐS thật hay tài khoản người dùng. Không dùng seed để né quy trình kiểm duyệt production.
