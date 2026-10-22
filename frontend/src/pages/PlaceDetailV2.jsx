import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  Camera,
  Clock3,
  ExternalLink,
  Globe2,
  Heart,
  Images,
  MapPin,
  Navigation,
  Phone,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Users
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import {
  addFavorite,
  client,
  getHousingListing,
  getNearbyPlaces,
  getPlace,
  getPlaceMe,
  removeFavorite
} from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import SeoHead from '../components/SeoHead.jsx';
import PlaceContributionPanel from '../components/PlaceContributionPanel.jsx';
import PlaceReviews from '../components/PlaceReviews.jsx';

function uniqueImages(values = []) {
  return Array.from(new Set(values.filter((value) => typeof value === 'string' && value.trim())));
}

function distanceLabel(meters) {
  const value = Number(meters) || 0;
  if (!value) return '';
  return value >= 1000 ? (value / 1000).toFixed(1) + ' km' : Math.round(value) + ' m';
}

function normalizeWebsite(value) {
  if (!value) return '';
  return /^https?:\/\//i.test(value) ? value : 'https://' + value;
}

function compactDescription(value, fallback) {
  const text = String(value || fallback || '').replace(/\s+/g, ' ').trim();
  return text.length > 165 ? text.slice(0, 162).trimEnd() + '...' : text;
}

function formatHousingMoney(value) {
  if (value === null || value === undefined || value === '') return 'Chưa cập nhật';
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Chưa cập nhật';
  return new Intl.NumberFormat('vi-VN').format(number) + 'đ';
}

function formatHousingRent(value) {
  if (value === null || value === undefined || value === '') return 'Chưa cập nhật';
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Chưa cập nhật';
  if (number >= 1000000) {
    return (number / 1000000).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' triệu/tháng';
  }
  return formatHousingMoney(number) + '/tháng';
}

function housingFreshness(value) {
  if (!value) return 'Chưa có mốc xác minh';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa có mốc xác minh';
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
  if (days === 0) return 'Xác minh hôm nay';
  if (days === 1) return 'Xác minh hôm qua';
  if (days < 30) return 'Xác minh ' + days + ' ngày trước';
  return 'Xác minh ' + date.toLocaleDateString('vi-VN');
}

export default function PlaceDetailV2() {
  const { id } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [place, setPlace] = useState(null);
  const [status, setStatus] = useState('loading');
  const [nearby, setNearby] = useState([]);
  const [haloSpot, setHaloSpot] = useState(null);
  const [activeImage, setActiveImage] = useState(0);
  const [favorite, setFavorite] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [housingDetail, setHousingDetail] = useState(null);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    setNearby([]);
    setHaloSpot(null);
    setHousingDetail(null);
    setActiveImage(0);
    setFavorite(false);

    getPlace(id)
      .then((data) => {
        if (!active) return;
        setPlace(data);
        setStatus('ready');

        if (Number.isFinite(Number(data?.lat)) && Number.isFinite(Number(data?.lng))) {
          getNearbyPlaces(data.lat, data.lng, 8000)
            .then((response) => {
              if (!active) return;
              const items = Array.isArray(response?.items) ? response.items : [];
              setNearby(items.filter((item) => String(item.id) !== String(data.id)).slice(0, 6));
            })
            .catch(() => {});
        }

        client.get('/halo/v1/places/' + encodeURIComponent(data.id), { params: { limit: 24 } })
          .then((response) => {
            if (active) setHaloSpot(response?.data?.item || null);
          })
          .catch(() => {});

        if (data?.categorySlug === 'bat-dong-san') {
          getHousingListing(data.id)
            .then((response) => {
              if (active) setHousingDetail(response?.item || null);
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        if (active) setStatus('error');
      });

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    let active = true;

    if (!user || !place?.id) {
      setFavorite(false);
      return () => {
        active = false;
      };
    }

    getPlaceMe(place.id)
      .then((data) => {
        if (active) setFavorite(Boolean(data?.favorite));
      })
      .catch(() => {
        if (active) setFavorite(false);
      });

    return () => {
      active = false;
    };
  }, [user?.id, place?.id]);

  const images = useMemo(() => uniqueImages([
    ...(Array.isArray(place?.images) ? place.images : []),
    ...(Array.isArray(haloSpot?.media) ? haloSpot.media.map((item) => item?.url) : [])
  ]), [place, haloSpot]);

  if (status === 'loading') {
    return <main className="place-v2-state">Đang tải địa điểm...</main>;
  }

  if (status === 'error' || !place) {
    return (
      <main className="place-v2-state">
        <MapPin size={30} />
        <h1>Không tìm thấy địa điểm</h1>
        <Link to="/map">Quay lại bản đồ</Link>
      </main>
    );
  }

  const rating = Number(place.rating) || 0;
  const reviewCount = Number(place.reviews || place.ratingCount || 0);
  const website = normalizeWebsite(place.website);
  const canonical = 'https://maps.dothihoalac.vn/place/' + encodeURIComponent(place.id);
  const metaDescription = compactDescription(
    place.description,
    `${place.name} tại ${place.address || 'Hòa Lạc'}. Xem vị trí, hình ảnh, đánh giá và chỉ đường trên Hola Maps.`
  );
  const mapsUrl = Number.isFinite(Number(place.lat)) && Number.isFinite(Number(place.lng))
    ? 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(place.lat + ',' + place.lng)
    : '';

  const placeSchema = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: place.name,
    description: metaDescription,
    url: canonical,
    ...(place.address ? { address: place.address } : {}),
    ...(place.phone ? { telephone: place.phone } : {}),
    ...(images.length ? { image: images.slice(0, 4) } : {}),
    ...(Number.isFinite(Number(place.lat)) && Number.isFinite(Number(place.lng)) ? {
      geo: {
        '@type': 'GeoCoordinates',
        latitude: Number(place.lat),
        longitude: Number(place.lng)
      }
    } : {}),
    ...(rating > 0 && reviewCount > 0 ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: rating,
        reviewCount
      }
    } : {})
  };

  async function toggleFavorite() {
    if (!user) {
      showToast('Đăng nhập để lưu địa điểm này.', 'info');
      return;
    }
    if (favoriteBusy) return;

    setFavoriteBusy(true);
    try {
      const data = favorite
        ? await removeFavorite(place.id)
        : await addFavorite(place.id);
      setFavorite(Boolean(data?.favorite));
      showToast(data?.favorite ? 'Đã lưu địa điểm.' : 'Đã bỏ lưu địa điểm.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setFavoriteBusy(false);
    }
  }

  async function sharePlace() {
    const shareData = {
      title: place.name + ' | Hola Maps',
      text: `${place.name}${place.address ? ' · ' + place.address : ''}`,
      url: canonical
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(canonical);
        showToast('Đã sao chép link địa điểm.', 'success');
        return;
      }
      showToast('Bạn có thể sao chép đường dẫn trên thanh địa chỉ để chia sẻ.', 'info');
    } catch (error) {
      if (error?.name !== 'AbortError') showToast('Chưa thể chia sẻ địa điểm lúc này.', 'error');
    }
  }

  return (
    <main className="place-v2-page">
      <SeoHead
        title={place.name}
        description={metaDescription}
        canonical={canonical}
        image={images[0] || undefined}
        type="article"
        jsonLd={placeSchema}
      />

      <div className="place-v2-topbar">
        <Link to="/map" className="place-v2-back"><ArrowLeft size={18} /> Bản đồ</Link>
        <span className="place-v2-source"><BadgeCheck size={15} /> {place.source === 'ADMIN' ? 'Hola Maps' : 'Dữ liệu cộng đồng'}</span>
      </div>

      <section className="place-v2-hero">
        <div className="place-v2-heading">
          <span className="place-v2-kicker">{place.category || 'Địa điểm Hòa Lạc'}</span>
          <h1>{place.name}</h1>
          <div className="place-v2-rating-row">
            <span className="place-v2-rating"><Star size={17} fill="currentColor" /> {rating > 0 ? rating.toFixed(1) : 'Mới'}</span>
            <span>{reviewCount} đánh giá</span>
            <span>•</span>
            <span><MapPin size={16} /> {place.address || 'Hòa Lạc, Hà Nội'}</span>
          </div>
        </div>

        <div className="place-v2-actions place-v2-actions-expanded">
          {mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer"><Navigation size={17} /> Chỉ đường</a>}
          <button type="button" onClick={toggleFavorite} className={favorite ? 'active' : ''} disabled={favoriteBusy}>
            <Heart size={17} fill={favorite ? 'currentColor' : 'none'} /> {favorite ? 'Đã lưu' : 'Lưu'}
          </button>
          <button type="button" onClick={sharePlace}><Share2 size={17} /> Chia sẻ</button>
          {place.phone && <a href={'tel:' + place.phone}><Phone size={17} /> Gọi</a>}
          {website && <a href={website} target="_blank" rel="noreferrer"><Globe2 size={17} /> Website</a>}
        </div>
      </section>

      <section className="place-v2-gallery">
        <div className="place-v2-gallery-main">
          {images.length ? (
            <img src={images[Math.min(activeImage, images.length - 1)]} alt={place.name} />
          ) : (
            <div className="place-v2-gallery-empty"><Images size={36} /> Chưa có ảnh địa điểm</div>
          )}
          {images.length > 0 && <span className="place-v2-photo-count"><Camera size={15} /> {images.length} ảnh</span>}
        </div>
        {images.length > 1 && (
          <div className="place-v2-thumbs">
            {images.slice(0, 8).map((image, index) => (
              <button key={image + index} className={index === activeImage ? 'active' : ''} onClick={() => setActiveImage(index)} type="button">
                <img src={image} alt="" />
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="place-v2-facts">
        <div><Clock3 size={19} /><span>Giờ mở cửa</span><strong>{place.openingHours || 'Chưa cập nhật'}</strong></div>
        <div><MapPin size={19} /><span>Khu vực</span><strong>{place.address || 'Hòa Lạc'}</strong></div>
        <div><Star size={19} /><span>Đánh giá</span><strong>{rating > 0 ? rating.toFixed(1) + '/5' : 'Mới'}</strong></div>
        <div><Users size={19} /><span>Ảnh HALO</span><strong>{haloSpot?.mediaCount || 0}</strong></div>
      </section>

      {place.categorySlug === 'bat-dong-san' && (
        <section className="place-v2-card place-v2-housing-card">
          <div className="place-v2-section-title">
            <Building2 size={19} />
            <h2>Thông tin phòng trọ</h2>
            <span className={
              'place-v2-housing-status ' +
              (housingDetail?.housing?.availabilityStatus === 'FULL'
                ? 'full'
                : housingDetail?.housing?.availabilityStatus === 'UNKNOWN' || !housingDetail?.housing
                  ? 'unknown'
                  : '')
            }>
              <BadgeCheck size={13} />
              {housingDetail?.housing?.availabilityStatus === 'AVAILABLE'
                ? 'Còn phòng'
                : housingDetail?.housing?.availabilityStatus === 'LIMITED'
                  ? 'Sắp hết'
                  : housingDetail?.housing?.availabilityStatus === 'FULL'
                    ? 'Hết phòng'
                    : 'Chưa xác nhận'}
            </span>
          </div>

          {housingDetail?.housing ? (
            <>
              <div className="place-v2-housing-summary">
                <div>
                  <small>Giá thuê</small>
                  <strong>{formatHousingRent(housingDetail.housing.monthlyRent)}</strong>
                </div>
                <div>
                  <small>Diện tích</small>
                  <strong>{housingDetail.housing.areaM2 ? housingDetail.housing.areaM2 + ' m²' : 'Chưa cập nhật'}</strong>
                </div>
                <div>
                  <small>Khoảng cách FPT</small>
                  <strong>{distanceLabel(housingDetail.distanceToFptM) || 'Chưa tính'}</strong>
                </div>
                <div>
                  <small>Phòng trống</small>
                  <strong>
                    {housingDetail.housing.availableRooms !== null
                      ? housingDetail.housing.availableRooms + (housingDetail.housing.totalRooms !== null ? '/' + housingDetail.housing.totalRooms : '')
                      : 'Chưa cập nhật'}
                  </strong>
                </div>
              </div>

              <div className="place-v2-housing-amenities">
                {[
                  [housingDetail.housing.hasAirConditioner, 'Điều hòa'],
                  [housingDetail.housing.hasWaterHeater, 'Nóng lạnh'],
                  [housingDetail.housing.hasPrivateBathroom, 'Khép kín'],
                  [housingDetail.housing.hasLoft, 'Có gác'],
                  [housingDetail.housing.hasBalcony, 'Ban công'],
                  [housingDetail.housing.hasParking, 'Chỗ để xe'],
                  [housingDetail.housing.allowsPets, 'Cho nuôi thú cưng']
                ].filter(([enabled]) => enabled === true).map(([, label]) => (
                  <span key={label}>{label}</span>
                ))}
              </div>

              <div className="place-v2-housing-detail-grid">
                <p><strong>Tiền cọc:</strong> {formatHousingMoney(housingDetail.housing.depositAmount)}</p>
                <p><strong>Điện:</strong> {housingDetail.housing.electricityPricePerKwh ? formatHousingMoney(housingDetail.housing.electricityPricePerKwh) + '/kWh' : 'Chưa cập nhật'}</p>
                <p><strong>Nước:</strong> {housingDetail.housing.waterPricePerPersonMonth ? formatHousingMoney(housingDetail.housing.waterPricePerPersonMonth) + '/người/tháng' : 'Chưa cập nhật'}</p>
                <p><strong>Gửi xe:</strong> {housingDetail.housing.parkingFeeMonthly !== null ? formatHousingMoney(housingDetail.housing.parkingFeeMonthly) + '/tháng' : 'Chưa cập nhật'}</p>
                <p><strong>Có phòng từ:</strong> {housingDetail.housing.availableFrom ? new Date(housingDetail.housing.availableFrom).toLocaleDateString('vi-VN') : 'Chưa cập nhật'}</p>
                <p><strong>Zalo:</strong> {housingDetail.housing.contactZalo || 'Chưa cập nhật'}</p>
                {housingDetail.housing.curfewNote && <p><strong>Giờ giấc:</strong> {housingDetail.housing.curfewNote}</p>}
                {housingDetail.housing.availabilityNote && <p><strong>Tình trạng:</strong> {housingDetail.housing.availabilityNote}</p>}
              </div>

              <div className="place-v2-housing-verified">
                <ShieldCheck size={14} /> {housingFreshness(housingDetail.housing.lastVerifiedAt)}
                {housingDetail.housing.verificationSource === 'PARTNER' ? ' · HOLA Partner xác minh' : ''}
              </div>
            </>
          ) : (
            <p>
              Địa điểm này đã thuộc danh mục Bất động sản nhưng chưa có hồ sơ Housing V2.
              Chủ trọ hoặc cộng đồng có thể tiếp tục bổ sung giá, tình trạng phòng và tiện ích.
            </p>
          )}
        </section>
      )}

      <div className="place-v2-grid">
        <section className="place-v2-card place-v2-about">
          <div className="place-v2-section-title"><Sparkles size={19} /><h2>Về địa điểm này</h2></div>
          <p>{place.description || 'Địa điểm này chưa có mô tả chi tiết. Bạn có thể đóng góp thêm thông tin để Hola Maps hữu ích hơn cho cộng đồng Hòa Lạc.'}</p>
          <div className="place-v2-contact-list">
            {place.phone && <a href={'tel:' + place.phone}><Phone size={17} /> {place.phone}</a>}
            {website && <a href={website} target="_blank" rel="noreferrer"><Globe2 size={17} /> {place.website} <ExternalLink size={14} /></a>}
          </div>
        </section>

        <section className="place-v2-card">
          <div className="place-v2-section-title"><MapPin size={19} /><h2>Thông tin địa phương</h2></div>
          <p><strong>Danh mục:</strong> {place.category || 'Địa điểm'}</p>
          <p><strong>Địa chỉ:</strong> {place.address || 'Chưa cập nhật'}</p>
          <p><strong>Tọa độ:</strong> {Number(place.lat).toFixed(5)}, {Number(place.lng).toFixed(5)}</p>
          {mapsUrl && <a className="place-v2-inline-action" href={mapsUrl} target="_blank" rel="noreferrer"><Navigation size={16} /> Mở chỉ đường</a>}
        </section>
      </div>

      <section className="place-v2-owner-card">
        <div className="place-v2-owner-icon"><Building2 size={21} /></div>
        <div>
          <span className="place-v2-kicker">THÔNG TIN DOANH NGHIỆP</span>
          <h2>Bạn đang quản lý địa điểm này?</h2>
          <p>Xác nhận quyền quản lý để gửi thông tin chính thức và giúp dữ liệu địa điểm luôn đúng hơn.</p>
        </div>
        <Link to={'/claim-place/' + encodeURIComponent(place.id)}>Xác nhận địa điểm</Link>
      </section>

      {haloSpot?.media?.length > 0 && (
        <section className="place-v2-section">
          <div className="place-v2-section-head">
            <div>
              <span className="place-v2-kicker">HALO HOLA</span>
              <h2>Ảnh cộng đồng tại đây</h2>
              <p>Ảnh người dùng HALO HOLA đã gắn với đúng địa điểm trên Hola Maps.</p>
            </div>
            <Link to="/halo">Mở bản đồ cộng đồng</Link>
          </div>
          <div className="place-v2-halo-grid">
            {haloSpot.media.slice(0, 8).map((media) => (
              <article key={media.id}>
                <img src={media.thumbnailUrl || media.url} alt={media.caption || place.name} />
                <div>
                  <strong>{media.user?.name || 'Cộng đồng HALO'}</strong>
                  {media.caption && <p>{media.caption}</p>}
                  {media.sourceUrl && <a href={media.sourceUrl} target="_blank" rel="noreferrer">Xem bài gốc <ExternalLink size={13} /></a>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {nearby.length > 0 && (
        <section className="place-v2-section">
          <div className="place-v2-section-head">
            <div>
              <span className="place-v2-kicker">KHÁM PHÁ GẦN ĐÂY</span>
              <h2>Địa điểm quanh {place.name}</h2>
            </div>
            <Link to={'/map?place=' + encodeURIComponent(place.id)}>Xem trên bản đồ</Link>
          </div>
          <div className="place-v2-nearby-grid">
            {nearby.map((item) => (
              <Link to={'/place/' + encodeURIComponent(item.id)} key={item.id} className="place-v2-nearby-card">
                <div className="place-v2-nearby-image">
                  {item.cardImages?.[0] || item.images?.[0] ? <img src={item.cardImages?.[0] || item.images?.[0]} alt={item.name} /> : <MapPin size={28} />}
                </div>
                <div>
                  <span>{item.category || 'Địa điểm'}</span>
                  <strong>{item.name}</strong>
                  <small>{distanceLabel(item.distance)}</small>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="place-v2-section place-v2-community-tools">
        <PlaceReviews placeId={place.id} />
        <PlaceContributionPanel place={place} onChanged={() => {}} />
      </section>
    </main>
  );
}