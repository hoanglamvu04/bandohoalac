import { lazy, Suspense } from 'react';

const MapView = lazy(() => import('./MapView.jsx'));

export default function LazyMapView(props) {
  return (
    <Suspense
      fallback={(
        <div style={{
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          background: '#f1f3ef'
        }}>
          Đang tải bản đồ Hòa Lạc...
        </div>
      )}
    >
      <MapView {...props} />
    </Suspense>
  );
}
