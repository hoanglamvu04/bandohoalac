import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Camera,
  KeyRound,
  MapPin,
  Trophy,
  UsersRound
} from 'lucide-react';
import { getLeaderboard } from '../services/api.js';

function initials(name = '') {
  const value = String(name).trim();
  if (!value) return 'HM';
  return value
    .split(/\s+/)
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function rankClass(rank) {
  if (rank >= 1 && rank <= 3) return 'community-rank medal rank-medal-' + rank;
  return 'community-rank';
}

export default function Leaderboard() {
  const [explorers, setExplorers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getLeaderboard()
      .then((data) => {
        if (active) setExplorers(Array.isArray(data?.items) ? data.items : []);
      })
      .catch(() => {
        if (active) setExplorers([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const periodLabel = useMemo(
    () => new Intl.DateTimeFormat('vi-VN', {
      month: 'long',
      year: 'numeric'
    }).format(new Date()),
    []
  );

  return (
    <main className="community-page">
      <section className="community-hero">
        <div className="community-hero-content">
          <div className="community-trophy">
            <Trophy size={40} strokeWidth={2.2} />
          </div>

          <span className="community-kicker">Cộng đồng Hola Explorer</span>

          <h1>Những người đang cùng xây bản đồ Hòa Lạc.</h1>

          <p className="community-hero-copy">
            Mỗi ảnh thật, cập nhật chính xác và địa điểm mới đều giúp Hola Maps hữu ích hơn.
          </p>

          <div className="community-values" aria-label="Giá trị cộng đồng">
            <div className="community-value">
              <span className="community-value-icon"><Camera size={22} /></span>
              <span>
                <b>Chia sẻ địa điểm</b>
                <span>Đóng góp hình ảnh thật</span>
              </span>
            </div>

            <div className="community-value">
              <span className="community-value-icon"><UsersRound size={22} /></span>
              <span>
                <b>Kết nối cộng đồng</b>
                <span>Cùng xây dựng Hòa Lạc</span>
              </span>
            </div>

            <div className="community-value">
              <span className="community-value-icon"><KeyRound size={22} /></span>
              <span>
                <b>Bản đồ hữu ích hơn</b>
                <span>Cho mọi người khám phá</span>
              </span>
            </div>
          </div>
        </div>

        <div className="community-hero-wave" aria-hidden="true" />
      </section>

      <section className="community-board-shell">
        <div className="community-board">
          <header className="community-board-head">
            <div className="community-board-title">
              <span className="community-board-title-icon">
                <Trophy size={28} strokeWidth={2.25} />
              </span>
              <div>
                <h2>Top Explorer</h2>
                <p>Những thành viên đóng góp tích cực nhất cho bản đồ Hòa Lạc</p>
              </div>
            </div>

            <div className="community-period" aria-label={periodLabel}>
              <CalendarDays size={17} />
              <span>{periodLabel}</span>
            </div>
          </header>

          <div className="community-table-head" aria-hidden="true">
            <span>#</span>
            <span>Thành viên</span>
            <span>Điểm</span>
          </div>

          {loading && (
            <div className="community-loading" aria-label="Đang tải xếp hạng">
              {Array.from({ length: 4 }).map((_, index) => (
                <div className="community-loading-row" key={index} />
              ))}
            </div>
          )}

          {!loading && !explorers.length && (
            <div className="community-empty">
              <Trophy size={30} />
              <b>Chưa có dữ liệu xếp hạng</b>
              <span>Hãy là người đóng góp đầu tiên cho Hola Maps.</span>
            </div>
          )}

          {!loading && explorers.length > 0 && (
            <div className="community-list">
              {explorers.map((person) => {
                const rank = Number(person.rank) || 0;
                const placesCount = Number(person.placesCount) || 0;
                const photosCount = Number(person.photosCount) || 0;
                const points = Number(person.points) || 0;

                return (
                  <article
                    className={'community-leader-row rank-' + rank}
                    key={person.id}
                  >
                    <span className={rankClass(rank)}>{rank}</span>

                    <span className="community-avatar" aria-hidden="true">
                      {initials(person.name)}
                    </span>

                    <div className="community-person">
                      <b>{person.name}</b>
                      <div className="community-person-meta">
                        <span><MapPin size={14} /> {placesCount} địa điểm</span>
                        <span><Camera size={14} /> {photosCount} ảnh</span>
                      </div>
                    </div>

                    <strong className="community-score">
                      {points.toLocaleString('vi-VN')}
                      <small>điểm</small>
                    </strong>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
