import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../database/pool.js';
import { queryPublicLaunchEvidence } from '../services/launchEvidence.service.js';

// Use the exact same uncached, read-only aggregate and blocker policy as the
// admin launch panel. Preserve the original report's fields for operators.
export async function buildPublicLaunchAudit(db = pool) {
  const evidence = await queryPublicLaunchEvidence(db);
  const c = evidence.counts;
  return {
    checkedAt: evidence.checkedAt,
    mode: 'READ_ONLY',
    launchStatus: evidence.launchStatus,
    dataGate: evidence.dataGate,
    published: {
      published_total: c.publishedPlaces,
      missing_address: c.missingAddress,
      missing_description: c.missingDescription,
      missing_contact: c.missingContact,
      missing_images: c.publishedWithoutImages,
      stale_verification: c.staleVerification
    },
    realEstate: {
      published_properties: c.publishedProperties,
      should_be_archived: c.stalePublishedHousing,
      property_missing_description: c.propertyMissingDescription,
      property_missing_images: c.propertyMissingImages,
      property_missing_contact: c.missingHousingContact,
      legacy_unstructured_housing: c.legacyUnstructuredHousing,
      invalid_price_area: c.invalidHousingPriceArea,
      active_housing: c.activeHousing
    },
    releaseBlocking: {
      publishedExpiredProperties: c.stalePublishedHousing,
      propertyMissingContact: c.missingHousingContact,
      legacyUnstructuredHousing: c.legacyUnstructuredHousing,
      invalidHousingPriceArea: c.invalidHousingPriceArea,
      noPublicPlaces: c.publishedPlaces === 0 ? 1 : 0
    },
    blockers: evidence.blockers,
    manualGates: evidence.manualGates,
    note: 'Data checks only; image rights, live media delivery, offsite backups, restore and real-device acceptance remain unverified.'
  };
}

export function publicLaunchAuditExitCode(report) {
  return report?.dataGate === 'NO_BLOCKERS_DETECTED' &&
    Array.isArray(report.blockers) && report.blockers.length === 0 ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildPublicLaunchAudit()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      process.exitCode = publicLaunchAuditExitCode(report);
      if (process.exitCode !== 0) {
        console.error('[launch-audit] Public data requires moderation before launch.');
      }
    })
    .catch(() => {
      // Do not print connection configuration, stored content or raw DB errors.
      console.error('[launch-audit] Unable to verify public data. Check database access and migrations.');
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
