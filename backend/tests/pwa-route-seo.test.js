import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isPrivateRoute } from '../../frontend/src/lib/routeIndexPolicy.js';
import { localSeoHousingGateSql } from '../src/services/localSeo.service.js';
test('private route and duplicate map routes are noindex, public landing pages remain eligible',()=>{
 for(const path of ['/tin-bat-dong-san-cua-toi','/security','/collections','/claim-place/12','/local-map/fpt','/admin/operations','/embed/picker'])assert.equal(isPrivateRoute(path),true,path);
 for(const path of ['/doi-tac','/khu-vuc/cafe-hoa-lac','/dia-diem/abc','/kham-pha','/'])assert.equal(isPrivateRoute(path),false,path);
});
test('housing SEO gate excludes sale, expired, demo/external and unavailable inventory',()=>{
 const sql=localSeoHousingGateSql();
 for(const part of ["listing_type = 'RENT'","listing_status = 'ACTIVE'","expires_at > NOW()","available_rooms > 0","external_source IS NULL","demo-thach-that-2026-%"])assert.ok(sql.includes(part),part);
});
test('PWA static offline shell never persists request-specific navigations or API content',async()=>{
 const sw=await readFile(new URL('../../frontend/public/sw.js',import.meta.url),'utf8');
 assert.match(sw,/hola-maps-shell-v6/);
 assert.match(sw,/cache\.match\('\/offline\.html'\)/);
 assert.doesNotMatch(sw,/cache\.put\(|caches\.match\(request\)|caches\.match\('\/'\)/);
 const registration=await readFile(new URL('../../frontend/src/pwa.js',import.meta.url),'utf8');
 assert.doesNotMatch(registration,/location\.reload\(/);
});
