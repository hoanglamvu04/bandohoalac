import fs from 'node:fs';

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error('Patch target not found: ' + label);
  return source.replace(search, replacement);
}

function replaceRegex(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error('Patch regex target not found: ' + label);
  return source.replace(pattern, replacement);
}

// ---------------------------------------------------------------------------
// Backend: expose the Data Trust verification timestamp on regular place reads.
// ---------------------------------------------------------------------------
const placeServicePath = 'backend/src/services/place.service.js';
let placeService = fs.readFileSync(placeServicePath, 'utf8');
placeService = replaceOnce(
  placeService,
  "  '  p.updated_at,',\n  '  ST_X(p.location) AS lng,',",
  "  '  p.updated_at,',\n  '  p.last_verified_at,',\n  '  ST_X(p.location) AS lng,',",
  'place BASE_SELECT last_verified_at'
);
placeService = replaceOnce(
  placeService,
  "    createdAt: row.created_at,\n    updatedAt: row.updated_at\n  };",
  "    createdAt: row.created_at,\n    updatedAt: row.updated_at,\n    lastVerifiedAt: row.last_verified_at || null\n  };",
  'place mapper lastVerifiedAt'
);
fs.writeFileSync(placeServicePath, placeService);

// ---------------------------------------------------------------------------
// Map page: consumer discovery card, verification freshness and real favorites.
// ---------------------------------------------------------------------------
const mapPagePath = 'frontend/src/pages/MapPage.jsx';
let page = fs.readFileSync(mapPagePath, 'utf8');

page = replaceOnce(
  page,
  `import {\n  Building2,`,
  `import {\n  BadgeCheck,\n  Building2,`,
  'MapPage BadgeCheck import'
);
page = replaceOnce(
  page,
  `  HeartPulse,\n  House,\n  ExternalLink,`,
  `  HeartPulse,\n  House,\n  Heart,\n  ExternalLink,`,
  'MapPage Heart import'
);
page = replaceOnce(
  page,
  `  Satellite,\n  ShoppingBag,\n  SlidersHorizontal,\n  TriangleAlert,`,
  `  Satellite,\n  ShoppingBag,\n  SlidersHorizontal,\n  Sparkles,\n  Star,\n  TriangleAlert,`,
  'MapPage discovery icon imports'
);

page = replaceOnce(
  page,
  `import {\n  confirmRoadStatus,\n  createContribution,`,
  `import {\n  addFavorite,\n  confirmRoadStatus,\n  createContribution,`,
  'MapPage addFavorite import'
);
page = replaceOnce(
  page,
  `  getNearbyPlaces,\n  getPlace,\n  getPlaces,\n  getPlacesInBounds\n} from '../services/api.js';`,
  `  getNearbyPlaces,\n  getPlace,\n  getPlaceMe,\n  getPlaces,\n  getPlacesInBounds,\n  removeFavorite\n} from '../services/api.js';`,
  'MapPage favorite API imports'
);

const discoveryHelpers = `function formatPlaceAge(value) {
  if (!value) return '';
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86400000));
  if (days === 0) return 'hôm nay';
  if (days === 1) return 'hôm qua';
  if (days < 30) return days + ' ngày trước';
  const months = Math.floor(days / 30);
  if (months < 12) return months + ' tháng trước';
  const years = Math.floor(months / 12);
  return years + ' năm trước';
}

function getPlaceFreshness(place) {
  const verifiedAt = place?.lastVerifiedAt;
  const fallbackAt = place?.updatedAt || place?.createdAt;
  const date = verifiedAt || fallbackAt;
  const timestamp = date ? new Date(date).getTime() : NaN;
  const days = Number.isFinite(timestamp)
    ? Math.max(0, Math.floor((Date.now() - timestamp) / 86400000))
    : null;

  if (verifiedAt) {
    return {
      verified: true,
      tone: days !== null && days <= 60 ? 'verified' : 'verified-old',
      label: 'Đã xác minh' + (date ? ' · ' + formatPlaceAge(date) : ''),
      shortLabel: 'Đã xác minh'
    };
  }

  if (days === null) {
    return { verified: false, tone: 'unknown', label: 'Dữ liệu cộng đồng', shortLabel: 'Cộng đồng' };
  }

  if (days <= 30) {
    return { verified: false, tone: 'fresh', label: 'Mới cập nhật · ' + formatPlaceAge(date), shortLabel: 'Mới cập nhật' };
  }
  if (days <= 180) {
    return { verified: false, tone: 'recent', label: 'Cập nhật ' + formatPlaceAge(date), shortLabel: 'Đã cập nhật' };
  }
  return { verified: false, tone: 'stale', label: 'Có thể cần cập nhật · ' + formatPlaceAge(date), shortLabel: 'Cần cập nhật' };
}

function placeDistanceLabel(place, placeScope) {
  if (Number.isFinite(Number(place?.distanceFromUser))) {
    return formatDistance(place.distanceFromUser);
  }
  if (placeScope === 'nearby' && Number.isFinite(Number(place?.distance))) {
    return formatDistance(place.distance);
  }
  return '';
}

`;

page = replaceOnce(
  page,
  `export default function MapPage() {`,
  discoveryHelpers + `export default function MapPage() {`,
  'MapPage discovery helpers'
);

page = replaceOnce(
  page,
  `  const [galleryIndex, setGalleryIndex] = useState(0);\n  const [reportOpen, setReportOpen] = useState(false);`,
  `  const [galleryIndex, setGalleryIndex] = useState(0);\n  const [favorite, setFavorite] = useState(false);\n  const [favoriteBusy, setFavoriteBusy] = useState(false);\n  const [reportOpen, setReportOpen] = useState(false);`,
  'MapPage favorite state'
);

page = replaceOnce(
  page,
  `  useEffect(() => {\n    setGalleryIndex(0);\n  }, [selectedId]);\n\n  useEffect(() => {\n    if (!selectedId || !leftOpen) return undefined;`,
  `  useEffect(() => {\n    setGalleryIndex(0);\n  }, [selectedId]);\n\n  useEffect(() => {\n    if (!user || !selectedId) {\n      setFavorite(false);\n      return undefined;\n    }\n\n    let active = true;\n    getPlaceMe(selectedId)\n      .then((data) => {\n        if (active) setFavorite(Boolean(data?.favorite));\n      })\n      .catch(() => {\n        if (active) setFavorite(false);\n      });\n\n    return () => {\n      active = false;\n    };\n  }, [selectedId, user?.id]);\n\n  useEffect(() => {\n    if (!selectedId || !leftOpen) return undefined;`,
  'MapPage favorite load effect'
);

page = replaceOnce(
  page,
  `  function resetToViewportPlaces() {`,
  `  async function toggleSelectedFavorite() {\n    if (!selectedPlace) return;\n    if (!user) {\n      showToast('Đăng nhập để lưu địa điểm.', 'info');\n      return;\n    }\n    if (favoriteBusy) return;\n\n    setFavoriteBusy(true);\n    try {\n      const data = favorite\n        ? await removeFavorite(selectedPlace.id)\n        : await addFavorite(selectedPlace.id);\n      const nextFavorite = Boolean(data?.favorite);\n      setFavorite(nextFavorite);\n      showToast(nextFavorite ? 'Đã lưu địa điểm.' : 'Đã bỏ lưu địa điểm.', 'success');\n    } catch (error) {\n      showToast(error.message || 'Không cập nhật được địa điểm đã lưu.', 'error');\n    } finally {\n      setFavoriteBusy(false);\n    }\n  }\n\n  function resetToViewportPlaces() {`,
  'MapPage toggle favorite action'
);

const oldRowCopy = `                <span className="hm-place-copy">\n                  <small>{place.category || 'Địa điểm'}</small>\n                  <b>{place.name}</b>\n                  <em>\n                    {Number.isFinite(Number(place.distanceFromUser))\n                      ? formatDistance(place.distanceFromUser) + ' · '\n                      : placeScope === 'nearby' && Number.isFinite(Number(place.distance))\n                        ? formatDistance(place.distance) + ' · '\n                        : ''}\n                    {place.address || 'Hòa Lạc, Hà Nội'}\n                  </em>\n                  {place.openingHours && (() => {\n                    const status = formatOpenStatus(place.openingHours);\n                    return (\n                      <span className={status.known ? (status.open ? 'hm-open-status open' : 'hm-open-status closed') : 'hm-open-status unknown'}>\n                        {status.label} · {place.openingHours}\n                      </span>\n                    );\n                  })()}\n                </span>\n                <span className="hm-place-rating">★ {Number(place.rating || 0).toFixed(1)}</span>`;

const newRowCopy = `                <span className="hm-place-copy">\n                  <span className="hm-place-topline">\n                    <small>{place.category || 'Địa điểm'}</small>\n                    {place.lastVerifiedAt && (\n                      <i className="hm-place-verified-mini"><BadgeCheck size={11} /> Đã xác minh</i>\n                    )}\n                    {place.isPartner && (\n                      <i className="hm-place-partner-mini"><Sparkles size={10} /> Đối tác</i>\n                    )}\n                  </span>\n                  <b>{place.name}</b>\n                  <span className="hm-place-inline-meta">\n                    <i className={Number(place.rating || 0) > 0 ? 'rating' : 'new-place'}>\n                      <Star size={11} fill={Number(place.rating || 0) > 0 ? 'currentColor' : 'none'} />\n                      {Number(place.rating || 0) > 0 ? Number(place.rating).toFixed(1) : 'Mới'}\n                    </i>\n                    {place.openingHours && (() => {\n                      const status = formatOpenStatus(place.openingHours);\n                      return (\n                        <i className={status.known ? (status.open ? 'open' : 'closed') : 'unknown'}>\n                          {status.label}\n                        </i>\n                      );\n                    })()}\n                    {placeDistanceLabel(place, placeScope) && (\n                      <i className="distance">{placeDistanceLabel(place, placeScope)}</i>\n                    )}\n                  </span>\n                  <em>{place.address || 'Hòa Lạc, Hà Nội'}</em>\n                </span>`;

page = replaceOnce(page, oldRowCopy, newRowCopy, 'MapPage sidebar place card content');

const inspectorPattern = /      \{selectedPlace && !routeDestination && \([\s\S]*?\n      \)\}\n\n      \{routeDestination && \(/;
const inspectorReplacement = `      {selectedPlace && !routeDestination && (() => {\n        const freshness = getPlaceFreshness(selectedPlace);\n        const openStatus = selectedPlace.openingHours\n          ? formatOpenStatus(selectedPlace.openingHours)\n          : null;\n        const selectedDistance = placeDistanceLabel(selectedPlace, placeScope);\n        const rating = Number(selectedPlace.rating || 0);\n        const hasRating = rating > 0;\n\n        return (\n          <section className={selectedImages.length ? 'hm-place-inspector discovery-v3 has-gallery' : 'hm-place-inspector discovery-v3'}>\n            <button\n              className="hm-inspector-close"\n              type="button"\n              onClick={() => {\n                setSelectedId(null);\n                syncDiscoveryParams({ place: null });\n              }}\n              aria-label="Đóng địa điểm"\n            >\n              <X size={17} />\n            </button>\n\n            <div className="hm-inspector-hero">\n              {selectedImages.length > 0 ? (\n                <div className="hm-inspector-gallery">\n                  <div\n                    className="hm-inspector-gallery-main"\n                    onTouchStart={startGallerySwipe}\n                    onTouchEnd={endGallerySwipe}\n                  >\n                    <img\n                      src={selectedImages[galleryIndex]}\n                      alt={selectedPlace.name + ' · ảnh ' + (galleryIndex + 1)}\n                    />\n                    {selectedImages.length > 1 && (\n                      <>\n                        <button className="hm-gallery-arrow prev" type="button" onClick={showPreviousImage} aria-label="Ảnh trước">\n                          <ChevronLeft size={18} />\n                        </button>\n                        <button className="hm-gallery-arrow next" type="button" onClick={showNextImage} aria-label="Ảnh tiếp theo">\n                          <ChevronRight size={18} />\n                        </button>\n                        <span className="hm-gallery-count"><Camera size={13} /> {galleryIndex + 1}/{selectedImages.length}</span>\n                      </>\n                    )}\n                  </div>\n                </div>\n              ) : (\n                <div className={'hm-inspector-fallback ' + getPlaceCategoryVisual(selectedPlace).tone}>\n                  <span><PlaceCategoryIcon place={selectedPlace} size={42} /></span>\n                  <small>Chưa có ảnh · {selectedPlace.category || 'Địa điểm'}</small>\n                </div>\n              )}\n\n              <div className="hm-inspector-hero-badges">\n                <span className="category"><PlaceCategoryIcon place={selectedPlace} size={13} /> {selectedPlace.category || 'Địa điểm'}</span>\n                {freshness.verified && <span className="verified"><BadgeCheck size={13} /> Đã xác minh</span>}\n                {selectedPlace.isPartner && <span className="partner"><Sparkles size={12} /> Đối tác</span>}\n              </div>\n            </div>\n\n            <div className="hm-inspector-body">\n              <div className="hm-inspector-heading">\n                <h2>{selectedPlace.name}</h2>\n                <p><MapPin size={14} /> {selectedPlace.address || 'Hòa Lạc, Hà Nội'}</p>\n              </div>\n\n              <div className={'hm-inspector-trust ' + freshness.tone}>\n                {freshness.verified ? <BadgeCheck size={15} /> : <Clock3 size={15} />}\n                <div>\n                  <b>{freshness.label}</b>\n                  <small>{freshness.verified ? 'Thông tin đã được Hola Maps kiểm tra' : 'Dữ liệu có thể được cộng đồng tiếp tục cập nhật'}</small>\n                </div>\n              </div>\n\n              <div className="hm-inspector-stats discovery-stats">\n                <span>\n                  <b className={hasRating ? 'rating-value' : ''}>{hasRating ? '★ ' + rating.toFixed(1) : 'Mới'}</b>\n                  <small>{Number(selectedPlace.reviews || 0)} đánh giá</small>\n                </span>\n                <span>\n                  <b>{selectedDistance || selectedPlace.priceLevel || '—'}</b>\n                  <small>{selectedDistance ? 'Khoảng cách' : 'Mức giá'}</small>\n                </span>\n                <span>\n                  <b>{selectedImages.length || 0}</b>\n                  <small>Ảnh địa điểm</small>\n                </span>\n              </div>\n\n              {openStatus && (\n                <div className={openStatus.known ? (openStatus.open ? 'hm-inspector-open open' : 'hm-inspector-open closed') : 'hm-inspector-open'}>\n                  <Clock3 size={14} />\n                  <b>{openStatus.label}</b>\n                  <span>{selectedPlace.openingHours}</span>\n                </div>\n              )}\n\n              {selectedPlace.description && (\n                <p className="hm-inspector-description">{selectedPlace.description}</p>\n              )}\n\n              <div className="hm-inspector-actions discovery-actions">\n                <button className="primary" type="button" onClick={() => startDirections(selectedPlace)}>\n                  <Navigation size={16} /> Chỉ đường\n                </button>\n                <button\n                  className={favorite ? 'save active' : 'save'}\n                  type="button"\n                  onClick={toggleSelectedFavorite}\n                  disabled={favoriteBusy}\n                >\n                  <Heart size={16} fill={favorite ? 'currentColor' : 'none'} /> {favorite ? 'Đã lưu' : 'Lưu'}\n                </button>\n                <Link className="details" to={'/place/' + selectedPlace.id}>\n                  Chi tiết <ChevronRight size={15} />\n                </Link>\n              </div>\n            </div>\n          </section>\n        );\n      })()}\n\n      {routeDestination && (`;

page = replaceRegex(page, inspectorPattern, inspectorReplacement, 'MapPage discovery inspector');
fs.writeFileSync(mapPagePath, page);

// ---------------------------------------------------------------------------
// Map marker interaction: selected/hovered POIs visibly lift above neighbors.
// ---------------------------------------------------------------------------
const mapViewPath = 'frontend/src/components/MapView.jsx';
let mapView = fs.readFileSync(mapViewPath, 'utf8');
const oldIconLayer = `      layout: {\n        'icon-image': ['coalesce', ['get', 'markerIcon'], 'hm-marker-default'],\n        'icon-size': [\n          'interpolate',\n          ['linear'],\n          ['zoom'],\n          12.5, 0.62,\n          14, 0.72,\n          17, 0.88\n        ],\n        'icon-allow-overlap': true,\n        'icon-ignore-placement': true\n      }\n    });`;
const newIconLayer = `      layout: {\n        'icon-image': ['coalesce', ['get', 'markerIcon'], 'hm-marker-default'],\n        'icon-size': [\n          'interpolate',\n          ['linear'],\n          ['zoom'],\n          12.5, ['case',\n            ['boolean', ['feature-state', 'selected'], false], 0.80,\n            ['boolean', ['feature-state', 'hovered'], false], 0.70,\n            0.62\n          ],\n          14, ['case',\n            ['boolean', ['feature-state', 'selected'], false], 0.92,\n            ['boolean', ['feature-state', 'hovered'], false], 0.82,\n            0.72\n          ],\n          17, ['case',\n            ['boolean', ['feature-state', 'selected'], false], 1.08,\n            ['boolean', ['feature-state', 'hovered'], false], 0.98,\n            0.88\n          ]\n        ],\n        'icon-allow-overlap': true,\n        'icon-ignore-placement': true\n      },\n      paint: {\n        'icon-opacity': [\n          'case',\n          ['boolean', ['feature-state', 'selected'], false], 1,\n          ['boolean', ['feature-state', 'hovered'], false], 1,\n          0.94\n        ]\n      }\n    });`;
mapView = replaceOnce(mapView, oldIconLayer, newIconLayer, 'MapView marker selected/hover scale');
fs.writeFileSync(mapViewPath, mapView);

// ---------------------------------------------------------------------------
// CSS: append V3 overrides so legacy responsive rules remain intact.
// ---------------------------------------------------------------------------
const cssPath = 'frontend/src/map-workspace.css';
let css = fs.readFileSync(cssPath, 'utf8');
css += `\n\n/* =========================================================\n   MAP DISCOVERY UI V3\n   Consumer-grade place cards, trust badges and detail card.\n   ========================================================= */\n.hm-place-row{position:relative;min-height:82px;gap:12px;padding:9px 10px;border-radius:15px;transition:background .16s ease,transform .16s ease,box-shadow .16s ease}\n.hm-place-row:hover,.hm-place-row.hovered{background:#f4f8f6;transform:translateY(-1px);box-shadow:0 7px 18px rgba(18,65,53,.07)}\n.hm-place-row.active{background:#edf6f2;box-shadow:inset 0 0 0 1px rgba(31,111,88,.16),0 8px 20px rgba(18,65,53,.08)}\n.hm-place-copy{min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:3px}\n.hm-place-topline{width:100%;display:flex;align-items:center;gap:5px;min-width:0}\n.hm-place-topline>small{max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#6f837c;font-size:9px;font-weight:900;letter-spacing:.075em;text-transform:uppercase}\n.hm-place-verified-mini,.hm-place-partner-mini{display:inline-flex;align-items:center;gap:3px;padding:3px 5px;border-radius:999px;font-size:8px;font-style:normal;font-weight:900;white-space:nowrap}\n.hm-place-verified-mini{color:#146347;background:#e3f4eb}\n.hm-place-partner-mini{color:#7a5c13;background:#fff3cb}\n.hm-place-copy>b{width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#143d33;font-size:14px;line-height:1.28}\n.hm-place-inline-meta{display:flex;align-items:center;gap:5px;min-height:18px;overflow:hidden;white-space:nowrap}\n.hm-place-inline-meta i{display:inline-flex;align-items:center;gap:3px;margin:0;font-size:9px;font-style:normal;font-weight:850;color:#71827c}\n.hm-place-inline-meta i:not(:first-child)::before{content:'·';margin-right:2px;color:#a3b0ab}\n.hm-place-inline-meta .rating{color:#986900}.hm-place-inline-meta .new-place{color:#50736a}.hm-place-inline-meta .open{color:#138452}.hm-place-inline-meta .closed{color:#b64a4a}.hm-place-inline-meta .distance{color:#496a61}\n.hm-place-copy>em{width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#86958f;font-size:10px;font-style:normal}\n.hm-place-rating{display:none}\n\n.hm-place-inspector.discovery-v3{padding:0;overflow:hidden;border:1px solid rgba(211,226,219,.92);border-radius:22px;background:#fff;box-shadow:0 24px 62px rgba(12,47,39,.18)}\n.hm-place-inspector.discovery-v3 .hm-inspector-close{top:10px;right:10px;z-index:8;width:34px;height:34px;border:1px solid rgba(255,255,255,.55);background:rgba(16,53,44,.72);color:#fff;backdrop-filter:blur(10px);box-shadow:0 5px 14px rgba(0,0,0,.16)}\n.hm-inspector-hero{position:relative;min-height:118px;background:linear-gradient(145deg,#e8f2ed,#d8ebe3)}\n.hm-place-inspector.discovery-v3 .hm-inspector-gallery{margin:0}\n.hm-place-inspector.discovery-v3 .hm-inspector-gallery-main{height:190px;border-radius:0;overflow:hidden;background:#dde9e4}\n.hm-place-inspector.discovery-v3 .hm-inspector-gallery-main>img{width:100%;height:100%;object-fit:cover}\n.hm-place-inspector.discovery-v3 .hm-gallery-count{display:inline-flex;align-items:center;gap:5px;padding:6px 8px;border-radius:999px;background:rgba(16,53,44,.72);color:#fff;font-size:10px;font-weight:900;backdrop-filter:blur(8px)}\n.hm-inspector-fallback{height:150px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;color:#174d41;background:linear-gradient(145deg,#eef7f3,#daeae3)}\n.hm-inspector-fallback>span{width:70px;height:70px;display:grid;place-items:center;border:1px solid rgba(23,77,65,.12);border-radius:22px;background:rgba(255,255,255,.74);box-shadow:0 10px 24px rgba(18,65,53,.08)}\n.hm-inspector-fallback small{font-size:10px;font-weight:850;color:#687d76}\n.hm-inspector-fallback.cafe{color:#915514;background:linear-gradient(145deg,#fbf1df,#f3e0c2)}\n.hm-inspector-fallback.food{color:#d54d2b;background:linear-gradient(145deg,#fff0e9,#f9daca)}\n.hm-inspector-fallback.tourism,.hm-inspector-fallback.transport{color:#187b9f;background:linear-gradient(145deg,#e9f7fb,#d4edf4)}\n.hm-inspector-fallback.experience,.hm-inspector-fallback.stay{color:#6748b5;background:linear-gradient(145deg,#f0ebfb,#e1d8f6)}\n.hm-inspector-fallback.health{color:#c74545;background:linear-gradient(145deg,#fff0f0,#f8dddd)}\n.hm-inspector-hero-badges{position:absolute;left:12px;right:50px;bottom:10px;z-index:5;display:flex;gap:6px;flex-wrap:wrap}\n.hm-inspector-hero-badges>span{display:inline-flex;align-items:center;gap:5px;min-height:27px;padding:0 9px;border-radius:999px;font-size:9px;font-weight:900;backdrop-filter:blur(8px);box-shadow:0 4px 12px rgba(0,0,0,.10)}\n.hm-inspector-hero-badges .category{color:#173f35;background:rgba(255,255,255,.90)}\n.hm-inspector-hero-badges .verified{color:#fff;background:rgba(20,105,73,.91)}\n.hm-inspector-hero-badges .partner{color:#654800;background:rgba(255,239,180,.94)}\n.hm-inspector-body{padding:16px 17px 17px}\n.hm-inspector-heading h2{margin:0;color:#123a30;font-size:21px;line-height:1.15;letter-spacing:-.025em}\n.hm-inspector-heading p{display:flex;align-items:center;gap:5px;margin:7px 0 0;color:#72857e;font-size:11px;line-height:1.45}\n.hm-inspector-trust{display:flex;align-items:flex-start;gap:9px;margin-top:12px;padding:10px 11px;border:1px solid #e2ebe7;border-radius:12px;background:#f7faf8;color:#547168}\n.hm-inspector-trust>svg{margin-top:1px;flex:0 0 auto}.hm-inspector-trust b,.hm-inspector-trust small{display:block}.hm-inspector-trust b{font-size:10px}.hm-inspector-trust small{margin-top:2px;color:#81918c;font-size:9px;line-height:1.4}\n.hm-inspector-trust.verified{border-color:#cde7da;background:#edf8f2;color:#146847}.hm-inspector-trust.fresh{border-color:#d7e8e1;background:#f0f8f4;color:#316c59}.hm-inspector-trust.stale{border-color:#eedfc9;background:#fff9ee;color:#89682d}\n.hm-place-inspector.discovery-v3 .discovery-stats{grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:11px}\n.hm-place-inspector.discovery-v3 .discovery-stats>span{min-width:0;padding:9px 7px;border:1px solid #e8efec;border-radius:11px;background:#fafcfb;text-align:left}\n.hm-place-inspector.discovery-v3 .discovery-stats b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#244f43;font-size:12px}.hm-place-inspector.discovery-v3 .discovery-stats .rating-value{color:#8b6707}.hm-place-inspector.discovery-v3 .discovery-stats small{margin-top:3px;color:#8a9893;font-size:8px}\n.hm-place-inspector.discovery-v3 .hm-inspector-open{margin-top:10px;border-radius:11px}\n.hm-inspector-description{display:-webkit-box;overflow:hidden;margin:11px 0 0;color:#62766f;font-size:10px;line-height:1.55;-webkit-line-clamp:3;-webkit-box-orient:vertical}\n.hm-place-inspector.discovery-v3 .discovery-actions{display:grid;grid-template-columns:1.18fr .82fr 1fr;gap:7px;margin-top:13px}\n.hm-place-inspector.discovery-v3 .discovery-actions>*{min-height:40px;display:flex;align-items:center;justify-content:center;gap:6px;margin:0;border:0;border-radius:11px;text-decoration:none;font:inherit;font-size:10px;font-weight:900;cursor:pointer}\n.hm-place-inspector.discovery-v3 .discovery-actions .primary{color:#fff;background:#175848;box-shadow:0 8px 18px rgba(23,88,72,.17)}\n.hm-place-inspector.discovery-v3 .discovery-actions .save{color:#315f53;background:#edf4f1}.hm-place-inspector.discovery-v3 .discovery-actions .save.active{color:#a04444;background:#fff0ef}.hm-place-inspector.discovery-v3 .discovery-actions .save:disabled{opacity:.6;cursor:wait}\n.hm-place-inspector.discovery-v3 .discovery-actions .details{color:#315f53;background:#f2f6f4}\n\n@media(max-width:760px){.hm-place-row{min-height:74px;padding:8px}.hm-place-copy>b{font-size:13px}.hm-place-topline>small{max-width:108px}.hm-place-verified-mini,.hm-place-partner-mini{display:none}.hm-place-inline-meta{gap:4px}.hm-place-inspector.discovery-v3{left:10px;right:10px;width:auto;max-height:calc(var(--app-visual-height,100dvh) - var(--app-safe-top,0px) - 94px);border-radius:20px}.hm-place-inspector.discovery-v3 .hm-inspector-gallery-main{height:160px}.hm-inspector-fallback{height:132px}.hm-inspector-body{padding:14px}.hm-inspector-heading h2{font-size:19px}.hm-place-inspector.discovery-v3 .discovery-actions{grid-template-columns:1fr 1fr 1fr}.hm-place-inspector.discovery-v3 .discovery-actions>*{min-height:38px;font-size:9px}}\n`;
fs.writeFileSync(cssPath, css);

console.log('Map Discovery UI v3 patch applied.');
