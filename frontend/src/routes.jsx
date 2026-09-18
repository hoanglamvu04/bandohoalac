import { createBrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import HomePage from './pages/HomePage.jsx';
import MapPage from './pages/MapPage.jsx';
import PlaceDetail from './pages/PlaceDetail.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import Contribute from './pages/Contribute.jsx';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'map', element: <MapPage /> },
      { path: 'place/:id', element: <PlaceDetail /> },
      { path: 'contribute', element: <Contribute /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'leaderboard', element: <Leaderboard /> }
    ]
  }
]);
