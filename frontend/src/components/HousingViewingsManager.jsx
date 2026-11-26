import {useCallback,useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {CalendarClock} from 'lucide-react';
import {listMyHousingViewings,manageHousingViewing} from '../services/api.js';
import {useAuth} from '../context/AuthContext.jsx';
import '../housing-viewings.css';

const STATUS={PENDING:'Chờ xác nhận',ACCEPTED:'Đã xác nhận',DECLINED:'Đã từ chối',CANCELLED:'Đã hủy',PAST:'Đã qua giờ',UNAVAILABLE:'Tin không còn nhận lịch'};
export default function HousingViewingsManager(){
  const {user}=useAuth(),[items,setItems]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(null);
  const request=useRef(null),mutation=useRef(null);
  const load=useCallback(async()=>{
    request.current?.abort();
    const controller=new AbortController();request.current=controller;
    try{const result=await listMyHousingViewings({signal:controller.signal});
      if(!controller.signal.aborted){setItems(Array.isArray(result.items)?result.items:[]);setError('');}
    }catch(e){if(!controller.signal.aborted)setError(e.message);}
  },[]);
  useEffect(()=>{setItems(null);setError('');setBusy(null);if(user?.id)void load();
    return()=>{request.current?.abort();mutation.current?.abort();};},[user?.id,load]);
  async function change(id,action){
    if(busy)return;
    const controller=new AbortController();mutation.current=controller;setBusy(id);setError('');
    try{await manageHousingViewing(id,action,{signal:controller.signal});
      if(!controller.signal.aborted)await load();
    }catch(e){if(!controller.signal.aborted)setError(e.message);}
    finally{if(!controller.signal.aborted)setBusy(null);}
  }
  return <section className="estate-manager-card hm-viewing-manager" data-testid="housing-viewing-manager">
    <h2><CalendarClock size={19}/> Lịch xem nhà & khách quan tâm</h2>
    <p>Yêu cầu và lịch của bạn. Chỉ người gửi và tài khoản đăng tin có quyền truy cập; không hiển thị số điện thoại hoặc email của khách.</p>
    <button type="button" onClick={load}>Tải lại lịch</button>
    {error&&<p role="alert">{error}</p>}
    {items===null?<p>Đang tải lịch…</p>:items.length===0?<p>Chưa có yêu cầu xem nhà.</p>:
      ['INCOMING','OUTGOING'].map(direction=><div key={direction}>
        <h3>{direction==='INCOMING'?'Khách gửi tới tin của tôi':'Lịch tôi đã gửi'}</h3>
        {items.filter(v=>v.direction===direction).map(v=><article key={v.id} data-testid={'housing-viewing-'+v.id}>
          <strong>{v.listingName}</strong>
          <small>Yêu cầu #{v.id} · {new Date(v.startsAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</small>
          <span>{STATUS[v.status]||v.status}</span>
          <div className="hm-viewing-actions">
            {v.canAccept&&<button type="button" disabled={!!busy} onClick={()=>change(v.id,'ACCEPT')}>Xác nhận lịch</button>}
            {v.canDecline&&<button type="button" disabled={!!busy} onClick={()=>change(v.id,'DECLINE')}>Từ chối</button>}
            {v.canCancel&&<button type="button" disabled={!!busy} onClick={()=>change(v.id,'CANCEL')}>Hủy lịch</button>}
            {v.status!=='UNAVAILABLE'&&<Link to={'/place/'+v.placeId}>Xem tin</Link>}
          </div>
        </article>)}
        {!items.some(v=>v.direction===direction)&&<small>Chưa có lịch.</small>}
      </div>)}
    <small>Hiển thị tối đa 100 yêu cầu; trạng thái “đã qua giờ” không chứng minh giao dịch thành công.</small>
  </section>;
}
