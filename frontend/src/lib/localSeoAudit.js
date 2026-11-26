export function isIndexEligible(item){
 return item.status==='PUBLISHED'&&Boolean(item.quality?.ready)&&item.mapSupported===true&&Boolean(item.editorialReviewedAt)
 &&Number(item.quality?.placeCount||0)>=Number(item.minPlaceCount||1);
}
export function filterSeoPages(items,{query='',status='ALL',gate='ALL'}={}){
 const needle=query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase().trim();
 return items.filter(x=>(status==='ALL'||x.status===status)&&(gate==='ALL'||(gate==='READY'?x.canPublish:gate==='INDEX_ELIGIBLE'?isIndexEligible(x):gate==='BLOCKED_PUBLISHED'?x.status==='PUBLISHED'&&!isIndexEligible(x):!x.canPublish))
 &&(!needle||[x.title,x.slug,x.areaName,x.categorySlug].join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').includes(needle)));
}
// Neutralize spreadsheet formulas even after leading whitespace; quote all cells.
export function csvCell(value){
 let text=String(value??'');
 if(/^[\s\uFEFF]*[=+\-@]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;
 return '"'+text.replace(/"/g,'""')+'"';
}
export function seoAuditCsv(items){
 const rows=[['Slug','Title','Area','Category','Status','Quality gate','Index eligible (internal)','Place count','Photo count','Verified count','Blockers']];
 for(const x of items)rows.push([x.slug,x.title,x.areaName,x.categorySlug,x.status,x.canPublish?'PASS':'BLOCKED',isIndexEligible(x)?'YES':'NO',x.quality?.placeCount??0,x.quality?.photoPlaceCount??0,x.quality?.recentVerifiedCount??0,(x.quality?.blockers||[]).join('; ')]);
 return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
}
