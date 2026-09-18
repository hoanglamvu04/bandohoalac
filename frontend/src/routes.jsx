import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import MapPage from './pages/MapPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />
  },
  {
    path: '/map',
    element: <MapPage />
  }
]);
