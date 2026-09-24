import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import './style.css';
import './premium.css';
import './modern-ui.css';
import './map-fix.css';
import './directions.css';
import './map-workspace.css';
import './footer.css';
import './hola-ui-overhaul.css';
import './hola-home-redesign.css';
import './hola-blue-modern.css';

createRoot(document.getElementById('root')).render(
  <ToastProvider>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </ToastProvider>
);
