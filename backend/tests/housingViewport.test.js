import test from 'node:test';
import assert from 'node:assert/strict';
import { housingListQuerySchema } from '../src/validators/housing.validators.js';
import { listHousingListings } from '../src/services/housing.service.js';

test('housing bounds validation refuses partial/reversed/oversized rectangles', () => {
  const valid = housingListQuerySchema.safeParse({
    west:'105.51',east:'105.55',south:'21.00',north:'21.05',
    listingType:'SALE',limit:'20'
  });
  assert.equal(valid.success,true);
  for(const invalid of [
    { north:'21.05' },
    { west:'105.5',east:'105.6',north:'21.05' },
    { west:'105.6',east:'105.5',south:'21',north:'21.05' },
    { west:'105.5',east:'105.6',south:'21.05',north:'21' },
    { west:'105',east:'106',south:'21',north:'21.05' },
    { west:'105.5',east:'105.6',south:'21',north:'22' }
  ]) {
    assert.equal(housingListQuerySchema.safeParse(invalid).success,false,
      JSON.stringify(invalid));
  }
});

test('housing viewport SQL filters published data spatially BEFORE pagination', async () => {
  let executed = 0;
  const client = {
    async query(sql,params) {
      executed++;
      assert.match(sql,/p.status = 'PUBLISHED'/);
      assert.match(sql,/hl.expires_at/);
      assert.match(sql,/ST_Intersects\(p.location, ST_MakeEnvelope\(\$1,\$2,\$3,\$4,4326\)\)/);
      assert.ok(sql.indexOf('ST_Intersects') < sql.lastIndexOf('ORDER BY'));
      assert.deepEqual(params.slice(0,4),[105.5,21,105.6,21.1]);
      return { rows: [] };
    }
  };
  const result = await listHousingListings(
    { west:105.5,south:21,east:105.6,north:21.1,limit:20,offset:0 }, client);
  assert.equal(result.items.length,0);
  assert.equal(executed,1);
});
