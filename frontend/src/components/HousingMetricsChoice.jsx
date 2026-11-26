import {useEffect,useRef,useState} from 'react';
import {hasHousingMetricsConsent,setHousingMetricsConsent,privacyBlocked,HOUSING_METRICS_EVENT} from '../lib/housingMetricsConsent.js';
import {recordHousingDetailView} from '../services/api.js';

export default function HousingMetricsChoice({placeId}){
  const [enabled,setEnabled]=useState(()=>hasHousingMetricsConsent());
  const recorded=useRef(null);
  useEffect(()=>{
    const sync=()=>setEnabled(hasHousingMetricsConsent());
    window.addEventListener('storage',sync);
    window.addEventListener(HOUSING_METRICS_EVENT,sync);
    return()=>{window.removeEventListener('storage',sync);window.removeEventListener(HOUSING_METRICS_EVENT,sync);};
  },[]);
  useEffect(()=>{
    if(enabled&&placeId&&recorded.current!==String(placeId)&&hasHousingMetricsConsent()){
      recorded.current=String(placeId);
      // One event per mounted detail, never a persistent visitor identifier.
      void recordHousingDetailView(placeId).catch(()=>{});
    }
  },[enabled,placeId]);
  return <section className={placeId?'place-v2-card':'public-info-card'} data-testid="housing-metrics-choice">
    <h2 style={{fontSize:'1rem'}}>Thống kê tin bất động sản (tùy chọn)</h2>
    <label style={{display:'flex',alignItems:'flex-start',gap:8,fontSize:13,lineHeight:1.6}}>
      <input type="checkbox" checked={enabled} disabled={privacyBlocked()}
        onChange={e=>{setHousingMetricsConsent(e.target.checked);setEnabled(hasHousingMetricsConsent());}}/>
      <span>Cho phép thống kê lượt xem chi tiết và lượt hiện số điện thoại bằng bộ đếm tổng hợp, để người đăng biết hiệu quả tin. Không lưu mã người xem, GPS, số điện thoại hay email trong bảng thống kê; không gửi X-HUB. Có thể tắt bất cứ lúc nào.</span>
    </label>
    {privacyBlocked()&&<small>Trình duyệt đang bật chế độ không theo dõi.</small>}
  </section>;
}
