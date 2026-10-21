import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Compass, Search, Sparkles } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import SeoHead from '../components/SeoHead.jsx';
import { getExploreArticles } from '../services/api.js';

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(value));
}

function ArticleVisual({ article, large = false }) {
  if (article.coverImage) {
    return (
      <img
        className={large ? 'explore-card-image large' : 'explore-card-image'}
        src={article.coverImage}
        alt=""
        loading={large ? 'eager' : 'lazy'}
      />
    );
  }

  return (
    <div className={large ? 'explore-card-fallback large' : 'explore-card-fallback'}>
      <Compass size={large ? 42 : 30} />
      <span>HOLA GUIDE</span>
    </div>
  );
}

export default function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState({ items: [], categories: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const category = params.get('category') || 'all';
  const query = params.get('q') || '';

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');

    getExploreArticles({
      category: category === 'all' ? undefined : category,
      q: query || undefined,
      limit: 40
    }, { signal: controller.signal })
      .then((result) => {
        setData({
          items: Array.isArray(result?.items) ? result.items : [],
          categories: Array.isArray(result?.categories) ? result.categories : []
        });
      })
      .catch((requestError) => {
        if (requestError?.name !== 'AbortError') {
          setError(requestError?.message || 'Không tải được nội dung Khám phá.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [category, query]);

  const featured = useMemo(
    () => data.items.find((item) => item.featured) || data.items[0] || null,
    [data.items]
  );
  const rest = useMemo(
    () => data.items.filter((item) => item.id !== featured?.id),
    [data.items, featured?.id]
  );

  const canonical = 'https://maps.dothihoalac.vn/kham-pha';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Khám phá Hòa Lạc',
    description: 'Cẩm nang ăn gì, chơi gì, cafe, homestay và check-in tại Hòa Lạc từ HOLA Maps.',
    url: canonical,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: data.items.slice(0, 20).map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.title,
        url: canonical + '/' + item.slug
      }))
    }
  };

  function updateCategory(nextCategory) {
    const next = new URLSearchParams(params);
    if (!nextCategory || nextCategory === 'all') next.delete('category');
    else next.set('category', nextCategory);
    setParams(next, { replace: true });
  }

  function submitSearch(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = String(form.get('q') || '').trim();
    const next = new URLSearchParams(params);
    if (value) next.set('q', value);
    else next.delete('q');
    setParams(next, { replace: true });
  }

  return (
    <div className="explore-page">
      <SeoHead
        title="Khám phá Hòa Lạc"
        description="Cẩm nang Hòa Lạc: ăn gì, chơi gì, cafe, homestay, check-in và lịch trình địa phương, kết nối trực tiếp với HOLA Maps."
        canonical={canonical}
        jsonLd={jsonLd}
      />

      <section className="explore-hero">
        <div className="explore-shell explore-hero-grid">
          <div className="explore-hero-copy">
            <span className="explore-kicker"><Sparkles size={15} /> HOLA GUIDE</span>
            <h1>Khám phá Hòa Lạc theo cách dễ đi hơn.</h1>
            <p>
              Ăn gì, chơi gì, cafe nào đẹp, ở đâu cuối tuần — chọn ý tưởng trước,
              rồi mở địa điểm thật trên bản đồ.
            </p>

            <form className="explore-search" onSubmit={submitSearch}>
              <Search size={19} />
              <input
                name="q"
                defaultValue={query}
                placeholder="Tìm: cafe, homestay, FPT, cuối tuần..."
                aria-label="Tìm bài Khám phá Hòa Lạc"
              />
              <button type="submit">Tìm</button>
            </form>
          </div>

          <div className="explore-hero-stat">
            <Compass size={28} />
            <strong>{data.items.length || 20}</strong>
            <span>cẩm nang địa phương đang có</span>
          </div>
        </div>
      </section>

      <main className="explore-shell explore-main">
        <div className="explore-categories" aria-label="Chủ đề Khám phá">
          <button
            type="button"
            className={category === 'all' ? 'active' : ''}
            onClick={() => updateCategory('all')}
          >
            Tất cả
          </button>
          {data.categories.map((item) => (
            <button
              key={item.slug}
              type="button"
              className={category === item.slug ? 'active' : ''}
              onClick={() => updateCategory(item.slug)}
            >
              {item.label}<span>{item.count}</span>
            </button>
          ))}
        </div>

        {error && <div className="explore-state error">{error}</div>}
        {loading && <div className="explore-state">Đang tải cẩm nang Hòa Lạc…</div>}

        {!loading && !error && !data.items.length && (
          <div className="explore-state">Chưa có bài phù hợp với bộ lọc này.</div>
        )}

        {!loading && featured && (
          <Link className="explore-featured" to={'/kham-pha/' + featured.slug}>
            <ArticleVisual article={featured} large />
            <div className="explore-featured-copy">
              <span>{featured.eyebrow}</span>
              <h2>{featured.title}</h2>
              <p>{featured.excerpt}</p>
              <div>
                <small>{featured.readingMinutes} phút đọc · {formatDate(featured.publishedAt)}</small>
                <b>Đọc cẩm nang <ArrowRight size={17} /></b>
              </div>
            </div>
          </Link>
        )}

        {!!rest.length && (
          <section className="explore-section">
            <div className="explore-section-head">
              <div>
                <span>GỢI Ý TIẾP THEO</span>
                <h2>Chọn theo nhu cầu của bạn</h2>
              </div>
              <Link to="/map">Mở bản đồ <ArrowRight size={16} /></Link>
            </div>

            <div className="explore-grid">
              {rest.map((article) => (
                <Link className="explore-card" to={'/kham-pha/' + article.slug} key={article.id}>
                  <ArticleVisual article={article} />
                  <div className="explore-card-body">
                    <span>{article.categoryLabel}</span>
                    <h3>{article.title}</h3>
                    <p>{article.excerpt}</p>
                    <footer>
                      <small>{article.readingMinutes} phút đọc</small>
                      <ArrowRight size={17} />
                    </footer>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
