const items=['☕ Cafe','🍜 Ăn uống','🏡 Homestay','📸 Check-in','🏘 Villa'];
export default function CategoryBar(){return <div className="categories">{items.map(x=><button key={x}>{x}</button>)}</div>}
