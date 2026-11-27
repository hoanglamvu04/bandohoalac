import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {databasePoolOptions} from '../src/database/poolConfig.js';
import {withTransaction,pool} from '../src/database/pool.js';
import {migrationFiles,withMigrationLock} from '../src/database/migrationPlan.js';
import {auditDatabase,assertAnalyzeAllowed,summarizePlan} from '../src/services/databaseAudit.service.js';
import {listMyPropertyListings} from '../src/services/housingLifecycle.service.js';

test('pool limits are bounded; optional overrides preserve role settings by default',()=>{
 assert.deepEqual(databasePoolOptions({}),{max:10,connectionTimeoutMillis:10000,idleTimeoutMillis:10000});
 assert.deepEqual(databasePoolOptions({DB_POOL_MAX:'5',DB_STATEMENT_TIMEOUT_MS:'15000',DB_LOCK_TIMEOUT_MS:'1000',DB_IDLE_TRANSACTION_TIMEOUT_MS:'30000'}),{max:5,connectionTimeoutMillis:10000,idleTimeoutMillis:10000,statement_timeout:15000,lock_timeout:1000,idle_in_transaction_session_timeout:30000});
 for(const input of [{DB_POOL_MAX:'0'},{DB_POOL_MAX:'51'},{DB_CONNECT_TIMEOUT_MS:'0'},{DB_STATEMENT_TIMEOUT_MS:'Infinity'},{DB_LOCK_TIMEOUT_MS:'-1'},{DB_POOL_MAX:'2.5'}])assert.throws(()=>databasePoolOptions(input),/Invalid database setting/);
});
function fakeDb(fail){
 const calls=[];let released,releaseCount=0;
 const client={query:async sql=>{calls.push(sql);if(fail?.(sql))throw Error('broken '+sql);return {};},release:e=>{released=e;releaseCount++;}};
 return {db:{connect:async()=>client},calls,released:()=>released,releaseCount:()=>releaseCount};
}
test('transaction commits and releases exactly once',async()=>{
 const x=fakeDb();assert.equal(await withTransaction(async c=>{await c.query('SELECT');return 42;},x.db),42);
 assert.deepEqual(x.calls,['BEGIN','SELECT','COMMIT']);assert.equal(x.releaseCount(),1);assert.equal(x.released(),undefined);
});
test('rollback failure does not mask original error or reuse a broken client',async()=>{
 const original=Error('work failed');const x=fakeDb(sql=>sql==='ROLLBACK');
 await assert.rejects(withTransaction(async()=>{throw original;},x.db),e=>e===original);
 assert.deepEqual(x.calls,['BEGIN','ROLLBACK']);assert.match(x.released().message,/broken ROLLBACK/);assert.equal(x.releaseCount(),1);
});
test('begin and uncertain commit errors discard session, ordinary work error rolls back',async()=>{
 for(const phase of ['BEGIN','COMMIT']){
  const x=fakeDb(sql=>sql===phase);
  await assert.rejects(withTransaction(async()=>true,x.db),new RegExp('broken '+phase));
  assert.ok(x.released() instanceof Error);assert.equal(x.releaseCount(),1);
 }
 const x=fakeDb();await assert.rejects(withTransaction(async()=>{throw Error('business error');},x.db),/business error/);
 assert.deepEqual(x.calls,['BEGIN','ROLLBACK']);assert.equal(x.released(),undefined);
});
test('migration plan is sorted, includes hashes, never seeds by default',()=>{
 const dir=fileURLToPath(new URL('../src/database/',import.meta.url));
 const files=migrationFiles(dir);
 assert.equal(files[0].file,'schema.sql');assert.ok(files.some(x=>x.file.endsWith('_400_core_query_indexes.sql')));
 const names=files.slice(1).map(x=>x.file);assert.deepEqual(names,[...names].sort());assert.equal(names.includes('seed.sql'),false);
 assert.ok(files.every(x=>/^[a-f0-9]{64}$/.test(x.sha256)));
 assert.equal(migrationFiles(dir,{seed:true}).at(-1).file,'seed.sql');
});
test('migration lock prevents concurrent run and releases on work error',async()=>{
 const calls=[];const make=acquired=>({query:async(sql,args)=>{calls.push([sql,args]);return {rows:[sql.includes('try_advisory')?{acquired}:{released:true}]};}});
 let ran=false;await assert.rejects(withMigrationLock(make(false),async()=>{ran=true;}),/Another HOLA migration/);assert.equal(ran,false);
 calls.length=0;const db=make(true);const err=Error('file failed');
 await assert.rejects(withMigrationLock(db,async client=>{assert.equal(client,db);throw err;}),e=>e===err);
 assert.match(calls[0][0],/pg_try_advisory_lock/);assert.equal(calls[1][0],'ROLLBACK');assert.match(calls[2][0],/pg_advisory_unlock/);assert.deepEqual(calls[0][1],calls[2][1]);
});
test('analyze is explicitly guarded and raw plan filters are never returned',()=>{
 const args={analyze:true,nodeEnv:'test',confirmation:'ANALYZE_ISOLATED_STAGING',expectedDatabase:'staging',actualDatabase:'staging'};
 assert.doesNotThrow(()=>assertAnalyzeAllowed(args));
 for(const change of [{nodeEnv:'production'},{confirmation:''},{expectedDatabase:'other'},{expectedDatabase:''}])assert.throws(()=>assertAnalyzeAllowed({...args,...change}),/isolated staging/);
 const plan=summarizePlan({'Node Type':'Index Scan','Filter':'private@example.invalid','Index Name':'idx','Plan Rows':1,Plans:[{'Node Type':'Seq Scan','Index Cond':'private'}]});
 assert.doesNotMatch(JSON.stringify(plan),/private|Filter|Index Cond/);
});
test('database catalog audit runs read-only on isolated PG16 and finds new valid indexes',async t=>{
 if(process.env.NODE_ENV!=='test'||!process.env.DATABASE_URL){t.skip('requires isolated migrated test database');return;}
 const report=await auditDatabase({analyze:false});
 assert.equal(report.mode,'READ_ONLY_ESTIMATES');assert.ok(report.postgisVersion);
 assert.ok(report.constraints.some(x=>x.table_name==='places'&&x.type==='f'));
 for(const name of ['places_location_geography_idx','places_owner_created_id_idx'])assert.ok(report.indexes.some(x=>x.index_name===name&&x.valid&&x.ready),name);
 assert.equal(report.plans.length,3);assert.equal('db' in report,false);assert.equal(report.plans.some(x=>'executionMs' in x),false);
});
test('two real sessions cannot hold the migration lock at once',async t=>{
 if(process.env.NODE_ENV!=='test'||!process.env.DATABASE_URL){t.skip('requires isolated test database');return;}
 const a=await pool.connect();let b;
 try{
  b=await pool.connect();
  await withMigrationLock(a,async()=>{
    await assert.rejects(withMigrationLock(b,async()=>assert.fail('must not run')),/Another HOLA migration/);
  });
  assert.equal(await withMigrationLock(b,async()=>true),true);
 }finally{if(b)b.release();a.release();}
});
test('owner metrics use one aggregate scan per relation and preserve owner scope',async()=>{
 const rows=await listMyPropertyListings('17',{query:async(sql,args)=>{
  assert.deepEqual(args,['17']);assert.match(sql,/WHERE p\.created_by = \$1/);
  assert.equal((sql.match(/FROM housing_viewing_requests /g)||[]).length,1);
  assert.equal((sql.match(/FROM housing_daily_metrics /g)||[]).length,1);
  assert.match(sql,/ORDER BY p\.created_at DESC,p\.id DESC/);
  return {rows:[{id:'2',viewing_requests_30d:'4',accepted_viewings_30d:'3',detail_views_30d:'30',contact_reveals_30d:'2'}]};
 }});
 assert.equal(rows[0].viewingRequests30d,4);assert.equal(rows[0].acceptedViewings30d,3);assert.equal(rows[0].detailViews30d,30);assert.equal(rows[0].contactReveals30d,2);
});
