import {useState} from 'react';
import {getHolaMapInstance} from '../mapInteractionBridge.js';
import {readSavedViews,validateSavedView,VIEW_KEY} from '../lib/mapSavedViews.js';

export default function MapSavedViews({activeLayers,validLayers,onRestoreLayers}){
 const [items,setItems]=useState(()=>{try{return readSavedViews(window.localStorage);}catch{return [];}});
 const [name,setName]=useState(''),[error,setError]=useState('');
 function persist(next){
  try{window.localStorage.setItem(VIEW_KEY,JSON.stringify(next));setItems(next);setError('');return true;}
  catch{setError('Trình duyệt không cho lưu góc nhìn.');return false;}
 }
 function save(e){
  e.preventDefault();const map=getHolaMapInstance();
  if(!map?.getContainer()?.isConnected){setError('Bản đồ chưa sẵn sàng.');return;}
  const center=map.getCenter();
  const item=validateSavedView({id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9),name,
    lng:center.lng,lat:center.lat,zoom:map.getZoom(),layers:activeLayers});
  if(!item){setError('Tên hoặc góc nhìn chưa hợp lệ.');return;}
  if(items.length>=10){setError('Tối đa 10 góc nhìn. Hãy xóa một mục trước.');return;}
  if(persist([item,...items]))setName('');
 }
 function restore(item){
  const map=getHolaMapInstance();
  if(!map?.getContainer()?.isConnected){setError('Bản đồ chưa sẵn sàng.');return;}
  onRestoreLayers(item.layers.filter(x=>validLayers.includes(x)));
  map.jumpTo({center:[item.lng,item.lat],zoom:item.zoom});setError('');
 }
 return <details className="hm-housing-intel" data-testid="saved-map-views"><summary className="hm-housing-intel-heading"><strong>Góc nhìn bản đồ đã lưu</strong></summary>
  <div className="hm-housing-intel-body">
   <small>Chỉ lưu góc nhìn và lớp dữ liệu khi bạn chủ động bấm lưu. Lưu trên trình duyệt này, không đồng bộ tài khoản hoặc gửi máy chủ.</small>
   <form onSubmit={save}><label>Tên góc nhìn<input maxLength={60} required value={name} onChange={e=>setName(e.target.value)}/></label>
   <button type="submit" className="hm-intel-primary">Lưu góc nhìn hiện tại</button></form>
   {error&&<p role="alert">{error}</p>}
   {items.map(item=><div key={item.id} className="hm-intel-amenity-row"><button type="button" onClick={()=>restore(item)}>{item.name}</button><button type="button" aria-label={'Xóa góc nhìn '+item.name} onClick={()=>persist(items.filter(x=>x.id!==item.id))}>Xóa</button></div>)}
  </div></details>;
}
