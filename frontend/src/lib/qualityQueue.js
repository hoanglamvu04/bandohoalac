import { csvCell } from './localSeoAudit.js';

const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').trim();

export function filterQualityQueue(items, { issue = 'ALL', priority = 'ALL', query = '', category = 'ALL' } = {}) {
  const needle = normalize(query);
  return (Array.isArray(items) ? items : []).filter(item =>
    (issue === 'ALL' || item.issues?.includes(issue)) &&
    (priority === 'ALL' || item.triagePriority === priority) &&
    (category === 'ALL' || item.categorySlug === category) &&
    (!needle || normalize([item.id, item.name, item.category, item.address].join(' ')).includes(needle))
  );
}

export function qualityQueueCsv(items) {
  const rows = [['ID', 'Name', 'Category', 'Quality score', 'Priority', 'Issues']];
  for (const item of items) rows.push([item.id, item.name, item.categorySlug, item.qualityScore, item.triagePriority, (item.issues || []).join('; ')]);
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}
