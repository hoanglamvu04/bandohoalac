// Smart Discovery V3: deterministic organic relevance. Never paid placement.
// Ranks only already-public, already-filtered POIs/map features returned by
// existing services; it does not widen visibility or bypass moderation.
function normalizeText(input) {
  return String(input ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function lexicalMatch(text, query) {
  if (!text || !query) return 0;
  if (text === query) return 140;
  if (text.startsWith(query + ' ')) return 110;
  if (text.includes(query)) return 85;

  const terms = [...new Set(query.split(' ').filter((v) => v.length > 1))];
  if (!terms.length) return 0;
  const matched = terms.filter((term) => text.includes(term));
  return 70 * (matched.length / terms.length);
}

export function discoveryScore(item, {
  query = '',
  category = null,
  nearAnchor = false,
  now = Date.now()
} = {}) {
  const q = normalizeText(query);
  const name = normalizeText(item?.name);
  const categoryText = normalizeText(item?.category);
  const address = normalizeText(item?.address);
  let score = Math.max(lexicalMatch(name, q), lexicalMatch(address, q) * 0.35,
    lexicalMatch(categoryText, q) * 0.45);

  if (category && item?.categorySlug === category) score += 30;
  // Verified/reviewed listings have an organic quality advantage, but a
  // missing photo or a new location is never automatically excluded.
  const reviews = Math.max(0, Math.min(Number(item?.reviews) || 0, 100));
  const rating = Math.max(0, Math.min(Number(item?.rating) || 0, 5));
  score += (rating * (reviews / (reviews + 8))) * 3;
  if ((item?.images?.length || item?.cardImages?.length || 0) > 0) score += 3;
  const verifiedAt = item?.lastVerifiedAt ? new Date(item.lastVerifiedAt).getTime() : NaN;
  if (Number.isFinite(verifiedAt)) {
    const ageDays = Math.max(0, (now - verifiedAt) / 86400000);
    if (ageDays <= 30) score += 12;
    else if (ageDays <= 180) score += 7;
    else if (ageDays <= 365) score += 3;
  }
  if (nearAnchor && Number.isFinite(Number(item?.distance))) {
    const distance = Math.max(0, Number(item.distance));
    score += 60 / (1 + distance / 1500);
  }
  return Math.round(score * 100) / 100;
}

export function rankDiscoveryItems(items, opts = {}) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => ({ item, index, score: discoveryScore(item, opts) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item);
}
