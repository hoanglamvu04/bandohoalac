import {pathToFileURL} from 'node:url';

// Anonymous, read-only release checks. Do not print response bodies, IDs or URLs.
export function normalizeOrigin(value) {
  const url = new URL(value);
  const local = ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if (!(url.protocol === 'https:' || (url.protocol === 'http:' && local)) ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Use an HTTPS origin or loopback HTTP origin only.');
  }
  return url.origin;
}

export async function runReleaseSmoke(origin, request = fetch) {
  origin = normalizeOrigin(origin);
  const checks = [];
  async function check(name,path,status,validate = async () => true) {
    try {
      const response = await request(origin+path, {
        method:'GET', redirect:'manual', credentials:'omit',
        headers:{'Cache-Control':'no-cache'}, signal:AbortSignal.timeout(10000)
      });
      const ok = response.status === status && Boolean(await validate(response));
      checks.push({name,status:response.status,result:ok?'PASS':'FAIL'});
      return ok;
    } catch {
      checks.push({name,status:null,result:'FAIL'});
      return false;
    }
  }
  await check('API health','/api/health',200,async r=>(await r.json()).ok===true);
  await check('Database readiness','/api/ready',200,async r=>{
    const body=await r.json();
    return body.ok===true && body.database==='up' && /no-store/i.test(r.headers.get('cache-control')||'');
  });
  let sampleId = null;
  await check('Public housing list','/api/housing?listingType=RENT&limit=20',200,async r=>{
    const body=await r.json();
    if(!Array.isArray(body.items))return false;
    const eligible=body.items.find(x=>x?.housing && /^[1-9]\d{0,14}$/.test(String(x.id)) && !String(x.slug||'').startsWith('demo-thach-that-'));
    sampleId=eligible?String(eligible.id):null;
    return body.items.every(x=>x && x.phone==null && x.housing?.contactZalo==null);
  });
  if(sampleId){
    await check('Public housing detail contact redaction','/api/housing/'+sampleId,200,async r=>{
      const {item}=await r.json();return !!item && item.phone==null && item.housing?.contactZalo==null;
    });
    await check('Public advertiser review data shape','/api/community-tools/housing/'+sampleId+'/advertiser-status',200,async r=>{
      const body=await r.json();
      return typeof body.reviewed==='boolean' && Object.keys(body).every(k=>['reviewed','role','validUntil'].includes(k));
    });
  } else {
    checks.push({name:'Public housing detail contact redaction',status:null,result:'SKIP'});
    checks.push({name:'Public advertiser review data shape',status:null,result:'SKIP'});
  }
  await check('Anonymous contact forbidden','/api/housing/'+(sampleId||'1')+'/contact',401);
  await check('Anonymous admin operations forbidden','/api/admin/operations/overview',401);
  await check('Anonymous event moderation forbidden','/api/community-tools/admin/events',401);
  await check('Public event layer','/api/map-layers?types=EVENT&west=105.52&south=21.01&east=105.53&north=21.02',200,async r=>{
    const body=await r.json();return body.type==='FeatureCollection'&&Array.isArray(body.features);
  });
  await check('Local SEO sitemap','/api/sitemap-local-seo.xml',200,async r=>{
    const body=await r.text();return /<urlset\b/.test(body)&&/<\/urlset>/.test(body);
  });
  return {ok:!checks.some(c=>c.result==='FAIL'),complete:checks.every(c=>c.result==='PASS'),checks};
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  try {
    const result=await runReleaseSmoke(process.argv[2]);
    console.log(JSON.stringify(result,null,2));
    process.exitCode=result.complete?0:result.ok?2:1;
  } catch {
    console.error('Usage: node scripts/release-smoke.mjs https://your-hola-origin (or loopback HTTP)');
    process.exitCode=1;
  }
}
