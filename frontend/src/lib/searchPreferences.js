export const SEARCH_PREFS_KEY='hola_search_preferences_v1';
export const SEARCH_CATEGORIES=[['an-uong','Ăn uống'],['cafe','Cà phê'],['truong-hoc','Trường học'],['y-te','Y tế'],['sieu-thi','Mua sắm'],['dich-vu','Dịch vụ'],['bat-dong-san','Bất động sản'],['khu-du-lich','Vui chơi']];
const allowed=SEARCH_CATEGORIES.map(x=>x[0]);
export function safeHistoryText(input){
 const s=String(input||'').trim();
 return s.length>=2&&s.length<=80&&!/[@:/\\]|(?:\d[\s.,-]*){7,}|-?\d{1,3}\.\d{3,}/.test(s)&&!/gan toi|quanh toi|vi tri cua toi/.test(s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase());
}
export function normalizeSearchPreferences(value){
 const v=value&&typeof value==='object'?value:{};
 const categories=Array.isArray(v.categories)?[...new Set(v.categories.filter(x=>allowed.includes(x)))].slice(0,5):[];
 const remember=v.remember===true;
 const history=remember&&Array.isArray(v.history)?[...new Set(v.history.filter(s=>typeof s==='string'&&safeHistoryText(s)).map(s=>s.trim()))].slice(0,8):[];
 return {remember,categories,history};
}
export function readSearchPreferences(storage){try{return normalizeSearchPreferences(JSON.parse(storage.getItem(SEARCH_PREFS_KEY)||'{}'));}catch{return normalizeSearchPreferences({});}}
export function rememberSearch(prefs,query){
 const x=normalizeSearchPreferences(prefs);if(!x.remember||!safeHistoryText(query))return x;
 return {...x,history:[query.trim(),...x.history.filter(s=>s!==query.trim())].slice(0,8)};
}
