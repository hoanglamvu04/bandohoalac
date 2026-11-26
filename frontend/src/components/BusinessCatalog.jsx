import {useState,useEffect,useRef} from 'react';
import {Link} from 'react-router-dom';
import {getBusinessCatalog,getManagedBusinessCatalog,createBusinessService,setBusinessServiceActive,createBusinessRequest,getMyBusinessRequests,getBusinessInbox,actBusinessRequest} from '../services/api.js';
import '../spatial-discovery.css';

const money=x=>x===null?'Liên hệ để báo giá':Number(x).toLocaleString('vi-VN')+' đ';
const status={PENDING:'Chờ xác nhận',ACCEPTED:'Đã xác nhận',DECLINED:'Đã từ chối',CANCELLED:'Đã hủy'};
function RequestList({items,owner,busy,onAct}){
 return <ul>{items.map(x=><li key={x.id}><b>{x.serviceTitle}</b> · {new Date(x.startsAt).toLocaleString('vi-VN')} · {status[x.status]||x.status}
 {Date.parse(x.startsAt)>Date.now()&&<div>
 {owner&&x.status==='PENDING'&&<><button disabled={busy} type="button" onClick={()=>onAct(x.id,'ACCEPT')}>Xác nhận</button> <button disabled={busy} type="button" onClick={()=>onAct(x.id,'DECLINE')}>Từ chối</button></>}
 {((!owner&&x.status==='PENDING')||x.status==='ACCEPTED')&&<button disabled={busy} type="button" onClick={()=>onAct(x.id,'CANCEL')}>Hủy</button>}
 </div>}</li>)}</ul>;
}
export function PublicBusinessCatalog({placeId,user}){
 const [open,setOpen]=useState(false),[items,setItems]=useState([]),[requests,setRequests]=useState([]),[slot,setSlot]=useState(''),[selected,setSelected]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const seq=useRef(0);
 async function load(){const id=++seq.current;setBusy(true);setError('');try{const result=await getBusinessCatalog(placeId);const own=user?await getMyBusinessRequests(placeId):{items:[]};if(id===seq.current){setItems(result.items||[]);setRequests(own.items||[]);}}catch(e){if(id===seq.current)setError(e.message||'Chưa tải được dịch vụ.');}finally{if(id===seq.current)setBusy(false);}}
 useEffect(()=>{setItems([]);setRequests([]);setSelected('');setSlot('');if(open)void load();return()=>{seq.current++;};},[open,placeId,user?.id]);
 async function send(e){e.preventDefault();if(!selected||!slot)return;const id=++seq.current;setBusy(true);setError('');try{const time=new Date(slot).toISOString();await createBusinessRequest(selected,time);if(id===seq.current){setSlot('');setSelected('');void load();}}catch(e){if(id===seq.current){setError(e.message||'Không thể gửi yêu cầu.');setBusy(false);}}}
 async function act(id,action){setBusy(true);setError('');try{await actBusinessRequest(id,action);void load();}catch(e){setError(e.message);setBusy(false);}}
 return <section className="hm-spatial-panel"><details open={open} onToggle={e=>setOpen(e.target.open)}><summary>Danh mục dịch vụ và lịch hẹn đối tác</summary>
 <p>Bảng giá do đối tác cung cấp. Yêu cầu hẹn không phải đơn hàng hay thanh toán; chờ đối tác xác nhận.</p>
 {busy&&<p>Đang xử lý…</p>}{error&&<p role="alert">{error}</p>}
 {!busy&&!items.length&&<p>Chưa có dịch vụ công khai.</p>}
 <ul>{items.map(s=><li key={s.id}><b>{s.title}</b> — {money(s.priceVnd)}{s.description&&<p>{s.description}</p>}{user&&<button type="button" disabled={busy} onClick={()=>setSelected(s.id)}>Chọn lịch hẹn</button>}</li>)}</ul>
 {!user&&items.length>0&&<Link to="/login">Đăng nhập để gửi yêu cầu</Link>}
 {user&&selected&&<form onSubmit={send}><label>Giờ hẹn (giờ thiết bị)<input required type="datetime-local" value={slot} onChange={e=>setSlot(e.target.value)} step={1800}/></label><button disabled={busy} type="submit">Gửi yêu cầu</button></form>}
 {user&&requests.length>0&&<><b>Yêu cầu của tôi</b><RequestList items={requests} owner={false} busy={busy} onAct={act}/></>}
 </details></section>;
}
export function PartnerCatalogManager({places=[]}){
 const eligible=places.filter(x=>x.categorySlug&&x.categorySlug!=='bat-dong-san'&&x.partnerStatus==='ACTIVE'&&(x.managerRole==='OWNER'||x.partnerRole==='OWNER'));
 const [placeId,setPlaceId]=useState(''),[items,setItems]=useState([]),[inbox,setInbox]=useState(null),[title,setTitle]=useState(''),[description,setDescription]=useState(''),[price,setPrice]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const seq=useRef(0);
 async function load(id=placeId){const key=++seq.current;setError('');setBusy(true);try{const [catalog,requests]=await Promise.all([getManagedBusinessCatalog(id),getBusinessInbox(id)]);if(key===seq.current){setItems(catalog.items||[]);setInbox(requests);}}catch(e){if(key===seq.current)setError(e.message);}finally{if(key===seq.current)setBusy(false);}}
 useEffect(()=>{setItems([]);setInbox(null);if(placeId)void load(placeId);return()=>{seq.current++;};},[placeId]);
 async function change(task){const key=++seq.current;setError('');setBusy(true);try{await task();if(key===seq.current)void load();}catch(e){if(key===seq.current){setError(e.message);setBusy(false);}}}
 if(!eligible.length)return null;
 return <section className="hm-spatial-panel"><h2>Dịch vụ & yêu cầu hẹn</h2><p>Chỉ chủ quản lý của đối tác đang hoạt động. Không có thu tiền hoặc thông tin liên hệ khách trong danh sách.</p>
 <label>Địa điểm<select disabled={busy} value={placeId} onChange={e=>setPlaceId(e.target.value)}><option value="">Chọn địa điểm</option>{eligible.map(x=><option key={x.placeId} value={x.placeId}>{x.name}</option>)}</select></label>
 {error&&<p role="alert">{error}</p>}{busy&&<p>Đang xử lý…</p>}
 {placeId&&<><form onSubmit={e=>{e.preventDefault();void change(async()=>{await createBusinessService(placeId,{title,description,priceVnd:price===''?null:Number(price)});setTitle('');setDescription('');setPrice('');});}}>
 <label>Tên dịch vụ<input required minLength={2} maxLength={120} value={title} onChange={e=>setTitle(e.target.value)}/></label>
 <label>Mô tả<input maxLength={500} value={description} onChange={e=>setDescription(e.target.value)}/></label>
 <label>Giá (đ, trống nếu báo giá)<input type="number" min={0} max={100000000000} step={1} value={price} onChange={e=>setPrice(e.target.value)}/></label>
 <button type="submit" disabled={busy}>Thêm dịch vụ</button></form>
 <ul>{items.map(s=><li key={s.id}>{s.title} · {money(s.priceVnd)} · {s.active?'Đang hiện':'Đã ẩn'} <button type="button" disabled={busy} onClick={()=>void change(()=>setBusinessServiceActive(placeId,s.id,!s.active))}>{s.active?'Ẩn dịch vụ':'Hiện dịch vụ'}</button></li>)}</ul>
 {inbox&&<><h3>30 ngày qua</h3><p>{inbox.last30Days?.total||0} yêu cầu · {inbox.last30Days?.accepted||0} xác nhận · {inbox.last30Days?.pending||0} đang chờ</p><h3>Lịch hẹn</h3><RequestList items={inbox.items||[]} owner busy={busy} onAct={(id,action)=>void change(()=>actBusinessRequest(id,action))}/></>}
 <button type="button" disabled={busy} onClick={()=>void load()}>Làm mới</button></>}
 </section>;
}
