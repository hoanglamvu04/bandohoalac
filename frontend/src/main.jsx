import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import './style.css';
import './premium.css';
import './map-fix.css';
import './directions.css';

// Do not wrap the whole app in React.StrictMode here.
// In React 18 development, StrictMode intentionally mounts effects twice.
// That caused MapLibre to initialize twice, request the first viewport twice,
// and duplicate /places + /categories calls during local development.
createRoot(document.getElementById('root')).render(
  <ToastProvider>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </ToastProvider>
);
