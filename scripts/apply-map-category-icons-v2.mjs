import fs from 'node:fs';

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Patch target not found: ${label}`);
  }
  return source.replace(search, replacement);
}

function replaceRegex(source, pattern, replacement, label) {
  if (!pattern.test(source)) {
    throw new Error(`Patch regex target not found: ${label}`);
  }
  return source.replace(pattern, replacement);
}

const pagePath = 'frontend/src/pages/MapPage.jsx';
let page = fs.readFileSync(pagePath, 'utf8');

page = replaceOnce(
  page,
  `  CalendarDays,\n  ChevronDown,\n  ChevronLeft,\n  ChevronRight,\n  Clock3,\n  Construction,`,
  `  CalendarDays,\n  Camera,\n  ChevronDown,\n  ChevronLeft,\n  ChevronRight,\n  Clock3,\n  Coffee,\n  Compass,\n  Construction,\n  Dumbbell,\n  Fuel,\n  GraduationCap,\n  HeartPulse,\n  House,`,
  'MapPage lucide imports A'
);

page = replaceOnce(
  page,
  `  Satellite,\n  SlidersHorizontal,\n  TriangleAlert,\n  Waves,\n  X`,
  `  Satellite,\n  ShoppingBag,\n  SlidersHorizontal,\n  TriangleAlert,\n  UtensilsCrossed,\n  Waves,\n  Wrench,\n  X`,
  'MapPage lucide imports B'
);

const categoryHelpers = `const PLACE_CATEGORY_VISUALS = [
  { key: 'cafe', tone: 'cafe', icon: Coffee, aliases: ['cafe', 'coffee', 'ca phe'] },
  { key: 'food', tone: 'food', icon: UtensilsCrossed, aliases: ['an uong', 'food', 'restaurant', 'nha hang', 'quan an'] },
  { key: 'homestay', tone: 'stay', icon: House, aliases: ['homestay', 'luu tru', 'hotel', 'resort'] },
  { key: 'villa', tone: 'stay', icon: Building2, aliases: ['villa', 'biet thu'] },
  { key: 'tourism', tone: 'tourism', icon: Mountain, aliases: ['khu du lich', 'tourism', 'tourist', 'du lich'] },
  { key: 'checkin', tone: 'checkin', icon: Camera, aliases: ['check in', 'checkin', 'chup anh'] },
  { key: 'experience', tone: 'experience', icon: Compass, aliases: ['trai nghiem', 'vui choi', 'giai tri', 'experience'] },
  { key: 'school', tone: 'school', icon: GraduationCap, aliases: ['truong', 'school', 'giao duc'] },
  { key: 'health', tone: 'health', icon: HeartPulse, aliases: ['y te', 'hospital', 'medical', 'benh vien', 'phong kham'] },
  { key: 'market', tone: 'market', icon: ShoppingBag, aliases: ['sieu thi', 'cua hang', 'shop', 'market'] },
  { key: 'bank', tone: 'bank', icon: Landmark, aliases: ['ngan hang', 'atm', 'bank'] },
  { key: 'fuel', tone: 'fuel', icon: Fuel, aliases: ['nhien lieu', 'tram xang', 'cay xang', 'sac', 'fuel'] },
  { key: 'government', tone: 'government', icon: Landmark, aliases: ['co quan', 'government', 'ubnd', 'hanh chinh'] },
  { key: 'sport', tone: 'sport', icon: Dumbbell, aliases: ['the thao', 'sport', 'gym', 'fitness'] },
  { key: 'service', tone: 'service', icon: Wrench, aliases: ['dich vu', 'service', 'spa', 'salon'] },
  { key: 'transport', tone: 'transport', icon: Route, aliases: ['giao thong', 'transport', 'ben xe', 'tram xe'] },
  { key: 'property', tone: 'property', icon: Building2, aliases: ['bat dong san', 'real estate', 'nha dat'] }
];

function normalizePlaceCategory(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase()
    .replace(/[-_/]+/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

function getPlaceCategoryVisual(place) {
  const categoryValue = typeof place?.category === 'object'
    ? [place.category?.name, place.category?.slug].filter(Boolean).join(' ')
    : place?.category;
  const haystack = normalizePlaceCategory([
    categoryValue,
    place?.categorySlug,
    place?.category_slug
  ].filter(Boolean).join(' '));

  return PLACE_CATEGORY_VISUALS.find((item) =>
    item.aliases.some((alias) => haystack.includes(alias))
  ) || { key: 'default', tone: 'default', icon: MapPin };
}

function getPlaceListImage(place) {
  const candidates = [
    place?.thumbnails?.[0],
    place?.thumbnail,
    place?.cardImages?.[0],
    place?.cardImage,
    place?.images?.[0]
  ];
  return candidates.find((value) => typeof value === 'string' && value.trim()) || '';
}

function PlaceCategoryIcon({ place, size = 24 }) {
  const visual = getPlaceCategoryVisual(place);
  const Icon = visual.icon;
  return <Icon size={size} strokeWidth={2.25} aria-hidden="true" />;
}

`;

page = replaceOnce(
  page,
  `function formatDistance(meters) {`,
  categoryHelpers + `function formatDistance(meters) {`,
  'MapPage category helpers'
);

const oldThumb = `                <span className="hm-place-thumb">\n                  {(place.thumbnails?.[0] || place.images?.[0])\n                    ? (\n                      <img\n                        src={place.thumbnails?.[0] || place.images?.[0]}\n                        alt=""\n                        loading="lazy"\n                        decoding="async"\n                      />\n                    )\n                    : <MapPin size={17} />}\n                </span>`;

const newThumb = `                <span\n                  className={\n                    'hm-place-thumb ' +\n                    (getPlaceListImage(place) ? 'has-image ' : 'icon-fallback ') +\n                    getPlaceCategoryVisual(place).tone\n                  }\n                >\n                  {getPlaceListImage(place) ? (\n                    <>\n                      <img\n                        src={getPlaceListImage(place)}\n                        alt={place.name ? 'Ảnh ' + place.name : ''}\n                        loading="lazy"\n                        decoding="async"\n                        onError={(event) => {\n                          event.currentTarget.hidden = true;\n                          event.currentTarget.parentElement?.classList.add('image-error');\n                        }}\n                      />\n                      <span className="hm-place-fallback-icon">\n                        <PlaceCategoryIcon place={place} size={25} />\n                      </span>\n                    </>\n                  ) : (\n                    <PlaceCategoryIcon place={place} size={25} />\n                  )}\n                </span>`;

page = replaceOnce(page, oldThumb, newThumb, 'MapPage place thumbnail');
fs.writeFileSync(pagePath, page);

const viewPath = 'frontend/src/components/MapView.jsx';
let view = fs.readFileSync(viewPath, 'utf8');

const markerBlockPattern = /const PLACE_MARKER_LIBRARY = \[[\s\S]*?function ensurePlaceMarkerImages\(map\) \{/;
const markerBlock = `const PLACE_MARKER_LIBRARY = [
  { id: 'hm-marker-cafe', key: 'cafe', color: '#9a5b19' },
  { id: 'hm-marker-food', key: 'food', color: '#ee5a2f' },
  { id: 'hm-marker-homestay', key: 'homestay', color: '#7857c8' },
  { id: 'hm-marker-villa', key: 'villa', color: '#6d4dc2' },
  { id: 'hm-marker-tourism', key: 'tourism', color: '#1684b8' },
  { id: 'hm-marker-checkin', key: 'checkin', color: '#d84983' },
  { id: 'hm-marker-experience', key: 'experience', color: '#7148ca' },
  { id: 'hm-marker-school', key: 'school', color: '#2c6fd6' },
  { id: 'hm-marker-health', key: 'health', color: '#d64545' },
  { id: 'hm-marker-market', key: 'market', color: '#2f9561' },
  { id: 'hm-marker-bank', key: 'bank', color: '#2777a8' },
  { id: 'hm-marker-fuel', key: 'fuel', color: '#198276' },
  { id: 'hm-marker-government', key: 'government', color: '#5b6878' },
  { id: 'hm-marker-sport', key: 'sport', color: '#258967' },
  { id: 'hm-marker-service', key: 'service', color: '#6b7280' },
  { id: 'hm-marker-transport', key: 'transport', color: '#168b8a' },
  { id: 'hm-marker-property', key: 'property', color: '#8a4f31' },
  { id: 'hm-marker-default', key: 'default', color: '#174d41' }
];

const PLACE_MARKER_BY_ID = new Map(
  PLACE_MARKER_LIBRARY.map((item) => [item.id, item])
);

function normalizeMarkerCategory(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase()
    .replace(/[-_/]+/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

function categoryMarkerMeta(category) {
  const raw = typeof category === 'object'
    ? [category?.name, category?.slug].filter(Boolean).join(' ')
    : category;
  const normalized = normalizeMarkerCategory(raw);
  const has = (...values) => values.some((value) => normalized.includes(value));

  if (has('cafe', 'coffee', 'ca phe')) return PLACE_MARKER_BY_ID.get('hm-marker-cafe');
  if (has('an uong', 'food', 'restaurant', 'nha hang', 'quan an')) return PLACE_MARKER_BY_ID.get('hm-marker-food');
  if (has('homestay', 'luu tru', 'hotel', 'resort')) return PLACE_MARKER_BY_ID.get('hm-marker-homestay');
  if (has('villa', 'biet thu')) return PLACE_MARKER_BY_ID.get('hm-marker-villa');
  if (has('khu du lich', 'tourism', 'tourist', 'du lich')) return PLACE_MARKER_BY_ID.get('hm-marker-tourism');
  if (has('check in', 'checkin', 'chup anh')) return PLACE_MARKER_BY_ID.get('hm-marker-checkin');
  if (has('trai nghiem', 'vui choi', 'giai tri', 'experience')) return PLACE_MARKER_BY_ID.get('hm-marker-experience');
  if (has('truong', 'school', 'giao duc')) return PLACE_MARKER_BY_ID.get('hm-marker-school');
  if (has('y te', 'hospital', 'medical', 'benh vien', 'phong kham')) return PLACE_MARKER_BY_ID.get('hm-marker-health');
  if (has('sieu thi', 'cua hang', 'shop', 'market')) return PLACE_MARKER_BY_ID.get('hm-marker-market');
  if (has('ngan hang', 'atm', 'bank')) return PLACE_MARKER_BY_ID.get('hm-marker-bank');
  if (has('nhien lieu', 'tram xang', 'cay xang', 'sac', 'fuel')) return PLACE_MARKER_BY_ID.get('hm-marker-fuel');
  if (has('co quan', 'government', 'ubnd', 'hanh chinh')) return PLACE_MARKER_BY_ID.get('hm-marker-government');
  if (has('the thao', 'sport', 'gym', 'fitness')) return PLACE_MARKER_BY_ID.get('hm-marker-sport');
  if (has('dich vu', 'service', 'spa', 'salon')) return PLACE_MARKER_BY_ID.get('hm-marker-service');
  if (has('giao thong', 'transport', 'ben xe', 'tram xe')) return PLACE_MARKER_BY_ID.get('hm-marker-transport');
  if (has('bat dong san', 'real estate', 'nha dat')) return PLACE_MARKER_BY_ID.get('hm-marker-property');

  return PLACE_MARKER_BY_ID.get('hm-marker-default');
}

function strokeLine(context, points) {
  context.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();
}

function drawMarkerGlyph(context, key) {
  context.save();
  context.strokeStyle = '#ffffff';
  context.fillStyle = '#ffffff';
  context.lineWidth = 3.8;
  context.lineCap = 'round';
  context.lineJoin = 'round';

  if (key === 'cafe') {
    context.strokeRect(34, 33, 23, 14);
    context.beginPath(); context.arc(58, 40, 6, -Math.PI / 2, Math.PI / 2); context.stroke();
    strokeLine(context, [[35, 52], [58, 52]]);
    strokeLine(context, [[39, 29], [39, 24]]);
    strokeLine(context, [[47, 29], [47, 22]]);
    strokeLine(context, [[55, 29], [55, 25]]);
  } else if (key === 'food') {
    strokeLine(context, [[36, 26], [36, 53]]);
    strokeLine(context, [[31, 26], [31, 36], [41, 36], [41, 26]]);
    strokeLine(context, [[58, 26], [53, 40], [58, 40], [58, 53]]);
  } else if (key === 'homestay' || key === 'villa' || key === 'property') {
    strokeLine(context, [[31, 39], [48, 25], [65, 39]]);
    context.strokeRect(35, 38, 26, 18);
    context.strokeRect(45, 46, 7, 10);
  } else if (key === 'tourism') {
    strokeLine(context, [[29, 53], [42, 34], [50, 44], [57, 35], [67, 53]]);
    context.beginPath(); context.arc(62, 28, 5, 0, Math.PI * 2); context.stroke();
  } else if (key === 'checkin') {
    context.strokeRect(31, 32, 34, 23);
    context.strokeRect(39, 27, 12, 5);
    context.beginPath(); context.arc(48, 43, 7, 0, Math.PI * 2); context.stroke();
  } else if (key === 'experience') {
    context.beginPath(); context.arc(48, 40, 17, 0, Math.PI * 2); context.stroke();
    strokeLine(context, [[55, 31], [51, 43], [40, 49], [45, 36], [55, 31]]);
  } else if (key === 'school') {
    strokeLine(context, [[29, 36], [48, 27], [67, 36], [48, 45], [29, 36]]);
    strokeLine(context, [[36, 42], [36, 50], [48, 55], [60, 50], [60, 42]]);
  } else if (key === 'health') {
    context.fillRect(44, 27, 8, 27);
    context.fillRect(34, 37, 28, 8);
  } else if (key === 'market') {
    context.strokeRect(34, 35, 28, 21);
    context.beginPath(); context.arc(48, 35, 9, Math.PI, 0); context.stroke();
  } else if (key === 'bank' || key === 'government') {
    strokeLine(context, [[30, 35], [48, 26], [66, 35]]);
    strokeLine(context, [[33, 55], [63, 55]]);
    for (const x of [37, 48, 59]) strokeLine(context, [[x, 38], [x, 51]]);
  } else if (key === 'fuel') {
    context.strokeRect(33, 29, 19, 27);
    context.strokeRect(37, 33, 11, 8);
    strokeLine(context, [[52, 34], [59, 34], [62, 39], [62, 52]]);
    context.beginPath(); context.arc(62, 53, 2.5, 0, Math.PI * 2); context.fill();
  } else if (key === 'sport') {
    context.beginPath(); context.arc(48, 40, 17, 0, Math.PI * 2); context.stroke();
    strokeLine(context, [[33, 40], [63, 40]]);
    strokeLine(context, [[48, 24], [48, 56]]);
  } else if (key === 'service') {
    strokeLine(context, [[34, 27], [61, 54]]);
    strokeLine(context, [[61, 27], [34, 54]]);
    context.beginPath(); context.arc(34, 27, 4, 0, Math.PI * 2); context.stroke();
    context.beginPath(); context.arc(61, 54, 4, 0, Math.PI * 2); context.stroke();
  } else if (key === 'transport') {
    context.strokeRect(32, 29, 32, 23);
    strokeLine(context, [[36, 36], [60, 36]]);
    context.beginPath(); context.arc(39, 54, 3, 0, Math.PI * 2); context.fill();
    context.beginPath(); context.arc(57, 54, 3, 0, Math.PI * 2); context.fill();
  } else {
    context.beginPath(); context.arc(48, 40, 8, 0, Math.PI * 2); context.stroke();
    context.beginPath(); context.arc(48, 40, 2.5, 0, Math.PI * 2); context.fill();
  }

  context.restore();
}

function createPlaceMarkerImage({ key, color }) {
  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');

  context.clearRect(0, 0, size, size);
  context.save();
  context.shadowColor = 'rgba(12, 43, 36, .28)';
  context.shadowBlur = 10;
  context.shadowOffsetY = 5;
  context.beginPath();
  context.moveTo(48, 89);
  context.bezierCurveTo(42, 78, 19, 59, 19, 39);
  context.bezierCurveTo(19, 22, 32, 9, 48, 9);
  context.bezierCurveTo(64, 9, 77, 22, 77, 39);
  context.bezierCurveTo(77, 59, 54, 78, 48, 89);
  context.closePath();
  context.fillStyle = color;
  context.fill();
  context.restore();

  context.beginPath();
  context.moveTo(48, 89);
  context.bezierCurveTo(42, 78, 19, 59, 19, 39);
  context.bezierCurveTo(19, 22, 32, 9, 48, 9);
  context.bezierCurveTo(64, 9, 77, 22, 77, 39);
  context.bezierCurveTo(77, 59, 54, 78, 48, 89);
  context.closePath();
  context.lineWidth = 5;
  context.strokeStyle = '#ffffff';
  context.stroke();

  context.beginPath();
  context.arc(48, 40, 22, 0, Math.PI * 2);
  context.fillStyle = 'rgba(255,255,255,.10)';
  context.fill();

  drawMarkerGlyph(context, key);
  return context.getImageData(0, 0, size, size);
}

function ensurePlaceMarkerImages(map) {`;

view = replaceRegex(view, markerBlockPattern, markerBlock, 'MapView marker renderer');
view = replaceOnce(
  view,
  `          12.5, 0.68,\n          14, 0.78,\n          17, 0.94`,
  `          12.5, 0.62,\n          14, 0.72,\n          17, 0.88`,
  'MapView marker sizes'
);
fs.writeFileSync(viewPath, view);

const cssPath = 'frontend/src/map-workspace.css';
let css = fs.readFileSync(cssPath, 'utf8');
css = replaceOnce(
  css,
  `  grid-template-columns:46px minmax(0,1fr) auto;\n  align-items:center;\n  gap:10px;\n  padding:9px;`,
  `  grid-template-columns:64px minmax(0,1fr) auto;\n  align-items:center;\n  gap:11px;\n  min-height:80px;\n  padding:9px;`,
  'sidebar place row dimensions'
);
css = replaceOnce(
  css,
  `.hm-place-thumb{\n  width:46px;\n  height:46px;\n  display:grid;\n  place-items:center;\n  overflow:hidden;\n  border-radius:11px;\n  color:#416b60;\n  background:#e6efea;\n}\n.hm-place-thumb img{width:100%;height:100%;object-fit:cover}`,
  `.hm-place-thumb{\n  position:relative;\n  width:64px;\n  height:64px;\n  display:grid;\n  place-items:center;\n  overflow:hidden;\n  border:1px solid rgba(16,47,41,.07);\n  border-radius:15px;\n  color:#416b60;\n  background:#e6efea;\n  box-shadow:0 5px 14px rgba(20,55,47,.06);\n  transition:transform .16s ease,box-shadow .16s ease;\n}\n.hm-place-row:hover .hm-place-thumb,.hm-place-row.active .hm-place-thumb{\n  transform:translateY(-1px);\n  box-shadow:0 8px 20px rgba(20,55,47,.1);\n}\n.hm-place-thumb img{width:100%;height:100%;object-fit:cover}\n.hm-place-thumb.has-image{background:#e8efeb}\n.hm-place-thumb.has-image .hm-place-fallback-icon{display:none}\n.hm-place-thumb.has-image.image-error img{display:none}\n.hm-place-thumb.has-image.image-error .hm-place-fallback-icon{display:grid}\n.hm-place-fallback-icon{width:100%;height:100%;place-items:center}\n.hm-place-thumb.icon-fallback,.hm-place-thumb.image-error{border-color:rgba(16,47,41,.06)}\n.hm-place-thumb.cafe{color:#9a5b19;background:linear-gradient(145deg,#fff8e9,#ffedd2)}\n.hm-place-thumb.food{color:#df552f;background:linear-gradient(145deg,#fff3ed,#ffe1d6)}\n.hm-place-thumb.stay{color:#7151bd;background:linear-gradient(145deg,#f6f1ff,#e9dcff)}\n.hm-place-thumb.tourism{color:#1684b8;background:linear-gradient(145deg,#eef9ff,#dcedf8)}\n.hm-place-thumb.checkin{color:#cb477c;background:linear-gradient(145deg,#fff0f7,#f8dce9)}\n.hm-place-thumb.experience{color:#6c47c2;background:linear-gradient(145deg,#f7f1ff,#e5d7ff)}\n.hm-place-thumb.school{color:#2d6bc7;background:linear-gradient(145deg,#eef5ff,#dbe8fb)}\n.hm-place-thumb.health{color:#cc4444;background:linear-gradient(145deg,#fff2f2,#f9dddd)}\n.hm-place-thumb.market{color:#26895b;background:linear-gradient(145deg,#effaf4,#dcefe5)}\n.hm-place-thumb.bank{color:#2775a5;background:linear-gradient(145deg,#eef8fd,#d9eaf4)}\n.hm-place-thumb.fuel{color:#1d7d73;background:linear-gradient(145deg,#eff9f7,#d9eee9)}\n.hm-place-thumb.government{color:#566575;background:linear-gradient(145deg,#f5f7f8,#e4e8eb)}\n.hm-place-thumb.sport{color:#278562;background:linear-gradient(145deg,#eff9f4,#d9eee5)}\n.hm-place-thumb.service{color:#606b7a;background:linear-gradient(145deg,#f6f7f9,#e4e7eb)}\n.hm-place-thumb.transport{color:#168886;background:linear-gradient(145deg,#edfafa,#d8efee)}\n.hm-place-thumb.property{color:#865039;background:linear-gradient(145deg,#fbf4ef,#ecdfd7)}\n.hm-place-thumb.default{color:#416b60;background:linear-gradient(145deg,#f1f6f3,#e2ede8)}`,
  'sidebar place thumbnail styling'
);

if (!css.includes('/* Category icon fallback v2 */')) {
  css += `\n\n/* Category icon fallback v2 */\n@media(max-width:760px){\n  .hm-place-row{grid-template-columns:56px minmax(0,1fr) auto;min-height:72px;gap:9px}\n  .hm-place-thumb{width:56px;height:56px;border-radius:14px}\n}\n`;
}
fs.writeFileSync(cssPath, css);

console.log('Map category icon v2 patch applied successfully.');
