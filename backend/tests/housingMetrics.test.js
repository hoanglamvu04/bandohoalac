import test from 'node:test';
import assert from 'node:assert/strict';
import {hasHousingMetricConsent,recordHousingMetric} from '../src/services/housingMetrics.service.js';
import {createApp} from '../src/app.js';
const req=(headers)=>({get:key=>headers[key]});
test('metrics need explicit opt-in and respect privacy signals',()=>{
  assert.equal(hasHousingMetricConsent(req({})),false);
  assert.equal(hasHousingMetricConsent(req({'X-Hola-Housing-Stats':'1'})),true);
  assert.equal(hasHousingMetricConsent(req({'X-Hola-Housing-Stats':'1','Sec-GPC':'1'})),false);
  assert.equal(hasHousingMetricConsent(req({'X-Hola-Housing-Stats':'1',DNT:'1'})),false);
});
test('aggregate SQL only receives listing and enum; excludes unapproved or imported/demo',async()=>{
  let calls=0;
  const db={query:async(sql,params)=>{
    calls++;
    assert.deepEqual(params,['42','DETAIL_VIEW']);
    assert.match(sql,/p.status='PUBLISHED'/);
    assert.match(sql,/p.external_source IS NULL/);
    assert.match(sql,/hl.expires_at>NOW\(\)/);
    assert.match(sql,/ON CONFLICT\(place_id,metric_day\)/);
    return {rowCount:1};
  }};
  assert.equal(await recordHousingMetric('42','DETAIL_VIEW',db),true);
  assert.equal(await recordHousingMetric('42','phone',db),false);
  assert.equal(await recordHousingMetric('42 OR 1=1','DETAIL_VIEW',db),false);
  assert.equal(calls,1);
});
test('metrics endpoint is a no-op without consent',async()=>{
  const server=createApp().listen(0);
  try{
    await new Promise(resolve=>server.once('listening',resolve));
    const url='http://127.0.0.1:'+server.address().port+'/api/housing/42/detail-view';
    assert.equal((await fetch(url,{method:'POST'})).status,204);
    assert.equal((await fetch(url,{method:'POST',headers:{'X-Hola-Housing-Stats':'1',DNT:'1'}})).status,204);
    assert.equal((await fetch(url,{method:'POST',headers:{'X-Hola-Housing-Stats':'1','Content-Type':'application/json'},body:JSON.stringify({email:'example@example.invalid'})})).status,400);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
