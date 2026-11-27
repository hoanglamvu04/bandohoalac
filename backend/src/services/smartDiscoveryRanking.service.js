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

export function oneEditApart(a,b) {
  if(a.length<4||b.length<4||Math.abs(a.length-b.length)>1||a===b)return false;
  if(a.length===b.length){
    const diffs=[];for(let i=0;i<a.length;i++)if(a[i]!==b[i])diffs.push(i);
    return diffs.length===1||(diffs.length===2&&diffs[1]===diffs[0]+1&&a[diffs[0]]===b[diffs[1]]&&a[diffs[1]]===b[diffs[0]]);
  }
  const [short,long]=a.length<b.length?[a,b]:[b,a];
  let i=0;while(i<short.length&&short[i]===long[i])i++;
  return short.slice(i)===long.slice(i+1);
}
function lexicalMatch(text, query) {
  if (!text || !query) return 0;
  if (text === query) return 140;
  if (text.startsWith(query + ' ')) return 110;
  if (text.includes(query)) return 85;

  const terms = [...new Set(query.split(' ').filter((v) => v.length > 1))];
  if (!terms.length) return 0;
  const words=text.split(' ').filter(w=>w.length>1).slice(0,64);
  const match=terms.reduce((score,term)=>score+(text.includes(term)?1:words.some(word=>oneEditApart(term,word))?0.65:0),0);
  return 70*(match/terms.length);
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
