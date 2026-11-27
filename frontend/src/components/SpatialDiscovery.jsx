import { useEffect,useRef,useState } from 'react';
import { Link } from 'react-router-dom';
import { ChartNoAxesColumnIncreasing, ChevronDown, TriangleAlert } from 'lucide-react';
import { searchRouteCorridor,getMapAreaSummary,getMapLayers } from '../services/api.js';
import { ACTIVITY_TYPES, ACTIVITY_LABELS, localActivityItems, validActivityBounds } from '../lib/localActivity.js';
import '../spatial-discovery.css';

export function RouteNearbyPlaces({route}){
 const [distance,setDistance]=useState(500),[category,setCategory]=useState(''),[result,setResult]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const sequence=useRef(0);
 useEffect(()=>{sequence.current++;setResult(null);setBusy(false);setError('');return()=>{sequence.current++;};},[route]);
 const coordinates=route?.geometry?.coordinates;
 async function search(){
  const id=++sequence.current;setBusy(true);setError('');setResult(null);
  try{
   const data=await searchRouteCorridor({coordinates,distanceMeters:distance,category:category||undefined});
   if(id===sequence.current)setResult(data);
  }catch(e){if(id===sequence.current)setError(e.response?.data?.error||'Chưa tra cứu được tiện ích dọc tuyến.');}
  finally{if(id===sequence.current)setBusy(false);}
 }
 if(!Array.isArray(coordinates)||coordinates.length<2)return null;
 return <details className="hm-spatial-panel"><summary>Tiện ích dọc tuyến đường</summary>
 <p>Chỉ tìm địa điểm đã công khai; khoảng cách tới tuyến là đường thẳng, không phải thời gian vòng xe.</p>
 <label>Bán kính <select value={distance} onChange={e=>{setDistance(Number(e.target.value));setResult(null);}} disabled={busy}><option value={200}>200 m</option><option value={500}>500 m</option><option value={1000}>1 km</option></select></label>
 <label>Danh mục <select value={category} onChange={e=>{setCategory(e.target.value);setResult(null);}} disabled={busy}><option value="">Tất cả tiện ích</option><option value="an-uong">Ăn uống</option><option value="cafe">Cà phê</option><option value="y-te">Y tế</option><option value="nhien-lieu-sac">Nhiên liệu / sạc</option></select></label>
 <button type="button" onClick={search} disabled={busy||coordinates.length>4000}>{busy?'Đang tìm…':'Tìm dọc tuyến'}</button>
 {coordinates.length>4000&&<p>Tuyến quá chi tiết; hãy tìm trên chặng ngắn hơn.</p>}
 {error&&<p role="alert">{error}</p>}{result&&<><p>{result.items.length} địa điểm{result.hasMore?' đầu tiên':''}</p><ul>{result.items.map(x=><li key={x.id}><Link to={'/place/'+x.id}>{x.name}</Link> · {x.distanceMeters} m</li>)}</ul></>}
 </details>;
}

export function AreaProfile({viewport}){
 const [result,setResult]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const sequence=useRef(0);
 useEffect(()=>()=>{sequence.current++;},[]);
 async function load(){
  const id=++sequence.current;setBusy(true);setError('');setResult(null);
  try{
   const {west,east,south,north}=viewport||{};
   const data=await getMapAreaSummary({west,east,south,north});
   if(id===sequence.current)setResult(data);
  }catch(e){if(id===sequence.current)setError(e.response?.data?.error||'Hãy phóng to khu vực cần xem.');}
  finally{if(id===sequence.current)setBusy(false);}
 }
 return <details className="hm-spatial-panel"><summary className="hm-tool-summary"><span className="hm-tool-symbol"><ChartNoAxesColumnIncreasing size={18}/></span><span><strong>Hồ sơ vùng đang xem</strong><small>Thống kê địa điểm trong khu vực</small></span><ChevronDown size={16} className="hm-tool-chevron"/></summary><p>Đếm địa điểm công khai theo danh mục trong khung bản đồ tại lúc tra cứu.</p><button type="button" onClick={load} disabled={busy||!viewport}>{busy?'Đang tải…':'Thống kê vùng này'}</button>{error&&<p role="alert">{error}</p>}{result&&<><p>{result.notice}</p><div className="hm-area-summary-grid">{result.items.map(x=><div key={x.slug}><span>{x.name}</span><b>{x.count}</b></div>)}</div></>}</details>;
}

export function HousingAreaResults({result,onClear}){
 if(!result)return null;
 return <div className="hm-spatial-panel"><b>Kết quả khoanh vùng · {result.meta?.total??result.items.length} tin</b><p>Hiển thị tối đa 30 tin phù hợp bộ lọc lúc tra cứu.</p><button type="button" onClick={onClear}>Xóa vùng</button><ul>{result.items.map(x=><li key={x.id}><Link to={'/place/'+x.id}>{x.name}</Link></li>)}</ul>{result.items.length===0&&<p>Chưa có tin phù hợp.</p>}</div>;
}

export function LocalActivityFeed({mapData,viewport}){
 const [kind,setKind]=useState('ALL'),[areaData,setAreaData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const request=useRef(null);
 useEffect(()=>()=>request.current?.abort(),[]);
 async function loadArea(){
   const bounds=validActivityBounds(viewport);
   if(!bounds){setError('Hãy phóng to khu vực muốn xem.');return;}
   request.current?.abort();
   const controller=new AbortController();request.current=controller;setBusy(true);setError('');
   try{
     const data=await getMapLayers({types:ACTIVITY_TYPES,bounds},{signal:controller.signal});
     if(!controller.signal.aborted){
       if(data?.type!=='FeatureCollection')throw new Error('Invalid activity response');
       setAreaData(data);
     }
   }catch(e){if(!controller.signal.aborted)setError('Không tải được thông tin khu vực. Vui lòng thử lại.');}
   finally{if(!controller.signal.aborted)setBusy(false);}
 }
 const items=localActivityItems(areaData||mapData,kind);
 return <details className="hm-spatial-panel"><summary className="hm-tool-summary"><span className="hm-tool-symbol amber"><TriangleAlert size={18}/></span><span><strong>Sự kiện và cảnh báo địa phương</strong><small>Bảng tin theo khu vực bản đồ</small></span><ChevronDown size={16} className="hm-tool-chevron"/></summary>
 <div className="hm-activity-toolbar"><button type="button" onClick={loadArea} disabled={busy}>{busy?'Đang tải…':'Tải tin trong vùng đang xem'}</button>
 <label>Loại tin<select value={kind} onChange={event=>setKind(event.target.value)}><option value="ALL">Tất cả</option>{ACTIVITY_TYPES.map(type=><option key={type} value={type}>{ACTIVITY_LABELS[type]}</option>)}</select></label></div>
 <p>{areaData?'Theo vùng tại thời điểm bấm tải, kể cả lớp đang tắt.':'Từ các lớp đang hiển thị.'} Hiển thị tối đa 30 mục; không phải nguồn cảnh báo thời gian thực.</p>
 {areaData&&<button type="button" onClick={()=>setAreaData(null)}>Về lớp đang hiển thị</button>}
 {error&&<p role="alert">{error}</p>}
 {!items.length&&<p>Chưa có thông tin phù hợp trong dữ liệu hiện có.</p>}
 <ul>{items.map((f,i)=>{const x=f.properties||{};return <li key={String(f.id||i)+'-'+i}><b>{x.name||'Thông tin địa phương'}</b> · {ACTIVITY_LABELS[x.layerType]}<br/><small>{x.sourceLabel||'Chưa có nhãn nguồn'} · {x.verificationStatus==='VERIFIED'?'Đã xác minh theo hệ thống':'Chưa có xác minh'}{x.eventStartsAt?' · bắt đầu '+new Date(x.eventStartsAt).toLocaleString('vi-VN'):''}{x.validUntil?' · đến '+new Date(x.validUntil).toLocaleString('vi-VN'):''}</small></li>;})}</ul></details>;
}
