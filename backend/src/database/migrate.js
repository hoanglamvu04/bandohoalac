import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { env } from '../config/env.js';
import { databasePoolOptions } from './poolConfig.js';
import { migrationFiles, withMigrationLock } from './migrationPlan.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const shouldSeed = process.argv.includes('--seed');
  const shouldPlan = process.argv.includes('--plan');
  if (shouldSeed && env.nodeEnv === 'production') {
    throw new Error('Refusing to apply development seed.sql while NODE_ENV=production.');
  }
  const files = migrationFiles(__dirname,{seed:shouldSeed});
  if(shouldPlan){
    console.log(JSON.stringify({mode:'LEGACY_REPLAY_PLAN_NOT_APPLIED_HISTORY',files:files.map(({file,sha256})=>({file,sha256}))},null,2));
    return;
  }
  // Do not impose runtime statement timeouts on a migration session.
  const client=new pg.Client({connectionString:env.databaseUrl,application_name:'hola-maps-migrate',connectionTimeoutMillis:databasePoolOptions().connectionTimeoutMillis});
  let current='connection';
  try{
    await client.connect();
    await withMigrationLock(client,async session=>{
      for(const file of files){
        current=file.file;
        console.log('Applying '+current+'...');
        await session.query(file.sql);
        console.log(current+' applied successfully.');
      }
    });
  }catch(error){
    console.error('Migration failed at '+current+':',String(error?.code||'MIGRATION_ERROR'));
    throw error;
  }finally{await client.end();}
}

run().catch(error=>{
  // Production errors may contain row data; do not dump them into logs.
  if(env.nodeEnv!=='production'||!error?.code)console.error(error.message);
  process.exitCode=1;
});
