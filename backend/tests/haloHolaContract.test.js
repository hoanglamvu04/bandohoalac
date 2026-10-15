import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

process.env.HOLA_MAPS_HALO_SECRET ||= 'ci-halo-shared-secret';

let server;
let baseUrl;
let pool;
let canonicalPlace;

const secretHeaders = {
  'content-type': 'application/json',
  'x-halo-hola-key': process.env.HOLA_MAPS_HALO_SECRET
};

async function json(response) {
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

before(async () => {
  const [{ createApp }, poolModule] = await Promise.all([
    import('../src/app.js'),
    import('../src/database/pool.js')
  ]);
  pool = poolModule.pool;

  const { rows } = await pool.query(`
    SELECT id, name, address, ST_Y(location) AS lat, ST_X(location) AS lng
    FROM places
    WHERE status = 'PUBLISHED'
    ORDER BY id
    LIMIT 1
  `);
  canonicalPlace = rows[0];
  assert.ok(canonicalPlace, 'seed must provide at least one published place');

  server = http.createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (pool) await pool.end();
});

test('HALO HOLA contract: auth, canonical place upsert, provenance and stable media URL', async () => {
  const postId = 'halo-contract-place-' + Date.now();
  const mediaId = 'media-contract-' + Date.now();
  const payload = {
    postId,
    user: { id: 'author-hash-1', name: 'Tác giả CI' },
    caption: 'Bản đầu tiên',
    sourceUrl: 'https://halohola.vn/tac-pham/hh26-contract-place',
    postedAt: new Date().toISOString(),
    location: {
      placeId: String(canonicalPlace.id),
      lat: Number(canonicalPlace.lat),
      lng: Number(canonicalPlace.lng),
      label: canonicalPlace.name,
      address: canonicalPlace.address
    },
    media: [{
      id: mediaId,
      // Deliberately signed/temporary-looking input. Maps must not persist it.
      url: 'https://signed-r2.example.test/object?X-Amz-Signature=temporary',
      thumbnailUrl: 'https://signed-r2.example.test/thumb?token=temporary'
    }],
    metadata: {
      source: 'HALO_HOLA',
      code: 'HH26-CONTRACT-PLACE',
      title: 'Tác phẩm kiểm thử',
      type: 'Photo',
      theme: 'Hòa Lạc',
      locationSource: 'HOLA_MAPS',
      publicationState: 'PUBLISHED'
    }
  };

  const denied = await fetch(baseUrl + '/api/halo/v1/posts', {
    method: 'POST',
    headers: { ...secretHeaders, 'x-halo-hola-key': 'wrong-secret' },
    body: JSON.stringify(payload)
  });
  assert.equal(denied.status, 401);

  const createdResponse = await fetch(baseUrl + '/api/halo/v1/posts', {
    method: 'POST',
    headers: secretHeaders,
    body: JSON.stringify(payload)
  });
  assert.equal(createdResponse.status, 200);
  const created = await json(createdResponse);
  assert.equal(created.ok, true);
  assert.equal(created.postId, postId);
  assert.equal(created.action, 'created');
  assert.equal(created.source, 'HALO_HOLA');
  assert.equal(created.spot.placeId, String(canonicalPlace.id));

  const updatedResponse = await fetch(baseUrl + '/api/halo/v1/posts', {
    method: 'POST',
    headers: secretHeaders,
    body: JSON.stringify({ ...payload, caption: 'Bản đã cập nhật' })
  });
  assert.equal(updatedResponse.status, 200);
  const updated = await json(updatedResponse);
  assert.equal(updated.action, 'updated');
  assert.equal(updated.internalPostId, created.internalPostId);

  const { rows: dbRows } = await pool.query(
    `SELECT hp.id, hp.source, hp.caption, hp.source_url, hp.metadata,
            hs.place_id, hm.url, hm.thumbnail_url
     FROM halo_posts hp
     JOIN halo_spots hs ON hs.id = hp.spot_id
     JOIN halo_media hm ON hm.post_id = hp.id
     WHERE hp.external_post_id = $1`,
    [postId]
  );
  assert.equal(dbRows.length, 1, 'same postId must never duplicate');
  assert.equal(dbRows[0].source, 'HALO_HOLA');
  assert.equal(dbRows[0].caption, 'Bản đã cập nhật');
  assert.equal(String(dbRows[0].place_id), String(canonicalPlace.id));
  assert.equal(dbRows[0].metadata.code, 'HH26-CONTRACT-PLACE');
  const stableMediaUrl = `https://halohola.vn/api/submissions/media/${encodeURIComponent(mediaId)}/halo`;
  assert.equal(dbRows[0].url, stableMediaUrl);
  assert.equal(dbRows[0].thumbnail_url, stableMediaUrl);

  const placeMediaResponse = await fetch(
    baseUrl + '/api/halo/v1/places/' + encodeURIComponent(canonicalPlace.id)
  );
  assert.equal(placeMediaResponse.status, 200);
  const placeMedia = await json(placeMediaResponse);
  assert.equal(placeMedia.item.source, 'HALO_HOLA');
  assert.equal(placeMedia.item.media[0].postId, postId);
  assert.equal(placeMedia.item.media[0].code, 'HH26-CONTRACT-PLACE');
  assert.equal(placeMedia.item.media[0].url, stableMediaUrl);

  const spotsResponse = await fetch(baseUrl + '/api/halo/v1/spots');
  const spots = await json(spotsResponse);
  const feature = spots.features.find((item) => item.properties.placeId === String(canonicalPlace.id));
  assert.ok(feature, 'published HALO post must appear on public map/feed');
  assert.equal(feature.properties.source, 'HALO_HOLA');
  assert.equal(feature.properties.sourceLabel, 'HALO HOLA');

  const deletedResponse = await fetch(
    baseUrl + '/api/halo/v1/posts/' + encodeURIComponent(postId),
    { method: 'DELETE', headers: { 'x-halo-hola-key': process.env.HOLA_MAPS_HALO_SECRET } }
  );
  assert.equal(deletedResponse.status, 200);
  const deleted = await json(deletedResponse);
  assert.equal(deleted.ok, true);
  assert.equal(deleted.deleted, true);

  const afterDeleteSpots = await json(await fetch(baseUrl + '/api/halo/v1/spots'));
  assert.equal(
    afterDeleteSpots.features.some((item) => item.properties.placeId === String(canonicalPlace.id)),
    false,
    'deleted HALO post must disappear from public map/feed'
  );

  const missingDelete = await fetch(
    baseUrl + '/api/halo/v1/posts/' + encodeURIComponent(postId + '-missing'),
    { method: 'DELETE', headers: { 'x-halo-hola-key': process.env.HOLA_MAPS_HALO_SECRET } }
  );
  assert.equal(missingDelete.status, 200);
  assert.deepEqual(await json(missingDelete), {
    ok: true,
    postId: postId + '-missing',
    deleted: false
  });
});

test('HALO HOLA contract: spotId pin is upserted and hidden after final delete', async () => {
  const stamp = Date.now();
  const postId = 'halo-contract-pin-' + stamp;
  const spotId = 'halo-submission:' + stamp;
  const mediaId = 'media-pin-' + stamp;
  const payload = {
    postId,
    user: { id: 'author-hash-2', name: 'Tác giả Pin' },
    caption: 'Pin riêng',
    sourceUrl: 'https://halohola.vn/tac-pham/hh26-contract-pin',
    postedAt: new Date().toISOString(),
    location: {
      spotId,
      lat: Number(canonicalPlace.lat),
      lng: Number(canonicalPlace.lng),
      label: 'Pin HALO CI',
      address: 'Hòa Lạc'
    },
    media: [{
      id: mediaId,
      url: `https://halohola.vn/api/submissions/media/${mediaId}/halo`,
      thumbnailUrl: `https://halohola.vn/api/submissions/media/${mediaId}/halo`
    }],
    metadata: {
      source: 'HALO_HOLA',
      code: 'HH26-CONTRACT-PIN',
      locationSource: 'PIN',
      publicationState: 'PUBLISHED'
    }
  };

  const first = await json(await fetch(baseUrl + '/api/halo/v1/posts', {
    method: 'POST', headers: secretHeaders, body: JSON.stringify(payload)
  }));
  assert.equal(first.action, 'created');
  assert.equal(first.spot.externalSpotId, spotId);
  assert.equal(first.spot.placeId, null);

  const second = await json(await fetch(baseUrl + '/api/halo/v1/posts', {
    method: 'POST',
    headers: secretHeaders,
    body: JSON.stringify({
      ...payload,
      location: { ...payload.location, label: 'Pin HALO CI đã cập nhật' }
    })
  }));
  assert.equal(second.action, 'updated');
  assert.equal(second.spot.id, first.spot.id, 'same spotId must reuse the same map spot');
  assert.equal(second.spot.label, 'Pin HALO CI đã cập nhật');

  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM halo_spots
     WHERE external_spot_id = $1`,
    [spotId]
  );
  assert.equal(rows[0].count, 1);

  const deleteResponse = await fetch(
    baseUrl + '/api/halo/v1/posts/' + encodeURIComponent(postId),
    { method: 'DELETE', headers: { 'x-halo-hola-key': process.env.HOLA_MAPS_HALO_SECRET } }
  );
  assert.equal(deleteResponse.status, 200);

  const { rows: spotRows } = await pool.query(
    `SELECT status FROM halo_spots WHERE external_spot_id = $1`,
    [spotId]
  );
  assert.equal(spotRows[0].status, 'HIDDEN');

  const hiddenSpotResponse = await fetch(
    baseUrl + '/api/halo/v1/spots/' + encodeURIComponent(first.spot.id)
  );
  assert.equal(hiddenSpotResponse.status, 404);
});
