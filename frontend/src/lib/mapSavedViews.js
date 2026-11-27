export const VIEW_KEY='hola_saved_map_views_v1';
export function validateSavedView(value){
  if(!value||typeof value!=='object'||typeof value.id!=='string'||!value.id||value.id.length>80||
      typeof value.name!=='string'||!value.name.trim()||value.name.length>60)return null;
  const {lng,lat,zoom}=value;
  // Product coverage fence, not a legal boundary. Store only explicit camera.
  if(![lng,lat,zoom].every(Number.isFinite)||lng<105.28||lng>105.71||lat<20.86||lat>21.18||zoom<11.9||zoom>18)return null;
  const layers=Array.isArray(value.layers)?[...new Set(value.layers.filter(x=>typeof x==='string'&&/^[A-Z_]{1,30}$/.test(x)))].slice(0,20):[];
  return {id:value.id,name:value.name.trim(),lng,lat,zoom,layers};
}
export function readSavedViews(storage){
  try{const rows=JSON.parse(storage.getItem(VIEW_KEY)||'[]');return Array.isArray(rows)?rows.map(validateSavedView).filter(Boolean).slice(0,10):[];}
  catch{return [];}
}

export function decodeSharedMapView(value){
 if(typeof value!=='string'||value.length>70||!/^\d+(?:\.\d+)?,\d+(?:\.\d+)?,\d+(?:\.\d+)?$/.test(value))return null;
 const [lng,lat,zoom]=value.split(',').map(Number);
 return validateSavedView({id:'shared',name:'Shared view',lng,lat,zoom,layers:[]});
}
const SHARE_FILTERS=['vertical','category','listingType','propertyType','subtype','furnishing','minRent','maxRent','minPrice','maxPrice','minArea','maxArea','availability','availableOnly','privateBathroom','parking','maxDistanceFpt','sort','open','rating'];
export function shareMapViewPath(view,search=''){
 const v=validateSavedView(view);if(!v)return null;
 const source=new URLSearchParams(search),out=new URLSearchParams();
 for(const key of SHARE_FILTERS){const value=source.get(key);if(value&&/^[A-Za-z0-9_.,-]{1,80}$/.test(value))out.set(key,value);}
 // Share only an explicitly saved camera, not browser GPS, search text, selected contact, or tokens.
 out.set('mapView',[v.lng.toFixed(5),v.lat.toFixed(5),v.zoom.toFixed(1)].join(','));
 return '/map?'+out.toString();
}
