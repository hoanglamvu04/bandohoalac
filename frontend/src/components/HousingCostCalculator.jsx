import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { estimateHousingCosts } from '../lib/housingCosts.js';
import '../housing-cost-calculator.css';

const currency = (amount) => amount === null ? 'Chưa cập nhật' : new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
export default function HousingCostCalculator({ housing }) {
  const [people,setPeople] = useState('1');
  const [kwh,setKwh] = useState('80');
  const [vehicles,setVehicles] = useState('1');
  const result = [people,kwh,vehicles].some((value) => value.trim() === '') ? null
    : estimateHousingCosts(housing,{people:Number(people),kwh:Number(kwh),vehicles:Number(vehicles)});
  return (
    <section className="place-v2-card hm-rental-cost" data-testid="housing-cost-calculator">
      <div className="place-v2-section-title"><Calculator size={19}/><h2>Dự tính chi phí vào ở</h2></div>
      <p>Điều chỉnh mức sử dụng dự kiến. Chỉ tính từ đơn giá của tin này, không tự giả định phí chưa có.</p>
      <div className="hm-rental-inputs">
        {[['Số người ở',people,setPeople,1,20],['Điện mỗi tháng (kWh)',kwh,setKwh,0,2000],['Số xe gửi',vehicles,setVehicles,0,20]].map(([label,value,setValue,min,max]) => (
          <label key={label}>{label}<input type="number" min={min} max={max} step="1" inputMode="numeric"
            value={value} onChange={(e)=>setValue(e.target.value)}/></label>
        ))}
      </div>
      {!result ? <p role="alert">Nhập số nguyên hợp lệ trong giới hạn hiển thị.</p> : <>
        <dl>{[...result.monthly,['Tiền cọc',result.deposit]].map(([label,amount])=><div key={label}><dt>{label}</dt><dd>{currency(amount)}</dd></div>)}</dl>
        <div className="hm-rental-totals" aria-live="polite">
          <div><small>{result.missingMonthly.length?'Chi phí tháng đã biết':'Chi phí dự kiến mỗi tháng'}</small><strong data-testid="housing-monthly-cost">{currency(result.knownMonthly)}</strong></div>
          <div><small>{result.missingFirstMonth.length?'Ngân sách tháng đầu đã biết':'Ngân sách tháng đầu (gồm cọc)'}</small><strong data-testid="housing-first-month-cost">{currency(result.knownFirstMonth)}</strong></div>
        </div>
        {!!result.missingFirstMonth.length && <p role="status">Chưa tính: {result.missingFirstMonth.join(', ')}. Cần hỏi lại người đăng; tổng thực tế có thể cao hơn.</p>}
      </>}
      <small>Ước tính theo mức dùng nhập vào, chưa bao gồm các phụ phí khác ngoài thông tin đã công bố; không phải báo giá cam kết.</small>
    </section>
  );
}
