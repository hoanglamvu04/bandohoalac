import {SUBTYPES,DIRECTIONS,FURNISHINGS,AMENITIES,submissionDetails} from './propertyDetails.js';
const TYPES={LAND:'Đất',HOUSE:'Nhà ở',APARTMENT:'Căn hộ',VILLA:'Biệt thự',COMMERCIAL:'Mặt bằng',OTHER:'Bất động sản'};
const format=n=>new Intl.NumberFormat('vi-VN',{maximumFractionDigits:2}).format(n);
function num(value,min,max){
 if(value==null||String(value).trim()==='')return null;
 const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:null;
}
// Local rules only: no external model, no personal contact fields, no invented claims.
export function buildHousingDraft(form){
 const d=submissionDetails(form),type=SUBTYPES.find(x=>x[0]===d.subtype)?.[1]||TYPES[form.propertyType];
 const transaction=form.transactionType==='RENT'?'Cho thuê':form.transactionType==='SALE'?'Cần bán':null;
 if(!type||!transaction)return {text:'',missing:['Loại tài sản và giao dịch']};
 const missing=[],lines=[transaction+' '+type+'.'];
 const area=num(form.areaM2,0.01,99999.99),price=num(form.priceVnd,1,form.transactionType==='RENT'?100000000:1000000000000000);
 if(area!==null)lines.push('Diện tích: '+format(area)+' m².');else missing.push('Diện tích');
 if(price!==null&&Number.isInteger(price))lines.push('Giá chào: '+format(price)+' đ'+(form.transactionType==='RENT'?'/tháng.':'.'));else missing.push('Giá chào');
 const parts=[];
 for(const [k,label,min,max] of [['floors','tầng',1,100],['bedrooms','phòng ngủ',0,100],['bathrooms','phòng vệ sinh',0,100],['maxOccupants','người ở tối đa',1,100]]){
  const n=num(d[k],min,max);if(n!==null&&Number.isInteger(n))parts.push(format(n)+' '+label);
 }
 if(parts.length)lines.push('Đặc điểm: '+parts.join(', ')+'.');
 const direction=DIRECTIONS.find(x=>x[0]===d.direction)?.[1];if(direction)lines.push('Hướng: '+direction+'.');
 const furnishings=FURNISHINGS.find(x=>x[0]===d.furnishing)?.[1];if(furnishings)lines.push('Nội thất: '+furnishings+'.');
 const amenities=AMENITIES.filter(([k])=>form.amenities?.[k]==='true'&&form.propertyType!=='LAND').map(([,label])=>label);
 if(amenities.length)lines.push('Tiện nghi người đăng cung cấp: '+amenities.join(', ')+'.');
 if(form.transactionType==='RENT'){
  for(const [k,label,unit,max] of [['depositAmount','Tiền cọc','đ',100000000],['electricityPricePerKwh','Điện','đ/kWh',100000],['waterPricePerPersonMonth','Nước','đ/người/tháng',100000000],['parkingFeeMonthly','Gửi xe','đ/tháng',100000000],['availableRooms','Phòng/căn còn trống','',10000]]){
   const n=num(form[k],0,max);if(n!==null&&Number.isInteger(n))lines.push(label+': '+format(n)+(unit?' '+unit:'')+'.');else missing.push(label);
  }
 }
 lines.push('Thông tin do người đăng cung cấp; vui lòng kiểm tra hiện trạng, pháp lý và điều kiện giao dịch trực tiếp.');
 return {text:lines.join('\n'),missing};
}
