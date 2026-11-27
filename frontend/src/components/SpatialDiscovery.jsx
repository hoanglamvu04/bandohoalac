import { useEffect,useRef,useState } from 'react';
import { Link } from 'react-router-dom';
import { ChartNoAxesColumnIncreasing, ChevronDown, TriangleAlert } from 'lucide-react';
import { searchRouteCorridor,getMapAreaSummary } from '../services/api.js';
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

export function LocalActivityFeed({mapData}){
 const items=(mapData?.features||[]).filter(f=>['EVENT','ALERT','FLOOD','ROAD_CLOSURE'].includes(f.properties?.layerType))
 .slice(0,30);
 return <details className="hm-spatial-panel"><summary className="hm-tool-summary"><span className="hm-tool-symbol amber"><TriangleAlert size={18}/></span><span><strong>Sự kiện và cảnh báo địa phương</strong><small>Thông tin từ các lớp đang bật</small></span><ChevronDown size={16} className="hm-tool-chevron"/></summary><p>Từ lớp dữ liệu bản đồ đang tải. Không phải danh sách đầy đủ hay cảnh báo thời gian thực.</p>
 {!items.length&&<p>Chưa có mục phù hợp trong các lớp đang tải.</p>}
 <ul>{items.map((f,i)=>{const x=f.properties||{};return <li key={String(f.id||i)+'-'+i}><b>{x.name||'Thông tin địa phương'}</b> · {x.layerType}<br/><small>{x.sourceLabel||'Chưa có nhãn nguồn'} · {x.verificationStatus==='VERIFIED'?'Đã xác minh theo hệ thống':'Chưa có xác minh'}{x.validUntil?' · đến '+new Date(x.validUntil).toLocaleString('vi-VN'):''}</small></li>;})}</ul></details>;
}
