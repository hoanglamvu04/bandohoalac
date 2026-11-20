import { pool } from '../database/pool.js';

async function run() {
  const { rows: [summary] } = await pool.query(`
    SELECT COUNT(*)::int AS published_total,
           COUNT(*) FILTER (WHERE NULLIF(btrim(p.address),'') IS NULL)::int AS missing_address,
           COUNT(*) FILTER (WHERE NULLIF(btrim(p.description),'') IS NULL)::int AS missing_description,
           COUNT(*) FILTER (WHERE NULLIF(btrim(p.phone),'') IS NULL)::int AS missing_contact,
           COUNT(*) FILTER (WHERE NOT EXISTS(
             SELECT 1 FROM place_images pi WHERE pi.place_id=p.id
           ))::int AS missing_images,
           COUNT(*) FILTER (WHERE p.last_verified_at IS NULL
             OR p.last_verified_at < NOW() - INTERVAL '180 days')::int AS stale_verification
      FROM places p
     WHERE p.status='PUBLISHED'`);

  const { rows: [estate] } = await pool.query(`
    SELECT COUNT(*)::int AS published_properties,
           COUNT(*) FILTER (WHERE hl.property_type IS NOT NULL
             AND (hl.listing_status <> 'ACTIVE' OR
                  (hl.expires_at IS NOT NULL AND hl.expires_at <= NOW())))::int
                AS should_be_archived,
           COUNT(*) FILTER (WHERE hl.property_type IS NOT NULL
             AND NULLIF(btrim(p.description),'') IS NULL)::int
                AS property_missing_description,
           COUNT(*) FILTER (WHERE hl.property_type IS NOT NULL
             AND NOT EXISTS(SELECT 1 FROM place_images pi WHERE pi.place_id=p.id))::int
                AS property_missing_images,
           COUNT(*) FILTER (WHERE hl.property_type IS NOT NULL
             AND NULLIF(btrim(p.phone),'') IS NULL)::int
                AS property_missing_contact
      FROM places p JOIN categories c ON c.id=p.category_id
      JOIN housing_listings hl ON hl.place_id=p.id
     WHERE p.status='PUBLISHED' AND c.slug='bat-dong-san'`);

  const report = {
    checkedAt: new Date().toISOString(),
    published: summary,
    realEstate: estate,
    releaseBlocking: {
      publishedExpiredProperties: estate.should_be_archived,
      propertyMissingContact: estate.property_missing_contact
    }
  };
  console.log(JSON.stringify(report, null, 2));

  if (estate.should_be_archived > 0 || estate.property_missing_contact > 0) {
    console.error('[launch-audit] Public property data requires moderation before launch.');
    process.exitCode = 1;
  }
}

run()
  .catch((error) => { console.error('[launch-audit]', error); process.exitCode = 1; })
  .finally(() => pool.end());
