// DEMO-ONLY placeholder data. Rendered only while the backend request is
// still in flight or fails (e.g. no network in local dev). It is never sent
// to the server and never mixed with real API results - each page replaces
// this array outright once `getPlaces()` / `getNearbyPlaces()` resolves.
export const DEMO_FALLBACK_PLACES = [
  { id: 'demo-1', name: 'The Lake Coffee', category: 'Cafe', rating: 4.8, address: 'Thạch Hòa, Hòa Lạc', lat: 21.007, lng: 105.525 },
  { id: 'demo-2', name: 'Forest View Homestay', category: 'Homestay', rating: 4.9, address: 'Yên Bình, Hòa Lạc', lat: 21.028, lng: 105.497 },
  { id: 'demo-3', name: 'Lucia Villa', category: 'Villa', rating: 4.7, address: 'Tiến Xuân, Hòa Lạc', lat: 20.994, lng: 105.478 },
  { id: 'demo-4', name: 'Đồi ngắm hoàng hôn', category: 'Check-in', rating: 4.8, address: 'Khu vực Hòa Lạc', lat: 21.014, lng: 105.548 },
  { id: 'demo-5', name: 'Bếp Nhà Đồi', category: 'Ăn uống', rating: 4.6, address: 'Thạch Hòa, Hòa Lạc', lat: 21.001, lng: 105.512 }
];
