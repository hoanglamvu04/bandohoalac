import { useEffect,useRef,useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { Link,useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { createHousingViewing } from '../services/api.js';
import '../housing-viewings.css';

function vnInput(ms){return new Date(ms+7*3600000).toISOString().slice(0,16);}
export default function HousingViewingRequest({placeId}) {
  const {user}=useAuth(),location=useLocation();
  const [time,setTime]=useState('');
  const [busy,setBusy]=useState(false),[result,setResult]=useState(null),[error,setError]=useState('');
  const active=useRef(null);
  useEffect(()=>{setTime('');setResult(null);setError('');setBusy(false);return()=>active.current?.abort();},[placeId,user?.id]);
  async function submit(event){
    event.preventDefault();
    if(!user||busy)return;
    setError('');
    const ms=Date.parse(time+':00+07:00');
    if(!Number.isFinite(ms)||ms%1800000!==0||ms<Date.now()+1800000||ms>Date.now()+30*86400000){
      setError('Chọn giờ tròn hoặc nửa giờ, từ 30 phút đến 30 ngày tới.');return;
    }
    const request=new AbortController();active.current=request;setBusy(true);
    try{const data=await createHousingViewing(placeId,new Date(ms).toISOString(),{signal:request.signal});
      if(!request.signal.aborted)setResult(data.item);
    }catch(e){if(!request.signal.aborted)setError(e.message||'Không gửi được lịch.');}
    finally{if(!request.signal.aborted)setBusy(false);}
  }
  return <section className="place-v2-card hm-viewing" data-testid="housing-viewing-request">
    <div className="place-v2-section-title"><CalendarClock size={19}/><h2>Đặt lịch xem nhà / phòng</h2></div>
    <p>Gửi khung giờ mong muốn đến tài khoản đăng tin. Lịch chỉ được xác nhận khi người đăng đồng ý; không gửi kèm số điện thoại hoặc email.</p>
    {!user?<Link to="/login" state={{from:{pathname:location.pathname,search:location.search}}}>Đăng nhập để đặt lịch</Link>:result?<div role="status">
      Đã gửi yêu cầu, đang chờ người đăng xác nhận. <Link to="/tin-bat-dong-san-cua-toi">Theo dõi lịch xem của tôi</Link>
    </div>:<form onSubmit={submit}>
      <label>Thời gian xem (giờ Việt Nam)<input type="datetime-local" required value={time}
        min={vnInput(Math.ceil((Date.now()+1800000)/1800000)*1800000)}
        max={vnInput(Math.floor((Date.now()+30*86400000)/1800000)*1800000)}
        step="1800" onChange={e=>setTime(e.target.value)}/></label>
      <button type="submit" disabled={busy||!time}>{busy?'Đang gửi...':'Gửi yêu cầu xem nhà'}</button>
    </form>}
    {error&&<p role="alert">{error}</p>}
    <small>Không đặt cọc qua lịch xem. Kiểm tra tài sản và người đăng trước khi giao dịch.</small>
  </section>;
}
