import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { getHousingContactForMember } from '../src/services/housingContact.service.js';
import { listHousingListings } from '../src/services/housing.service.js';
import { getPlaceById } from '../src/services/place.service.js';

test('housing contact reveal checks public, active, unexpired listing and validates ids', async () => {
  let queries = 0;
  const contact = await getHousingContactForMember('4683', {
    async query(sql, params) {
      queries++;
      assert.deepEqual(params, [4683]);
      assert.match(sql, /p.status = 'PUBLISHED'/);
      assert.match(sql, /c.slug = 'bat-dong-san'/);
      assert.match(sql, /hl.listing_status = 'ACTIVE'/);
      assert.match(sql, /hl.expires_at > NOW\(\)/);
      return { rows: [{
        phone:'0912345678',contact_zalo:'0912345678',
        contact_name:'Anh Minh',external_source:null
      }] };
    }
  });
  assert.deepEqual(contact, {
    phone:'0912345678',zalo:'0912345678',
    contactName:'Anh Minh',isDemo:false
  });
  assert.equal(queries, 1);
  await assert.rejects(
    getHousingContactForMember('4683 OR 1=1', { async query() { throw Error('unexpected SQL'); } }),
    (error) => error.statusCode === 400 || error.status === 400
  );
  await assert.rejects(
    getHousingContactForMember(999, { async query() { return { rows:[] }; } }),
    (error) => error.statusCode === 404 || error.status === 404
  );
});

test('demo contact does not reveal placeholder numbers, even after authentication', async () => {
  const response = await getHousingContactForMember(31, {
    async query() {
      return { rows:[{
        phone:'0000000001', contact_zalo:'0000000001',
        contact_name:'HOLA DEMO', external_source:'HOLA_THACH_THAT_DEMO_2026'
      }] };
    }
  });
  assert.deepEqual(response, {
    phone:null, zalo:null, contactName:'HOLA DEMO', isDemo:true
  });
});

test('public housing listing and generic place JSON redact BDS phone and Zalo', async () => {
  const fakeRow = {
    id:4683, name:'Tin mẫu', phone:'0912345678',
    contact_zalo:'0912345678', contact_name:'Người đăng',
    category:'Bất động sản', category_slug:'bat-dong-san',
    housing_place_id:4683, monthly_rent:'2900000',
    total_count:1, lat:21.013, lng:105.525
  };
  const publicHousing = await listHousingListings({ limit:10 }, {
    async query() { return { rows:[fakeRow] }; }
  });
  assert.equal(publicHousing.items.length, 1);
  assert.equal(publicHousing.items[0].phone, null);
  assert.equal(publicHousing.items[0].housing.contactZalo, null);
  assert.equal(publicHousing.items[0].housing.contactName, 'Người đăng');
  assert.equal(JSON.stringify(publicHousing).includes('0912345678'), false);

  const publicPlace = await getPlaceById(4683, {
    async query() { return { rows:[fakeRow] }; }
  });
  assert.equal(publicPlace.phone, null);

  const otherPlace = await getPlaceById(55, {
    async query() {
      return { rows:[{ ...fakeRow, id:55, category_slug:'cafe' }] };
    }
  });
  assert.equal(otherPlace.phone, '0912345678'); // other categories unchanged
});

test('housing contact endpoint rejects anonymous requests before querying contacts', async () => {
  const server = createApp().listen(0);
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    const response = await fetch('http://127.0.0.1:' + address.port + '/api/housing/4683/contact');
    assert.equal(response.status, 401);
    const json = await response.json();
    assert.ok(json.error);
    assert.equal(JSON.stringify(json).includes('0912345678'), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
