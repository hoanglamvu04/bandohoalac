import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../src/database/pool.js';
import { encodeOwnerListingCursor, decodeOwnerListingCursor, ownerListingPageLimit } from '../src/lib/ownerListingCursor.js';
import { ownerListingPageQuerySchema } from '../src/validators/housing.validators.js';
import { listMyPropertyListingsPage, listMyPropertyListings } from '../src/services/housingLifecycle.service.js';

const time='2026-11-27T10:01:02.123456Z';
test('cursor preserves bigint IDs and PostgreSQL microseconds; malformed inputs are rejected',()=>{
 const id='9223372036854775807',c=encodeOwnerListingCursor(time,id);
 assert.deepEqual(decodeOwnerListingCursor(c),{createdAt:time,id});
 for(const bad of ['','x'.repeat(161),'abc+','e30',Buffer.from(JSON.stringify({v:1,t:time,id:'9223372036854775808'})).toString('base64url'),
   Buffer.from(JSON.stringify({v:1,t:'2026-02-30T10:01:02.123456Z',id:'1'})).toString('base64url')]){
  assert.throws(()=>decodeOwnerListingCursor(bad),e=>e.statusCode===400);
 }
 for(const bad of [0,101,'1.5','-1',[],null])assert.throws(()=>ownerListingPageLimit(bad),e=>e.statusCode===400);
 assert.equal(ownerListingPageLimit('100'),100);
 assert.equal(ownerListingPageQuerySchema.safeParse({limit:['1','2']}).success,false);
 assert.equal(ownerListingPageQuerySchema.safeParse({limit:'0'}).success,false);
});
test('page binds cursor values and owner, uses one-row lookahead, excludes boundary from public payload',async()=>{
 const cursor=encodeOwnerListingCursor(time,'123456789123456789');
 const page=await listMyPropertyListingsPage('7',{limit:'1',cursor},{query:async(sql,args)=>{
  assert.match(sql,/WHERE p\.created_by = \$1/);
  assert.match(sql,/\(p\.created_at,p\.id\) < \(\$2::timestamptz,\$3::bigint\)/);
  assert.match(sql,/LIMIT \$4$/);
  assert.deepEqual(args,['7',time,'123456789123456789',2]);
  return {rows:[{id:'12',cursor_created_at:time},{id:'11',cursor_created_at:time}]};
 }});
 assert.equal(page.items.length,1);assert.equal(page.items[0].id,'12');
 assert.equal('cursor_created_at' in page.items[0],false);
 assert.deepEqual(decodeOwnerListingCursor(page.nextCursor),{createdAt:time,id:'12'});
});
test('PG keyset pages remain owner-scoped and do not skip equal/microsecond timestamps',async t=>{
 if(process.env.NODE_ENV!=='test'||!process.env.DATABASE_URL){t.skip('requires isolated migrated DB');return;}
 const users=[],places=[];
 async function createUser(){
  const {rows:[u]}=await pool.query("INSERT INTO users(name,email,password_hash,role) VALUES('Cursor QA',$1,'test-only','USER') RETURNING id",[randomUUID()+'@example.invalid']);
  users.push(u.id);return u.id;
 }
 async function createListing(owner,stamp){
  const {rows:[p]}=await pool.query("INSERT INTO places(name,slug,category_id,location,status,source,created_by,created_at) VALUES('Cursor QA',$1,(SELECT id FROM categories WHERE slug='bat-dong-san'),ST_SetSRID(ST_MakePoint(105.52522,21.01354),4326),'PUBLISHED','USER',$2,$3::timestamptz) RETURNING id",[randomUUID(),owner,stamp]);
  places.push(p.id);
  await pool.query("INSERT INTO housing_listings(place_id,listing_type,property_type,monthly_rent,listing_status,expires_at) VALUES($1,'RENT','HOUSE',2000000,'ACTIVE',NOW()+INTERVAL '30 days')",[p.id]);return String(p.id);
 }
 try{
  const owner=await createUser(),other=await createUser();
  const a=await createListing(owner,'2026-11-27T10:01:02.123455Z');
  const b=await createListing(owner,time);
  const c=await createListing(owner,time);
  const d=await createListing(owner,'2026-11-27T10:01:02.123457Z');
  const foreign=await createListing(other,'2026-11-27T10:01:02.123458Z');
  const page1=await listMyPropertyListingsPage(owner,{limit:'2'});
  assert.deepEqual(page1.items.map(x=>x.id),[d,c]);assert.ok(page1.nextCursor);
  const fresh=await createListing(owner,'2026-11-27T10:01:02.123459Z');
  const page2=await listMyPropertyListingsPage(owner,{limit:'2',cursor:page1.nextCursor});
  assert.deepEqual(page2.items.map(x=>x.id),[b,a]);assert.equal(page2.nextCursor,null);
  assert.ok(![...page1.items,...page2.items].some(x=>x.id===foreign||x.id===fresh));
  const legacy=await listMyPropertyListings(owner);
  assert.deepEqual(legacy.map(x=>x.id),[fresh,d,c,b,a]);
  const cross=await listMyPropertyListingsPage(other,{limit:100,cursor:page1.nextCursor});
  assert.ok(cross.items.every(x=>x.id===foreign));
 }finally{
  for(const id of places)await pool.query('DELETE FROM places WHERE id=$1',[id]);
  for(const id of users)await pool.query('DELETE FROM users WHERE id=$1',[id]);
 }
});
