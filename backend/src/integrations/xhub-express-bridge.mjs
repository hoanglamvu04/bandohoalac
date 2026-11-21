// WA-001 — copy into the WEBSITE BACKEND, never into public JS.
// X-HUB_SITE_ID and X-HUB_SITE_TOKEN come from the trusted provisioning CLI.
// Add this handler to the site's existing Express router and its rate limiter;
// express.json({limit:'16kb'}) must run before it.
// No form values, cookies or user identities are forwarded.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN=/^[A-Za-z0-9_-]{43}$/;

export function createXHubAnalyticsBridge({
  siteId,siteToken,publicHost,baseUrl='https://hub.holaspace.vn',
  send=globalThis.fetch?.bind(globalThis),allowLocalhost=false
}={}){
  if(!UUID.test(siteId||'')||!TOKEN.test(siteToken||'')||
    typeof send!=='function'||!publicHost||
    !/^[a-z0-9.-]{3,253}$/.test(publicHost))
    throw new TypeError('Website source ID, private token, public host and fetch required');
  const origin=new URL(baseUrl);
  if(origin.username||origin.password||origin.search||origin.hash||
    origin.pathname!=='/'||
    !(origin.protocol==='https:'||
      (allowLocalhost&&origin.protocol==='http:'&&
        ['localhost','127.0.0.1'].includes(origin.hostname))))
    throw new TypeError('HTTPS X-HUB base URL required');
  const url=origin.origin+'/api/v1/telemetry/sites/'+siteId+'/events';
  return async function xHubAnalyticsBridge(req,res){
    res.set('Cache-Control','no-store');
    if(req.get('Sec-Fetch-Site')==='cross-site')
      return res.status(403).json({error:'Cross-site tracking denied'});
    // Stop browsers from other origins from driving this privileged forwarder.
    const browserOrigin=req.get('Origin');
    if(browserOrigin){
      try{
        const parsed=new URL(browserOrigin);
        if(parsed.hostname!==publicHost||
          !['http:','https:'].includes(parsed.protocol))
          return res.status(403).json({error:'Origin not allowed'});
      }catch{return res.status(403).json({error:'Invalid Origin'});}
    }
    if(!req.is('application/json')||!req.body||
      req.body.schemaVersion!==1||!Array.isArray(req.body.events)||
      req.body.events.length<1||req.body.events.length>20||
      Buffer.byteLength(JSON.stringify(req.body),'utf8')>16000)
      return res.status(400).json({error:'Invalid event batch'});
    // Extra fields are rejected by the central X-HUB contract. Never add
    // req.ip, req.user, cookies, headers or request context to the event.
    try{
      const upstream=await send(url,{
        method:'POST',
        headers:{'Content-Type':'application/json',
          Authorization:'Bearer '+siteToken},
        body:JSON.stringify(req.body),
        signal:AbortSignal.timeout(5000),
        redirect:'error'
      });
      const status=upstream.status===202?202:
        upstream.status===429?429:upstream.status>=500?503:400;
      // Do not proxy X-HUB internals or echo credentials in error bodies.
      return res.status(status).json(status===202?
        {accepted:true}:{error:'Analytics bridge temporarily unavailable'});
    }catch{
      return res.status(503).json({error:'Analytics bridge temporarily unavailable'});
    }
  };
}
