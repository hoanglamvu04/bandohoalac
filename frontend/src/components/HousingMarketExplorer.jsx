import {useRef,useState,useEffect} from 'react';
import {getHousingMarketGrid,getHousingMarketTrend} from '../services/api.js';
import {focusHolaMapPoint} from '../mapInteractionBridge.js';
import '../housing-market-explorer.css';

const vnd=v=>v==null?'Chưa đủ mẫu':new Intl.NumberFormat('vi-VN').format(v)+' đ';
export default function HousingMarketExplorer({viewport,filters}){
 const [data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const request=useRef(null);
 useEffect(()=>()=>request.current?.abort(),[]);
 async function load(){
  request.current?.abort();const c=new AbortController();request.current=c;setBusy(true);setError('');setData(null);
  try{
   const base={listingType:filters.listingType||'SALE',propertyType:filters.propertyType||undefined};
   if(!viewport||!['west','south','east','north'].every(k=>Number.isFinite(viewport[k]))||viewport.east-viewport.west>0.6||viewport.north-viewport.south>0.6)throw new Error('Phóng bản đồ tới vùng cần xem.');
   const [grid,trend]=await Promise.all([getHousingMarketGrid({...base,...Object.fromEntries(['west','south','east','north'].map(k=>[k,viewport[k]]))},{signal:c.signal}),getHousingMarketTrend(base,{signal:c.signal})]);
   if(!c.signal.aborted)setData({grid,trend});
  }catch(e){if(!c.signal.aborted)setError(e.message);}
  finally{if(!c.signal.aborted)setBusy(false);}
 }
 const cells=data?.grid?.cells||[];
 const lo=cells.length?Math.min(...cells.map(x=>x.median)):0,hi=cells.length?Math.max(...cells.map(x=>x.median)):0;
 const minX=cells.length?Math.min(...cells.map(x=>x.col)):0,maxX=cells.length?Math.max(...cells.map(x=>x.col)):0;
 const minY=cells.length?Math.min(...cells.map(x=>x.row)):0,maxY=cells.length?Math.max(...cells.map(x=>x.row)):0;
 const colors=['#2d775a','#78a772','#e5bd69','#bd7254'];
 return <section className="hm-market-explorer" data-testid="housing-market-explorer">
  <strong>Lưới giá theo khu vực & xu hướng tháng</strong>
  <p>Chỉ dùng tin công khai có giá và diện tích hợp lệ. Không tính DEMO.</p>
  <button type="button" className="hm-intel-primary" disabled={busy} onClick={load}>{busy?'Đang tải…':'Xem lưới giá và xu hướng'}</button>
  {error&&<p role="alert">{error}</p>}
  {data&&<>
   <small>{data.grid.listingType==='SALE'?'Giá chào bán / m²':'Giá thuê chào / tháng'} · từ {data.grid.minSample} tin/ô</small>
   {cells.length?<><div className="hm-market-grid" style={{gridTemplateColumns:'repeat('+Math.max(1,maxX-minX+1)+',minmax(16px,1fr))',gridTemplateRows:'repeat('+Math.max(1,maxY-minY+1)+',minmax(16px,1fr))'}}>
    {cells.map(cell=><button key={cell.col+':'+cell.row} type="button"
      style={{gridColumn:cell.col-minX+1,gridRow:maxY-cell.row+1,background:colors[Math.min(3,Math.floor(hi===lo?0:(cell.median-lo)/(hi-lo)*4))]}}
      title={vnd(cell.median)+' · '+cell.sampleCount+' tin'}
      aria-label={'Ô giá '+vnd(cell.median)+', '+cell.sampleCount+' tin; mở bản đồ'}
      onClick={()=>focusHolaMapPoint({lng:(cell.col+.5)*data.grid.cellDegrees,lat:(cell.row+.5)*data.grid.cellDegrees,zoom:14})}/>)}
   </div><div className="hm-market-legend"><span>{vnd(lo)}</span><span>{vnd(hi)}</span></div><small>Bắc ở trên · bấm ô để mở khu vực. Lưới tổng hợp không phải nền bản đồ quy hoạch.</small></>:<p>Chưa có ô đủ số mẫu.</p>}
   <small>{data.grid.disclaimer}</small>
   <h4>Giá chào trung vị theo tháng, toàn vùng (đ/m²{data.trend.listingType==='RENT'?'/tháng':''})</h4>
   {data.trend.items?.length?<table className="hm-intel-table"><thead><tr><th>Tháng</th><th>Số tin</th><th>Trung vị</th></tr></thead><tbody>{data.trend.items.map(x=><tr key={x.month}><td>{x.month}</td><td>{x.sampleCount}</td><td>{vnd(x.medianVndM2)}</td></tr>)}</tbody></table>:<p>Chưa có ảnh chụp dữ liệu tháng. Không tạo lịch sử giả.</p>}
   <small>{data.trend.disclaimer}</small>
  </>}
 </section>;
}
