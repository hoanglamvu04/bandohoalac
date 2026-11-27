import {pool} from '../database/pool.js';
import {auditDatabase} from '../services/databaseAudit.service.js';

try{
 const args=process.argv.slice(2);
 if(args.some(arg=>arg!=='--analyze'))throw new Error('Unknown audit option. Use --analyze only on isolated staging.');
 const result=await auditDatabase({analyze:args.includes('--analyze')});
 console.log(JSON.stringify(result,null,2));
}catch(error){
 console.error('Database audit failed:',error?.code||'AUDIT_ERROR');
 if(!error?.code)console.error(error.message);
 process.exitCode=1;
}finally{await pool.end();}
