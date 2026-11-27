export const MARKET_COLORS=['#2d775a','#78a772','#e5bd69','#bd7254'];
export function marketColor(value,lo,hi){return MARKET_COLORS[Math.max(0,Math.min(3,Math.floor(hi===lo?0:(value-lo)/(hi-lo)*4)))];}
// Convert only server-suppressed aggregates into polygons; never plot addresses/individual prices.
export function marketOverlay(grid){
 const empty={type:'FeatureCollection',features:[]};
 if(!grid||!Array.isArray(grid.cells)||!Number.isFinite(grid.cellDegrees)||grid.cellDegrees<=0||grid.cellDegrees>0.1)return empty;
 const size=grid.cellDegrees;
 const cells=grid.cells.slice(0,1000).filter(x=>Number.isInteger(x.col)&&Number.isInteger(x.row)&&Number.isFinite(x.median)&&x.median>0&&x.sampleCount>=Math.max(5,Number(grid.minSample)||5)&&x.col*size>=105.20&&x.col*size<=105.80&&x.row*size>=20.80&&x.row*size<=21.25);
 if(!cells.length)return empty;
 const lo=Math.min(...cells.map(x=>x.median)),hi=Math.max(...cells.map(x=>x.median));
 return {type:'FeatureCollection',features:cells.map(x=>{
  const west=x.col*size,south=x.row*size,east=west+size,north=south+size;
  return {type:'Feature',geometry:{type:'Polygon',coordinates:[[[west,south],[east,south],[east,north],[west,north],[west,south]]]},properties:{median:x.median,sampleCount:x.sampleCount,color:marketColor(x.median,lo,hi)}};
 })};
}
