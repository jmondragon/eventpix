import { Routes, Route } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { Text } from '@mantine/core';
import Events from './pages/Events';

import EventsNew from './pages/EventsNew';
import EventDetails from './pages/EventDetails';
import ModerationQueue from './pages/ModerationQueue';
import Slideshow from './pages/Slideshow';
import Login from './pages/Login';
import { useAuth } from './providers/AuthProvider';
import { Navigate, Outlet } from 'react-router-dom';

import Dashboard from './pages/Dashboard';
import MembershipPage from './pages/MembershipPage';
import SettingsPage from './pages/SettingsPage';

// function Dashboard() {
//   return <Text>Dashboard Content</Text>;
// }

function RequireAuth() {
  const { isAuth } = useAuth();
  if (!isAuth) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/new" element={<EventsNew />} />
          <Route path="/events/:id" element={<EventDetails />} />
          <Route path="/moderation" element={<ModerationQueue />} />
          <Route path="/membership" element={<MembershipPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        {/* Slideshow outside of AppLayout (fullscreen) */}
        <Route path="/events/:id/slideshow" element={<Slideshow />} />
      </Route>

      <Route path="*" element={<Text>Not Found</Text>} />
    </Routes>
  );
}

export default App;
