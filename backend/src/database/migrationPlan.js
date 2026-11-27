import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

// Keep legacy replay behavior in this release: existing installations have
// no trustworthy applied-migration ledger. Do not auto-adopt one.
export function migrationFiles(directory,{seed=false}={}){
 const files=[{file:'schema.sql',path:path.join(directory,'schema.sql')}];
 const migrationsDir=path.join(directory,'migrations');
 if(existsSync(migrationsDir)){
  for(const name of readdirSync(migrationsDir).filter(name=>name.endsWith('.sql')).sort()){
   files.push({file:'migrations/'+name,path:path.join(migrationsDir,name)});
  }
 }
 if(seed)files.push({file:'seed.sql',path:path.join(directory,'seed.sql')});
 return files.map(entry=>{
  const sql=readFileSync(entry.path,'utf8');
  return {...entry,sql,sha256:createHash('sha256').update(sql,'utf8').digest('hex')};
 });
}

const MIGRATION_LOCK=[241771,400];
// Use the SAME dedicated PostgreSQL session for lock and every SQL file.
export async function withMigrationLock(client,work){
 const {rows:[lock]}=await client.query('SELECT pg_try_advisory_lock($1,$2) AS acquired',MIGRATION_LOCK);
 if(lock?.acquired!==true)throw new Error('Another HOLA migration is running. Stop and inspect before retrying.');
 let failed=false;
 try{return await work(client);}
 catch(error){
  failed=true;
  // A migration may contain an explicit transaction; reset it before unlock.
  try{await client.query('ROLLBACK');}catch{/* dedicated connection is closed by caller */}
  throw error;
 }finally{
  try{
   const {rows:[unlocked]}=await client.query('SELECT pg_advisory_unlock($1,$2) AS released',MIGRATION_LOCK);
   if(unlocked?.released!==true)throw new Error('Migration advisory lock was not released.');
  }catch(error){if(!failed)throw error;}
 }
}
