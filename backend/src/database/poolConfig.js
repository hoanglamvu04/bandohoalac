// Pure validation so invalid limits fail fast rather than silently disabling
// backpressure. A 0/unset optional server timeout preserves role defaults.
function integer(values,key,fallback,min,max){
 const raw=values[key];
 if(raw==null||String(raw).trim()==='')return fallback;
 if(!/^\d+$/.test(String(raw).trim()))throw new Error('Invalid database setting: '+key);
 const n=Number(raw);
 if(!Number.isSafeInteger(n)||n<min||n>max)throw new Error('Invalid database setting: '+key);
 return n;
}
export function databasePoolOptions(values=process.env){
 const options={
  max:integer(values,'DB_POOL_MAX',10,1,50),
  connectionTimeoutMillis:integer(values,'DB_CONNECT_TIMEOUT_MS',10000,1000,120000),
  idleTimeoutMillis:integer(values,'DB_IDLE_TIMEOUT_MS',10000,1000,120000)
 };
 for(const [envKey,pgKey] of [
  ['DB_STATEMENT_TIMEOUT_MS','statement_timeout'],
  ['DB_LOCK_TIMEOUT_MS','lock_timeout'],
  ['DB_IDLE_TRANSACTION_TIMEOUT_MS','idle_in_transaction_session_timeout']
 ]){
  const n=integer(values,envKey,0,0,600000);
  if(n>0)options[pgKey]=n;
 }
 return options;
}
