import {pool} from '../database/pool.js';

export function hasHousingMetricConsent(req){
  return req.get('X-Hola-Housing-Stats')==='1' && req.get('Sec-GPC')!=='1' && req.get('DNT')!=='1';
}

// Never store identifiers of the visitor; these are approximate event counts,
// not unique people or transactions. The SQL rechecks public eligibility.
export async function recordHousingMetric(placeId,event,db=pool){
  if(!/^[1-9]\d{0,14}$/.test(String(placeId))||!['DETAIL_VIEW','CONTACT_REVEAL'].includes(event))return false;
  const {rowCount}=await db.query(
    `INSERT INTO housing_daily_metrics(place_id,metric_day,detail_views,contact_reveals)
     SELECT p.id,(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
       CASE WHEN $2='DETAIL_VIEW' THEN 1 ELSE 0 END,
       CASE WHEN $2='CONTACT_REVEAL' THEN 1 ELSE 0 END
     FROM places p JOIN categories c ON c.id=p.category_id AND c.slug='bat-dong-san'
       JOIN housing_listings hl ON hl.place_id=p.id
     WHERE p.id=$1 AND p.status='PUBLISHED' AND p.source IN ('USER','CTV')
       AND p.created_by IS NOT NULL AND p.external_source IS NULL AND hl.property_type IS NOT NULL
       AND hl.listing_status='ACTIVE' AND (hl.expires_at IS NULL OR hl.expires_at>NOW())
     ON CONFLICT(place_id,metric_day) DO UPDATE SET
       detail_views=housing_daily_metrics.detail_views+EXCLUDED.detail_views,
       contact_reveals=housing_daily_metrics.contact_reveals+EXCLUDED.contact_reveals`,
    [String(placeId),event]);
  return rowCount===1;
}
export async function pruneHousingEngagement(db=pool){
  const counts=await db.query("DELETE FROM housing_daily_metrics WHERE metric_day < (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date-89");
  const viewings=await db.query("DELETE FROM housing_viewing_requests WHERE starts_at<NOW()-INTERVAL '180 days'");
  return {metricDaysDeleted:counts.rowCount,oldViewingsDeleted:viewings.rowCount};
}
