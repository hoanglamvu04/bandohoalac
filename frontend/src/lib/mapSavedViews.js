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
