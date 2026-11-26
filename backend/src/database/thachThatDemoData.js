// Pure staging fixtures for HOLA-P1-110. No real property, owner, contact or
// verified GPS coordinate is represented here. Never import into production.
export const DEMO_SOURCE = 'HOLA_THACH_THAT_DEMO_2026';
export const DEMO_NAMESPACE = 'demo-thach-that-2026-';
export const DEMO_IMAGE_PROVIDER = 'demo-unsplash-external';
export const DEMO_SEED_CONFIRM = 'SEED_30_THACH_THAT_DEMO';
export const DEMO_CLEAN_CONFIRM = 'REMOVE_30_THACH_THAT_DEMO';

const ROOMS = [
  ['Phòng khép kín có gác nhỏ', 'Thạch Hòa', 105.5202, 21.0131, 22, 2300000],
  ['Phòng studio có điều hòa', 'Tân Xã', 105.5331, 21.0226, 26, 2900000],
  ['Phòng có ban công thoáng', 'Thạch Hòa', 105.5151, 21.0068, 28, 3200000],
  ['Phòng trọ tiết kiệm', 'Bình Yên', 105.5481, 21.0503, 19, 1900000],
  ['Phòng khép kín có bếp', 'Hạ Bằng', 105.5576, 21.0523, 25, 2600000],
  ['Phòng trọ có chỗ để xe', 'Đồng Trúc', 105.5611, 21.0604, 23, 2400000],
  ['Phòng studio sáng thoáng', 'Liên Quan', 105.5861, 21.0311, 29, 3100000],
  ['Phòng trọ gọn gàng', 'Đại Đồng', 105.5962, 21.0398, 21, 2200000],
  ['Phòng có gác và cửa sổ', 'Lại Thượng', 105.5875, 21.0259, 24, 2700000],
  ['Phòng trọ khép kín', 'Phú Kim', 105.5782, 21.0444, 20, 2100000],
  ['Phòng có nội thất cơ bản', 'Thạch Xá', 105.5739, 20.9995, 30, 3400000],
  ['Phòng trọ có bàn học', 'Phùng Xá', 105.5776, 20.9877, 22, 2500000],
  ['Phòng gác lửng', 'Hương Ngải', 105.5792, 21.0069, 27, 3000000],
  ['Phòng trọ vườn yên tĩnh', 'Tiến Xuân', 105.4515, 21.0155, 26, 2800000],
  ['Phòng studio 32 m²', 'Yên Bình', 105.4104, 21.0867, 32, 3600000]
];

const OTHERS = [
  ['Nhà 2 tầng giả lập', 'Liên Quan', 105.5848, 21.0342, 'SALE', 'HOUSE', 82, 3250000000],
  ['Nhà liền kề nhỏ', 'Đại Đồng', 105.5941, 21.0412, 'SALE', 'HOUSE', 76, 2780000000],
  ['Lô đất ở giả lập', 'Thạch Xá', 105.5721, 20.9939, 'SALE', 'LAND', 95, 1690000000],
  ['Thửa đất vườn giả lập', 'Hạ Bằng', 105.5569, 21.0592, 'SALE', 'LAND', 120, 1480000000],
  ['Nhà có sân nhỏ', 'Tân Xã', 105.5304, 21.0194, 'SALE', 'HOUSE', 108, 3850000000],
  ['Căn hộ mini cho thuê', 'Thạch Hòa', 105.5185, 21.0198, 'RENT', 'APARTMENT', 48, 5100000],
  ['Nhà nguyên căn cho thuê', 'Bình Yên', 105.5452, 21.0539, 'RENT', 'HOUSE', 86, 7400000],
  ['Mặt bằng tầng trệt cho thuê', 'Phùng Xá', 105.5755, 20.9901, 'RENT', 'COMMERCIAL', 61, 9000000],
  ['Biệt thự sân vườn giả lập', 'Tiến Xuân', 105.4478, 21.0089, 'SALE', 'VILLA', 185, 5200000000],
  ['Lô đất khu dân cư giả lập', 'Yên Bình', 105.4029, 21.0846, 'SALE', 'LAND', 135, 2180000000],
  ['Nhà 3 tầng giả lập', 'Lại Thượng', 105.5918, 21.0243, 'SALE', 'HOUSE', 94, 4120000000],
  ['Lô đất mặt ngõ giả lập', 'Cẩm Yên', 105.6022, 21.0346, 'SALE', 'LAND', 74, 1260000000],
  ['Nhà vườn 1 tầng giả lập', 'Kim Quan', 105.5874, 21.0406, 'SALE', 'HOUSE', 73, 2490000000],
  ['Nhà nguyên căn 2 phòng ngủ', 'Đồng Trúc', 105.5662, 21.0562, 'RENT', 'HOUSE', 92, 6900000],
  ['Mặt bằng kết hợp kho nhỏ', 'Thạch Hòa', 105.5094, 21.0103, 'RENT', 'COMMERCIAL', 96, 11000000]
];

// Illustrations only. Never imply these photos depict the fictional listings.
// Original assets from images.unsplash.com, used under Unsplash License.
// External links may break; QA should verify them before sharing staging.
const PHOTO_IDS = {
  room: [
    '1560448204-e02f11c3d0e2', '1522708323590-d24dbb6b0267',
    '1484154218962-a197022b5858', '1502672260266-1c1ef2d93688',
    '1493809842364-78817add7ffb', '1600210492486-724fe5c67fb0',
    '1600607687939-ce8a6c25118c', '1600566753190-17f0baa2a6c3',
    '1600566753051-f0b89df2dd90', '1600566753086-00f18fb6b3ea',
    '1600576752355-35792bedcfea', '1600607687920-4e2a09cf159d'
  ],
  house: [
    '1600585154340-be6161a56a0c', '1600596542815-ffad4c1539a9',
    '1600607687939-ce8a6c25118c', '1600566753190-17f0baa2a6c3',
    '1600607687920-4e2a09cf159d', '1600576752355-35792bedcfea',
    '1600566753086-00f18fb6b3ea', '1600585152915-d208bec867a1'
  ],
  land: [
    '1500382017468-9049fed747ef', '1500534314209-a25ddb2bd429',
    '1460317442991-0ec209397118', '1473448912268-2022ce9509d8',
    '1501785888041-af3ef285b470', '1470770841072-f978cf4d019e'
  ]
};

const money = (value) => Number(value).toLocaleString('vi-VN') + ' đ';
const pad = (value) => String(value).padStart(2, '0');

function demoPhotos(kind, index) {
  const list = PHOTO_IDS[kind];
  return Array.from({ length: 4 }, (_, offset) => {
    const photoId = 'photo-' + list[(index * 3 + offset) % list.length];
    const root = 'https://images.unsplash.com/' + photoId + '?auto=format&fit=crop';
    return Object.freeze({
      photoId,
      imageUrl: root + '&w=1200&q=78',
      cardUrl: root + '&w=720&q=75',
      thumbnailUrl: root + '&w=400&q=72'
    });
  });
}

function shared(record, index, kind) {
  const id = pad(index + 1);
  const isTown = record.ward === 'Liên Quan';
  const areaLabel = (isTown ? 'thị trấn' : 'xã') + ' cũ ' + record.ward;
  const address = 'Khu vực ' + areaLabel +
    ', huyện Thạch Thất cũ, Hà Nội (tọa độ minh họa)';
  const disclaimer = '[DEMO - KHÔNG PHẢI TIN THẬT] Dữ liệu mô phỏng phục vụ kiểm thử HOLA Maps. ' +
    'Vị trí chỉ mang tính khu vực, không phải tọa độ nhà hoặc lô đất có thật. ' +
    'Giá và tiện ích là số liệu thử nghiệm, không dùng để giao dịch. ' +
    'Ảnh Unsplash chỉ minh họa, không phải ảnh tài sản này. Không liên hệ số demo.';
  return Object.freeze({
    ...record,
    slug: DEMO_NAMESPACE + id,
    externalId: 'TT-DEMO-' + id,
    name: '[DEMO ' + id + '] ' + record.title + ' - ' + record.ward,
    address,
    description: disclaimer + ' ' + record.description,
    phone: '00000000' + id,
    imageKind: kind,
    images: Object.freeze(demoPhotos(kind, index))
  });
}

export const THACH_THAT_DEMO_LISTINGS = Object.freeze([
  ...ROOMS.map(([title, ward, lng, lat, areaM2, monthlyRent], index) => {
    const hasAirConditioner = index % 3 !== 0;
    const hasLoft = index % 4 === 0;
    return shared({
      title, ward, lng, lat, areaM2, monthlyRent,
      depositAmount: monthlyRent,
      listingType: 'RENT',
      propertyType: null, // null means room-rental in current public UI
      totalPriceVnd: null,
      availabilityStatus: 'AVAILABLE',
      availableRooms: 1,
      totalRooms: 1,
      electricityPricePerKwh: 3500,
      waterPricePerPersonMonth: 95000,
      parkingFeeMonthly: index % 2 ? 50000 : 0,
      hasAirConditioner,
      hasWaterHeater: index % 2 === 0,
      hasPrivateBathroom: true,
      hasLoft,
      hasBalcony: index % 4 === 2,
      hasParking: true,
      allowsPets: index % 5 === 0,
      description: 'Phòng mẫu ' + areaM2 + ' m²; giá thử nghiệm ' +
        money(monthlyRent) + '/tháng, cọc một tháng. ' +
        (hasLoft ? 'Giả định có gác lửng. ' : '') +
        (hasAirConditioner ? 'Giả định có điều hòa. ' : '') +
        'Kết cấu và tiện ích chỉ để thử bộ lọc.',
      priceLevel: money(monthlyRent) + '/tháng (DEMO)'
    }, index, 'room');
  }),
  ...OTHERS.map(([title, ward, lng, lat, listingType, propertyType, areaM2, price], i) => {
    const isSale = listingType === 'SALE';
    return shared({
      title, ward, lng, lat, listingType, propertyType, areaM2,
      totalPriceVnd: isSale ? price : null,
      monthlyRent: isSale ? null : price,
      depositAmount: isSale ? null : price,
      availabilityStatus: isSale ? 'UNKNOWN' : 'AVAILABLE',
      availableRooms: null,
      totalRooms: null,
      electricityPricePerKwh: null,
      waterPricePerPersonMonth: null,
      parkingFeeMonthly: null,
      hasAirConditioner: propertyType !== 'LAND',
      hasWaterHeater: propertyType === 'HOUSE' || propertyType === 'VILLA',
      hasPrivateBathroom: propertyType !== 'LAND',
      hasLoft: false,
      hasBalcony: propertyType === 'HOUSE' || propertyType === 'APARTMENT',
      hasParking: propertyType !== 'LAND',
      allowsPets: false,
      description: 'Loại bất động sản giả lập ' + propertyType + ', diện tích ' +
        areaM2 + ' m², giá ' + money(price) +
        (isSale ? ' (giá bán)' : '/tháng (giá cho thuê)') +
        '. Chỉ nhằm kiểm tra trang chi tiết và bộ lọc.',
      priceLevel: money(price) + (isSale ? ' (DEMO)' : '/tháng (DEMO)')
    }, i + ROOMS.length, propertyType === 'LAND' ? 'land' : 'house');
  })
]);

export const THACH_THAT_DEMO_SUMMARY = Object.freeze({
  total: THACH_THAT_DEMO_LISTINGS.length,
  roomRentals: THACH_THAT_DEMO_LISTINGS.filter((x) =>
    x.listingType === 'RENT' && x.propertyType === null).length,
  otherProperties: THACH_THAT_DEMO_LISTINGS.filter((x) => x.propertyType !== null).length,
  photoRows: THACH_THAT_DEMO_LISTINGS.reduce((sum, row) => sum + row.images.length, 0)
});
