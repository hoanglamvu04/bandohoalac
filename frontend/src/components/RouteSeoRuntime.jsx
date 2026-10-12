import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import SeoHead from './SeoHead.jsx';

const ROUTE_META = {
  '/': {
    title: 'Bản đồ cộng đồng Hòa Lạc',
    description: 'Khám phá địa điểm, tuyến đường, tiện ích và trải nghiệm địa phương tại Hòa Lạc trên bản đồ cộng đồng Hola Maps.'
  },
  '/map': {
    title: 'Bản đồ Hòa Lạc',
    description: 'Tra cứu địa điểm, tiện ích, đường đi và các lớp dữ liệu trên bản đồ Hòa Lạc.'
  },
  '/halo': {
    title: 'Bản đồ cộng đồng HALO HOLA',
    description: 'Khám phá các góc nhìn, ảnh và điểm check-in cộng đồng HALO HOLA trên bản đồ.'
  },
  '/leaderboard': {
    title: 'Cộng đồng Explorer',
    description: 'Bảng xếp hạng và hoạt động đóng góp dữ liệu của cộng đồng Hola Maps.'
  },
  '/rewards': {
    title: 'Phần thưởng Explorer',
    description: 'Theo dõi phần thưởng và quyền lợi dành cho cộng đồng Explorer của Hola Maps.'
  },
  '/missions': {
    title: 'Nhiệm vụ cộng đồng',
    description: 'Tham gia các nhiệm vụ cập nhật dữ liệu và khám phá Hòa Lạc cùng Hola Maps.'
  },
  '/huong-dan': {
    title: 'Hướng dẫn sử dụng',
    description: 'Hướng dẫn tìm địa điểm, sử dụng bản đồ, định vị và đóng góp dữ liệu trên Hola Maps.'
  },
  '/quy-dinh-cong-dong': {
    title: 'Quy định cộng đồng',
    description: 'Nguyên tắc đóng góp nội dung và cập nhật dữ liệu cộng đồng trên Hola Maps.'
  },
  '/dieu-khoan': {
    title: 'Điều khoản sử dụng',
    description: 'Điều khoản sử dụng dịch vụ Hola Maps.'
  },
  '/quyen-rieng-tu': {
    title: 'Quyền riêng tư',
    description: 'Thông tin về cách Hola Maps xử lý dữ liệu tài khoản, vị trí và nội dung do người dùng cung cấp.'
  },
  '/nguon-du-lieu': {
    title: 'Nguồn dữ liệu',
    description: 'Tìm hiểu nguồn dữ liệu, quy trình cập nhật và cách Hola Maps xác minh thông tin địa điểm.'
  }
};

function isPrivateRoute(pathname) {
  return (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/partner') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/verify') ||
    pathname.startsWith('/embed') ||
    pathname.startsWith('/picker')
  );
}

export default function RouteSeoRuntime() {
  const location = useLocation();
  const meta = useMemo(() => {
    if (location.pathname.startsWith('/place/')) {
      return {
        title: 'Địa điểm Hòa Lạc',
        description: 'Thông tin địa điểm, hình ảnh, đánh giá và chỉ đường trên Hola Maps.'
      };
    }

    return ROUTE_META[location.pathname] || {
      title: 'Khám phá Hòa Lạc',
      description: 'Bản đồ cộng đồng và dữ liệu địa phương dành cho Hòa Lạc.'
    };
  }, [location.pathname]);

  const noindex = isPrivateRoute(location.pathname);
  const canonical = 'https://maps.dothihoalac.vn' + location.pathname;

  return (
    <SeoHead
      title={meta.title}
      description={meta.description}
      canonical={canonical}
      noindex={noindex}
    />
  );
}
