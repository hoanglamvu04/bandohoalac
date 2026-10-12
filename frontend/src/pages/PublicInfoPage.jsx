import { ArrowRight, BookOpen, CheckCircle2, Database, LockKeyhole, MapPinned, ShieldCheck } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import SeoHead from '../components/SeoHead.jsx';

const PAGE_CONFIG = {
  '/huong-dan': {
    icon: BookOpen,
    eyebrow: 'HƯỚNG DẪN',
    title: 'Sử dụng Hola Maps dễ hơn trong vài phút.',
    intro: 'Tìm địa điểm, xem lớp dữ liệu, dùng vị trí hiện tại và đóng góp thông tin cho bản đồ Hòa Lạc.',
    sections: [
      {
        title: 'Tìm và khám phá địa điểm',
        body: 'Mở Bản đồ, nhập tên địa điểm hoặc nhu cầu như quán cà phê, homestay, ăn uống. Bạn có thể kéo bản đồ, chạm vào marker và mở trang chi tiết để xem ảnh, địa chỉ, đánh giá và chỉ đường.'
      },
      {
        title: 'Dùng vị trí của tôi và Gần tôi',
        body: 'Khi bạn cho phép trình duyệt sử dụng vị trí, Hola Maps có thể đưa bản đồ về vị trí hiện tại và gợi ý các địa điểm gần bạn. Bạn có thể tắt quyền vị trí bất cứ lúc nào trong cài đặt trình duyệt.'
      },
      {
        title: 'Bộ lọc và lớp dữ liệu',
        body: 'Dùng Bộ lọc để thu hẹp theo danh mục. Các lớp dữ liệu giúp xem thêm thông tin như công trình, sông hồ, địa danh hoặc cảnh báo đang được hệ thống hỗ trợ.'
      },
      {
        title: 'Đóng góp dữ liệu',
        body: 'Nếu thấy địa điểm thiếu ảnh, sai giờ mở cửa, sai vị trí hoặc thông tin chưa chính xác, hãy dùng chức năng cập nhật tại trang chi tiết. Nội dung đóng góp được kiểm duyệt trước khi xuất hiện công khai.'
      }
    ]
  },
  '/quy-dinh-cong-dong': {
    icon: ShieldCheck,
    eyebrow: 'CỘNG ĐỒNG',
    title: 'Đóng góp thật, hữu ích và tôn trọng địa phương.',
    intro: 'Hola Maps là bản đồ cộng đồng. Mỗi cập nhật nên giúp dữ liệu Hòa Lạc rõ ràng và đáng tin cậy hơn.',
    sections: [
      {
        title: 'Nội dung nên đóng góp',
        body: 'Thông tin địa điểm có thật, ảnh thực tế, giờ mở cửa, số điện thoại, website, vị trí và mô tả dựa trên trải nghiệm hoặc nguồn có thể kiểm chứng.'
      },
      {
        title: 'Không đăng nội dung gây hiểu nhầm',
        body: 'Không giả mạo địa điểm, cố tình đưa vị trí sai, đăng ảnh không liên quan, spam quảng cáo, nội dung xâm phạm quyền riêng tư hoặc nội dung vi phạm pháp luật.'
      },
      {
        title: 'Tôn trọng người khác',
        body: 'Đánh giá nên tập trung vào trải nghiệm và thông tin thực tế. Tránh công kích cá nhân, tiết lộ dữ liệu riêng tư hoặc sử dụng ngôn ngữ xúc phạm.'
      },
      {
        title: 'Kiểm duyệt và chỉnh sửa',
        body: 'Hola Maps có thể từ chối, ẩn hoặc chỉnh sửa nội dung không phù hợp, trùng lặp hoặc thiếu cơ sở xác minh. Lịch sử đóng góp có thể được dùng để đánh giá độ tin cậy của dữ liệu.'
      }
    ]
  },
  '/dieu-khoan': {
    icon: CheckCircle2,
    eyebrow: 'ĐIỀU KHOẢN',
    title: 'Điều khoản sử dụng Hola Maps.',
    intro: 'Các nguyên tắc cơ bản khi truy cập, sử dụng và đóng góp nội dung trên Hola Maps.',
    sections: [
      {
        title: 'Phạm vi dịch vụ',
        body: 'Hola Maps cung cấp bản đồ, dữ liệu địa điểm, nội dung cộng đồng và các công cụ khám phá Hòa Lạc. Dữ liệu có thể thay đổi theo thời gian và không được xem là nguồn pháp lý hoặc chỉ dẫn chuyên môn chính thức.'
      },
      {
        title: 'Tài khoản và trách nhiệm người dùng',
        body: 'Bạn chịu trách nhiệm bảo mật thông tin đăng nhập và nội dung được gửi từ tài khoản của mình. Không sử dụng dịch vụ để gây gián đoạn hệ thống hoặc truy cập trái phép dữ liệu.'
      },
      {
        title: 'Nội dung do người dùng cung cấp',
        body: 'Khi gửi ảnh, đánh giá hoặc thông tin địa điểm, bạn xác nhận mình có quyền cung cấp nội dung đó và cho phép Hola Maps hiển thị nội dung trong phạm vi vận hành dịch vụ.'
      },
      {
        title: 'Độ chính xác và thay đổi dịch vụ',
        body: 'Hola Maps cố gắng duy trì dữ liệu hữu ích và cập nhật nhưng không đảm bảo mọi thông tin luôn tuyệt đối chính xác. Tính năng và điều khoản có thể được điều chỉnh khi sản phẩm phát triển.'
      }
    ]
  },
  '/quyen-rieng-tu': {
    icon: LockKeyhole,
    eyebrow: 'QUYỀN RIÊNG TƯ',
    title: 'Dữ liệu của bạn được dùng để vận hành trải nghiệm bản đồ.',
    intro: 'Trang này tóm tắt các loại dữ liệu Hola Maps có thể xử lý khi bạn sử dụng tài khoản và các tính năng bản đồ.',
    sections: [
      {
        title: 'Dữ liệu tài khoản',
        body: 'Khi đăng ký, hệ thống có thể lưu tên, email, thông tin xác thực và lịch sử hoạt động cần thiết để quản lý tài khoản, đóng góp và phần thưởng.'
      },
      {
        title: 'Vị trí thiết bị',
        body: 'Hola Maps chỉ yêu cầu vị trí khi bạn chủ động dùng tính năng như Vị trí của tôi hoặc Gần tôi và trình duyệt đã cấp quyền. Quyền này có thể được thu hồi trong cài đặt thiết bị hoặc trình duyệt.'
      },
      {
        title: 'Nội dung và tệp tải lên',
        body: 'Ảnh, đánh giá và thông tin địa điểm bạn gửi có thể được lưu để kiểm duyệt, hiển thị công khai hoặc xử lý các yêu cầu cập nhật dữ liệu.'
      },
      {
        title: 'Lựa chọn của bạn',
        body: 'Bạn có thể không cấp quyền vị trí, không tải ảnh lên hoặc liên hệ quản trị để yêu cầu hỗ trợ về tài khoản và nội dung đã đóng góp.'
      }
    ]
  },
  '/nguon-du-lieu': {
    icon: Database,
    eyebrow: 'DỮ LIỆU',
    title: 'Dữ liệu Hola Maps đến từ nhiều lớp khác nhau.',
    intro: 'Mục tiêu của Hola Maps là kết hợp dữ liệu nền bản đồ với thông tin địa phương được quản trị và cộng đồng cập nhật.',
    sections: [
      {
        title: 'Nền bản đồ và lớp địa lý',
        body: 'Hệ thống sử dụng pipeline bản đồ vector và các lớp dữ liệu được cấu hình cho khu vực Hòa Lạc. Một số lớp chỉ mang tính tham khảo và có thể được cập nhật theo từng phiên bản dữ liệu.'
      },
      {
        title: 'Địa điểm trong hệ thống',
        body: 'Địa điểm có thể được tạo bởi quản trị viên, cộng tác viên hoặc cộng đồng. Mỗi thay đổi quan trọng đi qua quy trình đóng góp và kiểm duyệt trước khi trở thành dữ liệu công khai.'
      },
      {
        title: 'Ảnh và góc nhìn cộng đồng',
        body: 'Một số địa điểm có thể hiển thị ảnh hoặc nội dung được liên kết từ hệ sinh thái HALO HOLA khi nội dung đã được gắn với đúng vị trí hoặc địa điểm.'
      },
      {
        title: 'Báo sai và cập nhật',
        body: 'Nếu phát hiện dữ liệu sai, bạn có thể gửi sửa vị trí, giờ mở cửa, thông tin liên hệ hoặc báo địa điểm đã đóng. Các phản hồi này giúp dữ liệu được cải thiện theo thời gian.'
      }
    ]
  }
};

export default function PublicInfoPage() {
  const location = useLocation();
  const page = PAGE_CONFIG[location.pathname] || PAGE_CONFIG['/huong-dan'];
  const Icon = page.icon || MapPinned;

  return (
    <main className="public-info-page">
      <SeoHead
        title={page.title.replace(/\.$/, '')}
        description={page.intro}
        canonical={'https://maps.dothihoalac.vn' + location.pathname}
      />

      <section className="public-info-hero">
        <div className="public-info-icon"><Icon size={24} /></div>
        <span>{page.eyebrow}</span>
        <h1>{page.title}</h1>
        <p>{page.intro}</p>
      </section>

      <section className="public-info-grid">
        {page.sections.map((section, index) => (
          <article className="public-info-card" key={section.title}>
            <span className="public-info-number">{String(index + 1).padStart(2, '0')}</span>
            <div>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="public-info-cta">
        <div>
          <span>TIẾP TỤC KHÁM PHÁ</span>
          <h2>Mở bản đồ Hòa Lạc</h2>
          <p>Tìm địa điểm, xem dữ liệu quanh bạn hoặc đóng góp một cập nhật mới cho cộng đồng.</p>
        </div>
        <div className="public-info-actions">
          <Link to="/map">Mở bản đồ <ArrowRight size={16} /></Link>
          <Link to="/contribute" className="secondary">Đóng góp địa điểm</Link>
        </div>
      </section>
    </main>
  );
}
