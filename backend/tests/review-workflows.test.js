import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pool} from '../src/database/pool.js';
import {advertiserReviewSchema,eventProposalSchema,eventReviewSchema} from '../src/validators/reviewWorkflows.validators.js';
import {publicAdvertiserStatus,requestAdvertiserReview,reviewAdvertiser,submitCommunityEvent,reviewCommunityEvent,validateEventWindow} from '../src/services/reviewWorkflows.service.js';
import {listMapFeatures} from '../src/services/mapLayers.service.js';
test('review commands require attestations; event rejects private URL and long windows',()=>{
 assert.equal(advertiserReviewSchema.safeParse({action:'APPROVE'}).success,false);
 assert.equal(advertiserReviewSchema.safeParse({action:'APPROVE',checkedIdentity:true,checkedRole:true}).success,true);
 assert.equal(eventReviewSchema.safeParse({action:'APPROVE'}).success,false);
 const start=new Date(Date.now()+86400000).toISOString(),end=new Date(Date.now()+2*86400000).toISOString();
 const input={title:'Public event',description:'A public event to review',sourceUrl:'https://example.org/events/1',startsAt:start,endsAt:end};
 assert.equal(eventProposalSchema.safeParse(input).success,true);
 assert.equal(eventProposalSchema.safeParse({...input,sourceUrl:'https://example.org/?token=secret'}).success,false);
 assert.equal(eventProposalSchema.safeParse({...input,status:'APPROVED'}).success,false);
 assert.throws(()=>validateEventWindow(start,new Date(Date.now()+9*86400000).toISOString()),e=>e.statusCode===400);
});
test('PG review workflows: owner-only requests, no self-approval, role revocation, approved event lifecycle',async t=>{
 if(process.env.NODE_ENV!=='test'||!process.env.DATABASE_URL){t.skip('requires isolated DB');return;}
 const nonce=randomUUID(),users=[],places=[];let feature;
 try{
  for(const role of ['USER','USER','ADMIN']){
   const {rows:[u]}=await pool.query("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,'test-only',$3) RETURNING id",['Review QA',randomUUID()+'@example.invalid',role]);users.push(u.id);
  }
  const [owner,stranger,admin]=users;
  for(const cat of ['bat-dong-san','cafe']){
   const {rows:[p]}=await pool.query("INSERT INTO places(name,slug,category_id,location,status,source,created_by) VALUES('Review QA',$1,(SELECT id FROM categories WHERE slug=$2),ST_SetSRID(ST_MakePoint(105.52522,21.01354),4326),'PUBLISHED','USER',$3) RETURNING id",[nonce+'-'+cat,cat,owner]);places.push(p.id);
  }
  const [housing,venue]=places;
  await pool.query("INSERT INTO housing_listings(place_id,listing_type,property_type,monthly_rent,listing_status,expires_at,advertiser_role) VALUES($1,'RENT','HOUSE',2000000,'ACTIVE',NOW()+INTERVAL '30 days','OWNER')",[housing]);
  await assert.rejects(requestAdvertiserReview(housing,stranger),e=>e.statusCode===403);
  const q=await requestAdvertiserReview(housing,owner);assert.equal(q.status,'PENDING');assert.equal((await publicAdvertiserStatus(housing)).reviewed,false);
  const approval={action:'APPROVE',checkedIdentity:true,checkedRole:true};
  await assert.rejects(reviewAdvertiser(q.id,{id:owner,role:'USER'},approval),e=>e.statusCode===403);
  await assert.rejects(reviewAdvertiser(q.id,{id:owner,role:'ADMIN'},approval),e=>e.statusCode===403);
  await reviewAdvertiser(q.id,{id:admin,role:'ADMIN'},approval);const result=await publicAdvertiserStatus(housing);assert.equal(result.reviewed,true);assert.deepEqual(Object.keys(result).sort(),['reviewed','role','validUntil']);
  await pool.query("UPDATE housing_listings SET advertiser_role='BROKER' WHERE place_id=$1",[housing]);assert.equal((await publicAdvertiserStatus(housing)).reviewed,false);
  await reviewAdvertiser(q.id,{id:admin,role:'ADMIN'},{action:'REVOKE'});
  const event=await submitCommunityEvent(venue,owner,{title:'Review QA '+nonce.slice(0,8),description:'A test event for review',sourceUrl:'https://example.org/event/1',startsAt:new Date(Date.now()+86400000).toISOString(),endsAt:new Date(Date.now()+2*86400000).toISOString()});
  assert.equal(event.featureId,null);assert.equal(event.status,'PENDING');
  await assert.rejects(reviewCommunityEvent(event.id,{id:owner,role:'MODERATOR'},{action:'APPROVE',checkedSource:true}),e=>e.statusCode===403);
  const published=await reviewCommunityEvent(event.id,{id:admin,role:'ADMIN'},{action:'APPROVE',checkedSource:true});feature=published.featureId;assert.ok(feature);
  const bounds={types:['EVENT'],west:105.52,east:105.53,south:21.01,north:21.02};
  assert.ok((await listMapFeatures(bounds)).features.some(x=>String(x.id)===feature));
  await pool.query("UPDATE places SET status='ARCHIVED' WHERE id=$1",[venue]);assert.ok(!(await listMapFeatures(bounds)).features.some(x=>String(x.id)===feature));
  await reviewCommunityEvent(event.id,{id:admin,role:'ADMIN'},{action:'REVOKE'});assert.equal((await pool.query('SELECT status FROM map_features WHERE id=$1',[feature])).rows[0].status,'ARCHIVED');
 }finally{
  if(feature)await pool.query('DELETE FROM map_features WHERE id=$1',[feature]);
  for(const place of places)await pool.query('DELETE FROM places WHERE id=$1',[place]);
  for(const user of users)await pool.query('DELETE FROM users WHERE id=$1',[user]);
 }
});
