import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeOrigin,runReleaseSmoke} from '../../scripts/release-smoke.mjs';
const origin='http://127.0.0.1:8080';
function fixture({leak=false,empty=false,redirect=false}={}){
  const item={id:'82',slug:'room',phone:leak?'0900000000':null,housing:{contactZalo:null}};
  const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json',...headers}});
  return async (url,options)=>{
    assert.equal(options.method,'GET');assert.equal(options.redirect,'manual');assert.equal(options.credentials,'omit');
    const path=new URL(url).pathname;
    if(path==='/api/health')return redirect?new Response(null,{status:302,headers:{Location:'https://example.org'}}):json({ok:true});
    if(path==='/api/ready')return json({ok:true,database:'up'},200,{'Cache-Control':'no-store'});
    if(path==='/api/housing')return json({items:empty?[]:[item]});
    if(path==='/api/housing/82')return json({item});
    if(path.endsWith('/advertiser-status'))return json({reviewed:false,role:null,validUntil:null});
    if(path.endsWith('/contact')||path.includes('/admin/'))return json({error:'Authentication required'},401);
    if(path==='/api/map-layers')return json({type:'FeatureCollection',features:[]});
    if(path==='/api/sitemap-local-seo.xml')return new Response('<?xml version="1.0"?><urlset></urlset>');
    throw Error('Unexpected route');
  };
}
test('read-only release smoke checks actual shapes, RBAC and redacted fields',async()=>{
  const result=await runReleaseSmoke(origin,fixture());
  assert.equal(result.complete,true);assert.equal(result.ok,true);
  assert.equal(result.checks.length,10);
});
test('smoke fails on contact leakage and redirect without printing body; empty inventory is incomplete',async()=>{
  const leaked=await runReleaseSmoke(origin,fixture({leak:true}));
  assert.equal(leaked.ok,false);
  assert.doesNotMatch(JSON.stringify(leaked),/0900000000/);
  assert.equal((await runReleaseSmoke(origin,fixture({redirect:true}))).ok,false);
  const empty=await runReleaseSmoke(origin,fixture({empty:true}));
  assert.equal(empty.ok,true);assert.equal(empty.complete,false);
  assert.equal(empty.checks.filter(x=>x.result==='SKIP').length,2);
});
test('smoke origin rejects credentials, paths, queries and non-loopback HTTP',()=>{
  assert.equal(normalizeOrigin(origin),origin);
  for(const value of ['http://example.org','https://a:b@example.org','https://example.org/api','https://example.org/?token=x','https://example.org/#secret']){
    assert.throws(()=>normalizeOrigin(value));
  }
});
