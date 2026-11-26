import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {getHousingHistory,getSimilarHousing} from '../services/api.js';
import {detailRows} from '../lib/propertyDetails.js';

const money=(value)=>value==null?'Chưa có':new Intl.NumberFormat('vi-VN').format(value)+' đ';
const STATUS={AVAILABLE:'Còn phòng',LIMITED:'Sắp hết',FULL:'Hết phòng',UNKNOWN:'Chưa xác nhận'};
export default function HousingDiscoveryDetails({placeId,housing}){
 const [opened,setOpened]=useState(false),[data,setData]=useState(null),[error,setError]=useState('');
 const rows=detailRows(housing.details||{});
 useEffect(()=>{
  if(!opened)return;
  const controller=new AbortController();setData(null);setError('');
  Promise.all([getHousingHistory(placeId,{signal:controller.signal}),getSimilarHousing(placeId,{signal:controller.signal})])
   .then(([history,similar])=>{if(!controller.signal.aborted)setData({history,similar});})
   .catch(e=>{if(!controller.signal.aborted)setError(e.message||'Không tải được dữ liệu.');});
  return()=>controller.abort();
 },[opened,placeId]);
 return <section className="place-v2-card" data-testid="housing-discovery-details">
  <div className="place-v2-section-title"><h2>Đặc điểm & lịch sử giá chào</h2></div>
  {rows.length?<dl className="place-v2-housing-detail-grid">{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>:<p>Chưa có đặc điểm chi tiết do người đăng cung cấp.</p>}
  <p>Pháp lý, kích thước, nội thất là thông tin tự khai; kiểm tra trực tiếp trước giao dịch.</p>
  <button type="button" className="place-v2-inline-action" onClick={()=>setOpened(v=>!v)} aria-expanded={opened}>
    {opened?'Ẩn lịch sử và tin tương tự':'Xem lịch sử và tin tương tự'}
  </button>
  {opened&&(error?<p role="alert">{error}</p>:!data?<p role="status">Đang tải…</p>:<>
    <h3>Lịch sử cập nhật</h3>
    {data.history.items?.length?<ul>{data.history.items.map((item,i)=><li key={item.observedAt+'-'+i}>
      {new Date(item.observedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})} — {money(item.askingPriceVnd)}{item.listingType==='RENT'?'/tháng':''}
      {item.listingType==='RENT'?' · '+STATUS[item.availabilityStatus]+(item.availableRooms!=null?' ('+item.availableRooms+')':''):''}
    </li>)}</ul>:<p>Chưa có lịch sử ghi nhận.</p>}
    <small>{data.history.disclaimer}</small>
    <h3>Tin tương tự</h3>
    <p>{data.similar.criteria}</p>
    {data.similar.items?.length?<ul>{data.similar.items.map(item=><li key={item.id}><Link to={'/place/'+item.id}>{item.name}</Link>
      {' — '+money(item.priceVnd)+(item.listingType==='RENT'?'/tháng':'')+' · '+item.distanceM+' m'}</li>)}</ul>:<p>Chưa có tin tương tự đủ điều kiện.</p>}
  </>)}
 </section>;
}
