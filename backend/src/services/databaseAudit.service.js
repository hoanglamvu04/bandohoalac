import {withTransaction} from '../database/pool.js';
import {SERVICE_AREA_GEOJSON_STRING} from '../config/mapCoverage.js';

export const MISSING_FK_INDEX_SQL=`SELECT t.relname AS table_name,c.conname AS constraint_name
 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
 JOIN pg_namespace n ON n.oid=t.relnamespace
 WHERE n.nspname='public' AND c.contype='f'
 AND NOT EXISTS (
   SELECT 1 FROM pg_index i JOIN pg_class ix ON ix.oid=i.indexrelid
   JOIN pg_am am ON am.oid=ix.relam
   WHERE i.indrelid=c.conrelid AND i.indisvalid AND i.indisready
   AND i.indpred IS NULL AND i.indexprs IS NULL AND am.amname='btree'
   AND i.indnkeyatts>=cardinality(c.conkey)
   AND ARRAY(SELECT k FROM unnest(i.indkey::smallint[]) WITH ORDINALITY AS x(k,ord)
      WHERE ord<=cardinality(c.conkey) ORDER BY k)
       =ARRAY(SELECT k FROM unnest(c.conkey) AS x(k) ORDER BY k)
 )
 ORDER BY t.relname,c.conname`;

const PLAN_QUERIES=[
 {name:'published-nearby',sql:`SELECT p.id
 FROM places p WHERE p.status='PUBLISHED'
 AND ST_DWithin(p.location::geography,ST_SetSRID(ST_MakePoint($1,$2),4326)::geography,$3)
 AND ST_Intersects(p.location,ST_SetSRID(ST_GeomFromGeoJSON($4),4326))
 ORDER BY ST_Distance(p.location::geography,ST_SetSRID(ST_MakePoint($1,$2),4326)::geography),p.rating_avg DESC,p.id DESC LIMIT 100`,
  args:[105.52522,21.01354,3000,SERVICE_AREA_GEOJSON_STRING]},
 {name:'owner-list-access-path',sql:`SELECT p.id FROM places p
 WHERE p.created_by=$1 ORDER BY p.created_at DESC,p.id DESC LIMIT 100`,args:[0]},
 {name:'public-bounds',sql:`SELECT p.id FROM places p
 WHERE p.status='PUBLISHED' AND ST_Intersects(p.location,ST_MakeEnvelope($1,$2,$3,$4,4326))
 AND ST_Intersects(p.location,ST_SetSRID(ST_GeomFromGeoJSON($5),4326))
 ORDER BY p.rating_avg DESC,p.updated_at DESC,p.id DESC LIMIT 100`,
  args:[105.50,20.99,105.55,21.04,SERVICE_AREA_GEOJSON_STRING]}
];

// Never serialize raw EXPLAIN: filters may contain literal values.
export function summarizePlan(node={}){
 const out={nodeType:node['Node Type']||null,indexName:node['Index Name']||null,planRows:node['Plan Rows']??null,totalCost:node['Total Cost']??null};
 for(const key of ['Actual Rows','Actual Loops','Shared Hit Blocks','Shared Read Blocks'])if(Number.isFinite(node[key]))out[key]=node[key];
 if(Array.isArray(node.Plans))out.children=node.Plans.map(summarizePlan);
 return out;
}
export function assertAnalyzeAllowed({analyze=false,nodeEnv,confirmation,expectedDatabase,actualDatabase}={}){
 if(!analyze)return;
 if(nodeEnv==='production'||confirmation!=='ANALYZE_ISOLATED_STAGING'||!expectedDatabase||expectedDatabase!==actualDatabase)
  throw new Error('EXPLAIN ANALYZE requires isolated staging, explicit confirmation and matching database name.');
}
export async function auditDatabase({analyze=false,nodeEnv=process.env.NODE_ENV,confirmation=process.env.HOLA_DB_AUDIT_CONFIRM,expectedDatabase=process.env.HOLA_DB_AUDIT_EXPECTED_DATABASE,transaction=withTransaction}={}){
 return transaction(async client=>{
  await client.query('SET TRANSACTION READ ONLY');
  await client.query("SET LOCAL statement_timeout='15s'");
  await client.query("SET LOCAL lock_timeout='1s'");
  const {rows:[identity]}=await client.query("SELECT current_database() AS db,current_setting('server_version_num') AS version,(SELECT extversion FROM pg_extension WHERE extname='postgis') AS postgis");
  assertAnalyzeAllowed({analyze,nodeEnv,confirmation,expectedDatabase,actualDatabase:identity.db});
  const {rows:tables}=await client.query(`SELECT relname AS table_name,n_live_tup::text AS estimated_live_rows,
     n_dead_tup::text AS estimated_dead_rows,pg_total_relation_size(relid)::text AS total_bytes,
     last_analyze,last_autoanalyze
     FROM pg_stat_user_tables WHERE schemaname='public' ORDER BY relname`);
  const {rows:constraints}=await client.query(`SELECT t.relname AS table_name,c.conname AS constraint_name,c.contype AS type,c.convalidated AS validated
    FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public' ORDER BY t.relname,c.conname`);
  const {rows:indexes}=await client.query(`SELECT s.relname AS table_name,s.indexrelname AS index_name,
    s.idx_scan::text AS scans,pg_relation_size(s.indexrelid)::text AS bytes,i.indisvalid AS valid,i.indisready AS ready
    FROM pg_stat_user_indexes s JOIN pg_index i ON i.indexrelid=s.indexrelid
    WHERE s.schemaname='public' ORDER BY s.relname,s.indexrelname`);
  const {rows:foreignKeysWithoutLeadingBtree}=await client.query(MISSING_FK_INDEX_SQL);
  const plans=[];
  for(const q of PLAN_QUERIES){
   const {rows:[row]}=await client.query((analyze?'EXPLAIN (FORMAT JSON, ANALYZE TRUE, BUFFERS TRUE, TIMING FALSE) ':'EXPLAIN (FORMAT JSON) ')+q.sql,q.args);
   const raw=row['QUERY PLAN'];const document=typeof raw==='string'?JSON.parse(raw)[0]:raw[0];
   plans.push({name:q.name,plan:summarizePlan(document.Plan),...(analyze?{executionMs:document['Execution Time'],planningMs:document['Planning Time']}:{})});
  }
  return {mode:analyze?'ISOLATED_STAGING_ANALYZE':'READ_ONLY_ESTIMATES',postgresVersion:identity.version,postgisVersion:identity.postgis,tables,constraints,indexes,foreignKeysWithoutLeadingBtree,plans,
   notes:['Catalog row counts and index scans are estimates/cumulative statistics, not proof of index usefulness.','Plans are bounded access-path probes, not complete API latency or a production benchmark.','Owner probe uses synthetic ID 0; its selectivity is not representative.','Missing leading B-tree indexes are review candidates, not automatic migration instructions.']};
 });
}
