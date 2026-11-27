import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {getAdvertiserStatus,getMyAdvertiserReview,requestAdvertiserReview,getAdvertiserReviewQueue,reviewAdvertiserRole,getMyEventProposals,submitCommunityEvent,getCommunityEventQueue,reviewCommunityEvent} from '../services/api.js';
import './community-tools.css';
const roles={OWNER:'Chủ nhà / chủ tài sản',BROKER:'Môi giới',MANAGER:'Người quản lý'};
const status={PENDING:'Chờ kiểm tra',APPROVED:'Đã duyệt',REJECTED:'Từ chối',REVOKED:'Đã thu hồi'};
const date=v=>v?new Date(v).toLocaleString('vi-VN'):'—';
const errorText=e=>e?.response?.data?.message||e?.response?.data?.error||e?.message||'Không thực hiện được yêu cầu.';
export function AdvertiserReviewBadge({placeId}){
 const [data,setData]=useState(null);
 useEffect(()=>{let active=true;setData(null);getAdvertiserStatus(placeId).then(x=>{if(active)setData(x);}).catch(()=>{});return()=>{active=false;};},[placeId]);
 if(!data?.role)return null;
 return <div className="ct-panel"><b>{roles[data.role]} · {data.reviewed?'Vai trò đã được kiểm tra':'Vai trò tự khai, chưa xác minh'}</b>{data.reviewed&&<p>Hiệu lực kết quả kiểm tra đến {date(data.validUntil)}. Không phải xác minh quyền sở hữu, pháp lý hoặc bảo đảm giao dịch.</p>}</div>;
}
export function AdvertiserReviewRequest({placeId}){
 const [open,setOpen]=useState(false),[data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function load(){setBusy(true);setError('');try{setData(await getMyAdvertiserReview(placeId));}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 useEffect(()=>{if(open)load();},[open,placeId]);
 const pending=data?.items?.some(x=>x.status==='PENDING');
 const approved=data?.items?.some(x=>x.status==='APPROVED'&&x.role===data.role&&Date.parse(x.validUntil)>Date.now());
 return <section className="ct-panel"><button type="button" onClick={()=>setOpen(x=>!x)}>{open?'Đóng':'Yêu cầu kiểm tra vai trò người đăng'}</button>{open&&<><p>Đội vận hành phải kiểm tra thực tế danh tính và quyền đại diện. Không tải CCCD, sổ đỏ hoặc giấy tờ cá nhân lên biểu mẫu này.</p>{error&&<p role="alert">{error}</p>}{data?.eligible?<><p>Vai trò khai báo: {roles[data.role]}</p>{data.items?.map(x=><p key={x.id}>{status[x.status]} · {date(x.createdAt)}{x.validUntil?' · đến '+date(x.validUntil):''}</p>)}<button type="button" disabled={busy||pending||approved} onClick={async()=>{setBusy(true);setError('');try{await requestAdvertiserReview(placeId);await load();}catch(e){setError(errorText(e));setBusy(false);}}}>Gửi yêu cầu kiểm tra</button></>:data&&!data.eligible?<p>Tin chưa đủ điều kiện hoặc chưa khai báo vai trò phù hợp.</p>:<p>Đang tải…</p>}</>}</section>;
}
export function EventProposalForm({placeId,user}){
 const [open,setOpen]=useState(false),[items,setItems]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [form,setForm]=useState({title:'',description:'',sourceUrl:'',startsAt:'',endsAt:''});
 const field=(key,value)=>setForm(x=>({...x,[key]:value}));
 async function load(){try{setItems((await getMyEventProposals(placeId)).items||[]);}catch(e){setError(errorText(e));}}
 useEffect(()=>{if(open&&user)load();},[open,placeId,user?.id]);
 async function send(e){e.preventDefault();setBusy(true);setError('');setNotice('');try{await submitCommunityEvent(placeId,{...form,startsAt:new Date(form.startsAt).toISOString(),endsAt:new Date(form.endsAt).toISOString()});setForm({title:'',description:'',sourceUrl:'',startsAt:'',endsAt:''});setNotice('Đã gửi chờ duyệt. Chưa công khai trên bản đồ.');await load();}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 return <section className="ct-panel"><button type="button" onClick={()=>setOpen(x=>!x)}>{open?'Đóng':'Đóng góp sự kiện tại địa điểm này'}</button>{open&&<><p>Chỉ gửi sự kiện công khai, diễn ra tại địa điểm này trong 90 ngày tới. Cần nguồn HTTPS công khai để người duyệt kiểm tra. Không đưa thông tin riêng tư.</p>{!user?<Link to="/login">Đăng nhập để đóng góp</Link>:<form onSubmit={send}><div className="ct-fields"><label>Tên sự kiện<input required minLength={5} maxLength={120} value={form.title} onChange={e=>field('title',e.target.value)}/></label><label>Nguồn công khai (URL HTTPS)<input required type="url" maxLength={500} value={form.sourceUrl} onChange={e=>field('sourceUrl',e.target.value)}/></label><label>Bắt đầu (giờ thiết bị)<input required type="datetime-local" value={form.startsAt} onChange={e=>field('startsAt',e.target.value)}/></label><label>Kết thúc (giờ thiết bị)<input required type="datetime-local" value={form.endsAt} onChange={e=>field('endsAt',e.target.value)}/></label></div><label>Mô tả<textarea required minLength={10} maxLength={1000} value={form.description} onChange={e=>field('description',e.target.value)}/></label><button type="submit" disabled={busy}>Gửi chờ duyệt</button></form>}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}{items.map(x=><p key={x.id}>{x.title} · {status[x.status]}</p>)}</>}</section>;
}
function ReviewCard({item,kind,busy,onAction}){
 const [first,setFirst]=useState(false),[second,setSecond]=useState(false);
 const role=kind==='role';
 return <article><h4>{item.placeName||'Địa điểm'} · {role?roles[item.role]:item.title}</h4><Link to={'/place/'+item.placeId}>Xem địa điểm</Link> · {status[item.status]}{role?<p>Mã người gửi: {item.requesterId}</p>:<><p>{item.description}</p><p>{date(item.startsAt)} – {date(item.endsAt)}</p><p>Nguồn cần kiểm tra: {item.sourceUrl}</p></>}{item.status==='PENDING'?<><label><input type="checkbox" checked={first} onChange={e=>setFirst(e.target.checked)}/>{role?'Đã kiểm tra đúng người đăng qua quy trình thực tế':'Đã kiểm tra nguồn công khai, địa điểm và thời gian'}</label>{role&&<label><input type="checkbox" checked={second} onChange={e=>setSecond(e.target.checked)}/> Đã kiểm tra căn cứ vai trò, không xác nhận quyền sở hữu pháp lý</label>}<div><button type="button" disabled={busy||!first||(role&&!second)} onClick={()=>onAction(item.id,role?{action:'APPROVE',checkedIdentity:first,checkedRole:second}:{action:'APPROVE',checkedSource:first})}>Duyệt</button> <button type="button" disabled={busy} onClick={()=>onAction(item.id,{action:'REJECT'})}>Từ chối</button></div></>:<button type="button" disabled={busy} onClick={()=>onAction(item.id,{action:'REVOKE'})}>Thu hồi</button>}</article>;
}
export function AdminReviewWorkflows({user}){
 const [open,setOpen]=useState(false),[rolesQueue,setRolesQueue]=useState([]),[events,setEvents]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function load(){setBusy(true);setError('');try{const [r,e]=await Promise.all([user.role==='ADMIN'?getAdvertiserReviewQueue():Promise.resolve({items:[]}),getCommunityEventQueue()]);setRolesQueue(r.items);setEvents(e.items);}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 useEffect(()=>{if(open)load();},[open,user.role]);
 async function act(kind,id,payload){if(!window.confirm('Xác nhận xử lý yêu cầu?'))return;setBusy(true);setError('');try{await (kind==='role'?reviewAdvertiserRole(id,payload):reviewCommunityEvent(id,payload));await load();}catch(e){setError(errorText(e));setBusy(false);}}
 return <section className="ct-panel"><button type="button" onClick={()=>setOpen(x=>!x)}>{open?'Đóng':'Duyệt vai trò người đăng & sự kiện'}</button>{open&&<><button type="button" disabled={busy} onClick={load}>Tải hàng chờ</button>{error&&<p role="alert">{error}</p>}{user.role==='ADMIN'&&<><h3>Kiểm tra vai trò người đăng ({rolesQueue.length})</h3><p>Không duyệt nếu chưa xác minh người đăng và căn cứ vai trò ngoài hệ thống. Kết quả hết hạn sau 90 ngày và có thể thu hồi.</p>{rolesQueue.map(x=><ReviewCard key={x.id} item={x} kind="role" busy={busy} onAction={(id,p)=>act('role',id,p)}/>)}</>}<h3>Sự kiện ({events.length})</h3>{events.map(x=><ReviewCard key={x.id} item={x} kind="event" busy={busy} onAction={(id,p)=>act('event',id,p)}/>)}</>}</section>;
}
