import { SUBTYPES,FURNISHINGS,DIRECTIONS,LEGAL_CLAIMS,AMENITIES } from '../lib/propertyDetails.js';

export default function PropertyDetailsFields({form,onChange}){
 const d=form.details||{},land=form.propertyType==='LAND';
 const set=(key,value)=>onChange('details',{...d,[key]:value});
 const select=(key,label,options)=><label key={key}>{label}<select value={options.some(x=>x[0]===d[key])?d[key]:''} onChange={e=>set(key,e.target.value)}>
  <option value="">Chưa cập nhật</option>{options.map(([value,name])=><option key={value} value={value}>{name}</option>)}</select></label>;
 const num=(key,label,min,max,step='1')=><label key={key}>{label}<input type="number" min={min} max={max} step={step} value={d[key]??''} onChange={e=>set(key,e.target.value)}/></label>;
 return <>
  {select('subtype','Loại hình chi tiết',SUBTYPES.filter(x=>x[2]===form.propertyType))}
  {num('frontageM','Mặt tiền (m)',0.1,1000,'0.1')}
  {num('accessWidthM','Đường vào (m)',0.1,100,'0.1')}
  {select('direction','Hướng',DIRECTIONS)}
  {!land&&<>
   {num('floors','Số tầng',1,100)}{num('bedrooms','Phòng ngủ',0,100)}{num('bathrooms','Phòng vệ sinh',0,100)}
   {select('furnishing','Nội thất',FURNISHINGS)}
   {form.transactionType==='RENT'&&num('maxOccupants','Số người ở tối đa',1,100)}
  </>}
  {select('legalClaim','Pháp lý do người đăng tự khai (chưa xác minh)',LEGAL_CLAIMS)}
  {!land&&AMENITIES.map(([key,label])=><label key={key}>{label}<select value={form.amenities?.[key]??''}
    onChange={e=>onChange('amenities',{...form.amenities,[key]:e.target.value})}>
    <option value="">Chưa rõ</option><option value="true">Có</option><option value="false">Không</option></select></label>)}
 </>;
}
