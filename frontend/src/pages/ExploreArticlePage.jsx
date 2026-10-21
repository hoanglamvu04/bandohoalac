import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock3,
  Compass,
  MapPin,
  MapPinned,
  Share2,
  Star
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import SeoHead from '../components/SeoHead.jsx';
import { getExploreArticle } from '../services/api.js';

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date(value));
}

function PlaceCard({ place }) {
  return (
    <Link className="explore-place-card" to={'/map?place=' + encodeURIComponent(place.id)}>
      <div className="explore-place-cover">
        {place.coverImage
          ? <img src={place.coverImage} alt="" loading="lazy" />
          : <MapPin size={26} />}
      </div>
      <div>
        <span>{place.category}</span>
        <strong>{place.name}</strong>
        <p><MapPin size={13} /> {place.address}</p>
        <small>
          {place.rating > 0
            ? <><Star size={13} fill="currentColor" /> {place.rating.toFixed(1)} · {place.reviews} đánh giá</>
            : 'Địa điểm mới'}
        </small>
      </div>
      <ArrowRight size={18} />
    </Link>
  );
}

export default function ExploreArticlePage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shared, setShared] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');

    getExploreArticle(slug, { signal: controller.signal })
      .then(setData)
      .catch((requestError) => {
        if (requestError?.name !== 'AbortError') {
          setError(requestError?.message || 'Không tải được bài viết.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [slug]);

  const article = data?.article || null;
  const relatedPlaces = Array.isArray(data?.relatedPlaces) ? data.relatedPlaces : [];
  const canonical = article
    ? 'https://maps.dothihoalac.vn/kham-pha/' + article.slug
    : 'https://maps.dothihoalac.vn/kham-pha/' + encodeURIComponent(slug || '');

  const jsonLd = useMemo(() => {
    if (!article) return null;

    const graph = [
      {
        '@type': 'Article',
        '@id': canonical + '#article',
        headline: article.title,
        description: article.seoDescription || article.excerpt,
        datePublished: article.publishedAt,
        dateModified: article.updatedAt || article.publishedAt,
        mainEntityOfPage: { '@id': canonical },
        author: {
          '@type': 'Organization',
          name: 'HOLA Maps',
          url: 'https://maps.dothihoalac.vn/'
        },
        publisher: {
          '@type': 'Organization',
          name: 'HOLA Maps',
          url: 'https://maps.dothihoalac.vn/'
        },
        ...(article.coverImage ? { image: [article.coverImage] } : {})
      },
      {
        '@type': 'BreadcrumbList',
        '@id': canonical + '#breadcrumb',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'HOLA Maps', item: 'https://maps.dothihoalac.vn/' },
          { '@type': 'ListItem', position: 2, name: 'Khám phá Hòa Lạc', item: 'https://maps.dothihoalac.vn/kham-pha' },
          { '@type': 'ListItem', position: 3, name: article.title, item: canonical }
        ]
      }
    ];

    if (relatedPlaces.length) {
      graph.push({
        '@type': 'ItemList',
        '@id': canonical + '#places',
        name: 'Địa điểm liên quan',
        itemListElement: relatedPlaces.map((place, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: place.name,
          url: 'https://maps.dothihoalac.vn/place/' + place.id
        }))
      });
    }

    return { '@context': 'https://schema.org', '@graph': graph };
  }, [article, canonical, relatedPlaces]);

  async function shareArticle() {
    if (!article) return;
    const payload = { title: article.title, text: article.excerpt, url: canonical };

    try {
      if (navigator.share) await navigator.share(payload);
      else await navigator.clipboard.writeText(canonical);
      setShared(true);
      window.setTimeout(() => setShared(false), 1600);
    } catch {
      // User cancellation or unavailable clipboard should not block reading.
    }
  }

  if (loading) {
    return <div className="explore-article-state">Đang mở cẩm nang Hòa Lạc…</div>;
  }

  if (error || !article) {
    return (
      <div className="explore-article-state">
        <Compass size={34} />
        <h1>Không mở được bài viết.</h1>
        <p>{error || 'Bài viết không tồn tại.'}</p>
        <Link to="/kham-pha">Quay lại Khám phá</Link>
      </div>
    );
  }

  return (
    <article className="explore-article-page">
      <SeoHead
        title={article.seoTitle || article.title}
        description={article.seoDescription || article.excerpt}
        canonical={canonical}
        image={article.coverImage || undefined}
        imageAlt={article.title}
        type="article"
        jsonLd={jsonLd}
      />

      <header className="explore-article-hero">
        <div className="explore-article-hero-bg">
          {article.coverImage
            ? <img src={article.coverImage} alt="" />
            : <div><Compass size={54} /></div>}
        </div>

        <div className="explore-shell explore-article-hero-content">
          <Link className="explore-back" to="/kham-pha"><ArrowLeft size={17} /> Khám phá</Link>
          <span className="explore-kicker">{article.eyebrow}</span>
          <h1>{article.title}</h1>
          <p>{article.excerpt}</p>

          <div className="explore-article-meta">
            <span><CalendarDays size={15} /> {formatDate(article.publishedAt)}</span>
            <span><Clock3 size={15} /> {article.readingMinutes} phút đọc</span>
            <button type="button" onClick={shareArticle}>
              <Share2 size={15} /> {shared ? 'Đã sao chép' : 'Chia sẻ'}
            </button>
          </div>
        </div>
      </header>

      <div className="explore-shell explore-article-layout">
        <main className="explore-article-content">
          {article.body.map((section, index) => (
            <section key={section.heading || index}>
              {section.heading && <h2>{section.heading}</h2>}
              {Array.isArray(section.paragraphs) && section.paragraphs.map((paragraph, paragraphIndex) => (
                <p key={paragraphIndex}>{paragraph}</p>
              ))}
              {Array.isArray(section.bullets) && section.bullets.length > 0 && (
                <ul>
                  {section.bullets.map((bullet, bulletIndex) => <li key={bulletIndex}>{bullet}</li>)}
                </ul>
              )}
            </section>
          ))}

          {!!article.tags?.length && (
            <div className="explore-tags">
              {article.tags.map((tag) => <span key={tag}>#{tag}</span>)}
            </div>
          )}

          <div className="explore-map-cta">
            <MapPinned size={26} />
            <div>
              <strong>Muốn xem các điểm này nằm ở đâu?</strong>
              <p>Mở HOLA Maps để xem vị trí, khoảng cách và các địa điểm xung quanh.</p>
            </div>
            <Link to="/map">Mở bản đồ <ArrowRight size={16} /></Link>
          </div>
        </main>

        <aside className="explore-article-side">
          <div className="explore-side-card">
            <span>HOLA GUIDE</span>
            <strong>Khám phá bằng dữ liệu địa phương</strong>
            <p>
              Bài viết kết nối trực tiếp với dữ liệu địa điểm trên HOLA Maps.
              Thông tin có thể được cộng đồng tiếp tục cập nhật.
            </p>
          </div>
        </aside>
      </div>

      {!!relatedPlaces.length && (
        <section className="explore-related">
          <div className="explore-shell">
            <div className="explore-section-head">
              <div>
                <span>XEM TRÊN BẢN ĐỒ</span>
                <h2>Địa điểm liên quan</h2>
              </div>
              <Link to="/map">Xem tất cả <ArrowRight size={16} /></Link>
            </div>

            <div className="explore-place-grid">
              {relatedPlaces.map((place) => <PlaceCard key={place.id} place={place} />)}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}
