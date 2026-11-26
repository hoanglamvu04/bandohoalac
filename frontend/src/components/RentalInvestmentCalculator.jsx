import {useState} from 'react';
import {rentalInvestment} from '../lib/rentalInvestment.js';
const FIELDS=[['capital','Tổng vốn đầu tư (đ)'],['rooms','Số phòng'],['rent','Giá thuê/phòng/tháng (đ)'],['occupancy','Công suất thuê (%)'],['monthlyCosts','Tổng chi phí vận hành/tháng (đ)']];
export default function RentalInvestmentCalculator(){
 const [input,setInput]=useState({capital:'',rooms:'',rent:'',occupancy:'',monthlyCosts:''});
 const result=FIELDS.every(([key])=>input[key].trim()!=='')?rentalInvestment(Object.fromEntries(Object.entries(input).map(([k,v])=>[k,Number(v)]))):null;
 const money=v=>new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(v)+' đ';
 return <details className="hm-market-explorer" data-testid="rental-investment"><summary><strong>Tính dòng tiền đầu tư nhà trọ</strong></summary>
  <div className="hm-rental-inputs">{FIELDS.map(([key,label])=><label key={key}>{label}<input type="number" min={key==='capital'||key==='rooms'?1:0}
   max={key==='occupancy'?100:undefined} step={key==='occupancy'?'0.1':'1'} value={input[key]} onChange={e=>setInput(x=>({...x,[key]:e.target.value}))}/></label>)}</div>
  {result?<dl><dt>Doanh thu/tháng</dt><dd>{money(result.gross)}</dd><dt>Dòng tiền vận hành/tháng</dt><dd>{money(result.net)}</dd><dt>Hoàn vốn đơn giản</dt><dd>{result.paybackYears==null?'Không hoàn vốn với giả định này':result.paybackYears.toLocaleString('vi-VN',{maximumFractionDigits:1})+' năm'}</dd></dl>:<p>Nhập đủ năm thông số hợp lệ để tính.</p>}
  <small>Giả định của bạn, không phải cam kết lợi nhuận. Nhập đủ chi phí, thuế, bảo trì và vốn cần thiết; chưa tính chiết khấu dòng tiền, vay nợ hoặc tăng giá tài sản.</small>
 </details>;
}
