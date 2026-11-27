import test from 'node:test';
import assert from 'node:assert/strict';
import {marketOverlay,marketColor} from '../../frontend/src/lib/marketOverlay.js';
import {shareMapViewPath,decodeSharedMapView} from '../../frontend/src/lib/mapSavedViews.js';
test('market overlay uses bounded aggregate polygons and rejects small samples',()=>{
 const data=marketOverlay({cellDegrees:0.025,minSample:5,cells:[{col:4220,row:840,median:2500000,sampleCount:5},{col:4221,row:840,median:2000000,sampleCount:4},{col:0,row:0,median:100,sampleCount:50}]});
 assert.equal(data.features.length,1);const f=data.features[0];assert.equal(f.geometry.type,'Polygon');assert.deepEqual(f.geometry.coordinates[0][0],f.geometry.coordinates[0].at(-1));assert.equal(f.properties.color,marketColor(2500000,2500000,2500000));assert.equal('id' in f.properties,false);
 assert.equal(marketOverlay(null).features.length,0);
});
test('shared view includes allowlisted filters only and rejects invalid camera',()=>{
 const path=shareMapViewPath({id:'a',name:'A',lng:105.52522,lat:21.01354,zoom:14,layers:[]},'?vertical=housing&listingType=RENT&q=private&token=secret&lat=0');
 const params=new URL(path,'https://example.invalid').searchParams;
 assert.equal(params.get('vertical'),'housing');assert.equal(params.get('listingType'),'RENT');assert.equal(params.has('q'),false);assert.equal(params.has('token'),false);assert.equal(params.has('lat'),false);
 assert.equal(decodeSharedMapView(params.get('mapView')).zoom,14);assert.equal(decodeSharedMapView('0,0,17'),null);
});
