# HOLA-P1-110/111 — 30 BĐS DEMO huyện Thạch Thất cũ (staging / live opt-in)

## Phạm vi và nhãn an toàn

Bộ dữ liệu mô phỏng dành để kiểm thử. Theo yêu cầu chủ dự án, có thể xuất bản **trực tiếp trên database của website thật bằng xác nhận hai lớp**. Các địa điểm, giá và hình ảnh không đại diện bất động sản thật.

- **30 tin**, gồm **15 phòng trọ** (RENT, property_type=NULL), **10 tài sản bán** và **5 tài sản khác cho thuê**.
- **120 hình minh họa** (4 ảnh/tin) dạng URL Unsplash; là ảnh mẫu, **không phải ảnh tài sản**. Liên kết ảnh bên ngoài cần kiểm tra trước khi nghiệm thu UI và có thể hỏng theo thời gian.
- Tất cả 30 tin có **diện tích**, **giá VND**, **mô tả**, **vị trí khu vực xấp xỉ**, và với phòng trọ còn có cọc/điện/nước/chỗ đỗ/tiện ích để kiểm thử bộ lọc.
- Các khu vực mang tên đơn vị hành chính **cũ của huyện Thạch Thất**, ví dụ Thạch Hòa, Tân Xã, Hạ Bằng, Bình Yên, Liên Quan, Đại Đồng, Lại Thượng, Phú Kim, Thạch Xá, Phùng Xá, Tiến Xuân, Yên Bình. **Tọa độ được tạo giả định trong vùng phục vụ HOLA**, không phải vị trí nhà/lô đất thật.
- Tiêu đề [DEMO xx], mô tả [DEMO - KHÔNG PHẢI TIN THẬT], giá có (DEMO). Số điện thoại 0000000001–0000000030 là **số không hợp lệ, chỉ để thử giao diện**, không có chủ nhà/CTV thực. Không dùng để liên hệ.
- Hình trên images.unsplash.com dùng làm minh họa theo [Unsplash License](https://unsplash.com/license). Không tự lưu ảnh từ tin rao thực tế, không sử dụng ảnh người nhận diện/thương hiệu và không ngụ ý chủ sở hữu ảnh cho thuê tài sản ở Thạch Thất. Không tải ảnh thực lên Cloudinary.
- Dữ liệu chỉ được gắn nhãn source='ADMIN' trong **fixture staging** và đặt status='PUBLISHED' để thử luồng trang công khai. Điều này **không cấp quyền xuất bản** cho người dùng thật hoặc vượt qua kiểm duyệt thông thường.

## Trước khi chạy

Staging vẫn là lựa chọn an toàn hơn. Nếu chủ dự án quyết định chạy trên production, cần xác minh database đích, sao lưu có thể khôi phục và chấp nhận dữ liệu giả được hiển thị công khai. **Không thay đổi `NODE_ENV` sang development để vượt kiểm tra.**

Lệnh guard chủ động từ chối:
1. Thiếu xác nhận riêng cho seed hoặc xóa.
2. Database live hoặc `NODE_ENV=production` nhưng thiếu `HOLA_DEMO_LIVE_CONFIRM` chính xác.
3. Tên DB thực tế trả về từ `SELECT current_database()` khác tên trong URL khai báo.
4. Có bản ghi không thuộc namespace DEMO bị ảnh hưởng (seed kiểm tra ảnh trước khi thay).

Các guard không tự xác nhận tình trạng backup, quyền database hay nguồn ảnh; người vận hành phải kiểm tra trước khi seed.

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

## Chạy trên website thật — chỉ khi chủ dự án đã xác nhận

Lần đầu phải kéo code từ `main` trên VPS và xác nhận lệnh preview có mặt trong `backend/package.json`. **Trước khi chạy, cần sao lưu database đang phục vụ website và xác minh có thể khôi phục.** Không dán URL kết nối/mật khẩu vào chat.

Dùng đúng môi trường hiện tại (không sửa `NODE_ENV` hay `.env`). Tại `/var/www/bandohoalac/backend`:

~~~bash
npm run demo:thachthat:preview

HOLA_DEMO_LIVE_CONFIRM=ALLOW_30_LABELED_DEMO_LISTINGS_ON_LIVE_SITE HOLA_DEMO_SEED_CONFIRM=SEED_30_THACH_THAT_DEMO npm run demo:thachthat:seed
~~~

Khi in `LIVE_PUBLIC_DEMO_SEEDED` nghĩa là đã COMMIT 30 tin demo vào DB đang kết nối. Nếu thất bại trước COMMIT, transaction được rollback. Script không tự đổi schema, restart PM2 hoặc xây dựng frontend; cần reload server backend để nhận thay đổi kiểm soát SEO/thống kê nếu tiến trình đang dùng bản mã cũ.

Xóa chính xác các bản ghi DEMO:

~~~bash
HOLA_DEMO_LIVE_CONFIRM=ALLOW_30_LABELED_DEMO_LISTINGS_ON_LIVE_SITE HOLA_DEMO_SEED_CONFIRM=REMOVE_30_THACH_THAT_DEMO npm run demo:thachthat:clean
~~~

**Đảm bảo minh bạch:** mỗi tin có tiêu đề [DEMO], mô tả "KHÔNG PHẢI TIN THẬT", giá giả và ảnh minh họa. Server trả `noindex` với trang chi tiết mẫu, bỏ chúng khỏi phân vị giá của báo cáo thị trường và kết quả địa điểm trong SEO địa phương. Một số dashboard tổng số tin khác vẫn có thể đếm mẫu demo vì mẫu đang nằm trong DB thật. Không dùng để báo cáo số lượng cung cầu thật.

## Kiểm tra UI trên staging hoặc production đã seed

- Bản đồ: /map?vertical=housing&category=bat-dong-san
- Mẫu chi tiết: /dia-diem/demo-thach-that-2026-01 (phòng trọ số 01), /dia-diem/demo-thach-that-2026-16 (nhà bán số 16)
- Tìm bằng từ khóa DEMO, chọn thuê/bán, lọc giá/diện tích/phòng trống, xem vị trí, nhóm ghim và slideshow 4 ảnh.
- Kiểm tra đường dẫn ảnh trực tiếp và phản hồi khi CDN thất bại. Tin chỉ xuất hiện trên site production sau khi pull code, seed hoàn tất và backend đang đọc đúng DB.
- Kiểm thử DB: npm test --prefix backend (trong PG16/PostGIS test CI). Test tạo/rà/xóa bộ fixture trong một transaction rollback.

## Giới hạn nghiệm thu

Đây là dữ liệu **giả lập**. Chủ dự án chọn hiển thị trên production để kiểm thử, nhưng không được mô tả là tài sản đang cho thuê/bán thật. Trang SEO DEMO được đặt noindex; dữ liệu đã bị loại khỏi thống kê phân vị giá. Khi xóa demo, chỉ xóa 30 mẫu có đúng namespace; không cấp quyền duyệt cho người đăng tin thông thường.
