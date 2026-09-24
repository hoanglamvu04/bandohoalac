import {
  Camera,
  Coffee,
  FerrisWheel,
  Home,
  Sparkles,
  Utensils,
  Building2,
  Compass
} from 'lucide-react';

const DEFAULT_ITEMS = [
  { value:'all', label:'Tất cả', desc:'Khám phá mọi địa điểm', icon:Compass, image:'/images/categories/all.jpg' },
  { value:'Ăn uống', label:'Ăn uống', desc:'Nhà hàng, quán ăn địa phương', icon:Utensils, image:'/images/categories/food.jpg' },
  { value:'Cafe', label:'Cafe', desc:'Không gian đẹp, đồ uống ngon', icon:Coffee, image:'/images/categories/cafe.jpg' },
  { value:'Check-in', label:'Check-in', desc:'Góc sống ảo, điểm tham quan', icon:Camera, image:'/images/categories/checkin.jpg' },
  { value:'Homestay', label:'Homestay', desc:'Nghỉ dưỡng, trải nghiệm local', icon:Home, image:'/images/categories/homestay.jpg' },
  { value:'Trải nghiệm', label:'Trải nghiệm', desc:'Khám phá thiên nhiên', icon:FerrisWheel, image:'/images/categories/experience.jpg' },
  { value:'Villa', label:'Villa', desc:'Không gian riêng tư', icon:Building2, image:'/images/categories/villa.jpg' }
];

export default function CategoryBar({ active='all', onChange=()=>{}, compact=false, categories=[] }) {
  const items = categories.length
    ? categories.map((category,index)=>({...DEFAULT_ITEMS[(index % (DEFAULT_ITEMS.length-1))+1], value:category.name, label:category.name}))
    : DEFAULT_ITEMS;

  if (compact) {
    return (
      <div className="category-bar compact modern-category-bar">
        {items.map((item)=>{
          const Icon=item.icon;
          return <button key={item.value} type="button" className={active===item.value?'category-chip active':'category-chip'} onClick={()=>onChange(item.value)}><span className="category-icon"><Icon size={18}/></span>{item.label}</button>;
        })}
      </div>
    );
  }

  return (
    <div className="category-card-grid">
      {items.map((item)=>{
        const Icon=item.icon;
        return (
          <button key={item.value} type="button" className={active===item.value?'category-card active':'category-card'} onClick={()=>onChange(item.value)}>
            <div className="category-card-media" style={{backgroundImage:`url(${item.image})`}}>
              <div className="category-card-icon"><Icon size={20}/></div>
            </div>
            <div className="category-card-body">
              <h3>{item.label}</h3>
              <p>{item.desc}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
