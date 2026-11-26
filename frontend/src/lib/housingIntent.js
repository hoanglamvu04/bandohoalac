// Deliberately bounded Vietnamese parser, not an LLM and not a valuation.
export function foldVietnamese(value) {
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase().replace(/\s+/g,' ').trim();
}
export function parseHousingIntent(input,{force=false}={}) {
  let q=foldVietnamese(input).slice(0,160);
  const filters={}, labels=[];
  const explicit=/(?:\bphong tro\b|\bnha tro\b|\btim tro\b|\bcho thue\b|\bcan ban\b|\bmua dat\b|\bmua nha\b|\bmua can ho\b|\bchung cu mini\b)/.test(q);
  if(!force&&!explicit)return {recognized:false,filters,labels,q:String(input||'').trim()};
  const rent=/(?:phong tro|nha tro|tim tro|cho thue|thue phong|thue nha|chung cu mini)/.test(q);
  const sale=/(?:can ban|mua dat|mua nha|mua can ho)/.test(q);
  if(rent&&!sale){filters.listingType='RENT';labels.push('Cho thuê');}
  if(sale&&!rent){filters.listingType='SALE';labels.push('Cần bán');}
  if(filters.listingType==='RENT'&&/\b(?:phong tro|nha tro|tim tro)\b/.test(q)){
    // Older listings do not have subtype yet. Keep legacy room inventory.
    q=q.replace(/\b(?:phong tro|nha tro|tim tro)\b/g,' ');
  }
  if(/\bchung cu mini\b/.test(q)){filters.propertyType='APARTMENT';filters.subtype='MINI_APARTMENT';q=q.replace(/\bchung cu mini\b/g,' ');labels.push('Chung cư mini');}
  else if(/\b(?:mua dat|can ban dat)\b/.test(q)){filters.propertyType='LAND';q=q.replace(/\b(?:mua dat|can ban dat)\b/g,' ');labels.push('Đất');}
  q=q.replace(/\b(?:tim tro|tim|cho thue|thue phong|thue nha|can ban|mua nha|mua can ho|phong tro|nha tro)\b/g,' ');
  // Do not silently interpret a number as a budget without its unit or bound.
  const budget=/(?:duoi|toi da|khong qua|<=|tu|tren|it nhat)\s*(\d{1,5}(?:[.,]\d{1,2})?)\s*(trieu|ty|nghin|ngan|tr|k)(?![a-z])/g;
  q=q.replace(budget,(match,raw,unit)=>{
    const amount=Math.round(Number(raw.replace(',','.'))*(unit==='ty'?1e9:['trieu','tr'].includes(unit)?1e6:1000));
    if(!filters.listingType||!Number.isSafeInteger(amount)||amount<=0||amount>(filters.listingType==='RENT'?1e8:1e15))return match;
    const minimum=/^(?:tu|tren|it nhat)\b/.test(match);
    const key=(minimum?'min':'max')+(filters.listingType==='RENT'?'Rent':'Price');
    filters[key]=String(amount);labels.push((minimum?'Từ ':'Tối đa ')+new Intl.NumberFormat('vi-VN').format(amount)+' đ');
    return ' ';
  });
  q=q.replace(/(?:trong\s+)?(\d{1,2}(?:[.,]\d)?)\s*km\s*(?:quanh|toi|den|cach|gan)\s*(?:dai hoc\s*)?fpt\b/g,(m,n)=>{
    const meters=Math.round(Number(n.replace(',','.'))*1000);
    if(meters<100||meters>50000)return m;
    filters.maxDistanceFpt=String(meters);labels.push('FPT ≤ '+meters+' m đường thẳng');return ' ';
  });
  q=q.replace(/\b(?:gan|quanh)\s+(?:dai hoc\s*)?fpt\b/g,()=>{
    filters.maxDistanceFpt=filters.maxDistanceFpt||'3000';labels.push('Gần FPT: mặc định 3 km đường thẳng');return ' ';
  });
  const choices=[[/\b(?:co\s+)?(?:ve sinh rieng|khep kin)\b/g,'privateBathroom','Vệ sinh riêng'],[/\b(?:co\s+)?(?:cho de xe|gui xe|bai xe)\b/g,'parking','Chỗ gửi xe']];
  for(const [pattern,key,label] of choices){
    // Negated text remains a keyword rather than incorrectly enabling a filter.
    if(new RegExp('(?:khong|chua)\\s+(?:co\\s+)?'+(key==='parking'?'(?:cho de xe|gui xe|bai xe)':'(?:ve sinh rieng|khep kin)')).test(q))continue;
    q=q.replace(pattern,()=>{filters[key]='true';labels.push(label);return ' ';});
  }
  if(/\bday du noi that\b/.test(q)){filters.furnishing='FULL';labels.push('Đầy đủ nội thất');q=q.replace(/\bday du noi that\b/g,' ');}
  if(/\bcon phong\b/.test(q)){filters.availableOnly='true';labels.push('Còn phòng đã khai');q=q.replace(/\bcon phong\b/g,' ');}
  q=q.replace(/\b(?:gia|o|tai|va)\b/g,' ').replace(/[;,]+/g,' ').replace(/\s+/g,' ').trim();
  // Contradictory limits are deliberately rejected rather than guessed.
  for(const [lo,hi] of [['minRent','maxRent'],['minPrice','maxPrice']])if(filters[lo]&&filters[hi]&&Number(filters[lo])>Number(filters[hi]))return {recognized:explicit||force,filters:{},labels:['Ngân sách mâu thuẫn; kiểm tra lại'],q:foldVietnamese(input),invalid:true};
  return {recognized:explicit||force,filters,labels,q};
}
