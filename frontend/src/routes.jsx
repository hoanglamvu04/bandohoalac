import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import MapPage from './pages/MapPage';
import HomePage from './pages/HomePage';
import PlaceDetail from './pages/PlaceDetail';
import ProfilePage from './pages/ProfilePage';
import Leaderboard from './pages/Leaderboard';

export const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/home', element: <HomePage /> },
  { path: '/map', element: <MapPage /> },
  { path: '/place/:id', element: <PlaceDetail /> },
  { path: '/profile', element: <ProfilePage /> },
  { path: '/leaderboard', element: <Leaderboard /> }
]);
