// First-party listing metrics; separate from X-HUB analytics consent.
export const HOUSING_METRICS_KEY='hola_housing_metrics_opt_in_v1';
export const HOUSING_METRICS_EVENT='hola:housing-metrics-choice';
export function privacyBlocked(root=typeof window==='undefined'?null:window){
  return !root||root.navigator?.globalPrivacyControl===true||root.navigator?.doNotTrack==='1'||root.navigator?.msDoNotTrack==='1';
}
export function hasHousingMetricsConsent(root=typeof window==='undefined'?null:window){
  if(privacyBlocked(root))return false;
  try{return root.localStorage.getItem(HOUSING_METRICS_KEY)==='1';}catch{return false;}
}
export function setHousingMetricsConsent(enabled,root=typeof window==='undefined'?null:window){
  if(!root||enabled&&privacyBlocked(root))return false;
  try{
    if(enabled)root.localStorage.setItem(HOUSING_METRICS_KEY,'1');
    else root.localStorage.removeItem(HOUSING_METRICS_KEY);
    root.dispatchEvent(new Event(HOUSING_METRICS_EVENT));
    return true;
  }catch{return false;}
}
