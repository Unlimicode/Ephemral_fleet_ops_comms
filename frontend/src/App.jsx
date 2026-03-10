import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';

// Page imports
import LoginPage from './pages/LoginPage.jsx';
import ManagerDispatchPage from './pages/manager/ManagerDispatchPage.jsx';
import ManagerDriversPage from './pages/manager/ManagerDriversPage.jsx';
import ManagerVehiclesPage from './pages/manager/ManagerVehiclesPage.jsx';
import ManagerComplaintsPage from './pages/manager/ManagerComplaintsPage.jsx';
import ManagerDashboardPage from './pages/ManagerPrivacyDashboardPage.jsx';
import ManagerAuditPage from './pages/manager/ManagerAuditPage.jsx';
import DriverTripsPage from './pages/driver/DriverTripsPage.jsx';
import DriverActiveTripPage from './pages/driver/DriverActiveTripPage.jsx';
import DriverProfilePage from './pages/driver/DriverProfilePage.jsx';
import DriverNotificationsPage from './pages/driver/DriverNotificationsPage.jsx';
import BookingLandingPage from './pages/booking/BookingLandingPage.jsx';
import ClientChatPage from './pages/ClientChatPage.jsx';
import SwiftlinkHomePage from './pages/SwiftlinkHomePage.jsx';
import BookingHistoryPage from './pages/BookingHistoryPage.jsx';

// Layout & Context imports
import ManagerLayout from './components/layout/ManagerLayout.jsx';
import DriverLayout from './components/layout/DriverLayout.jsx';
import { ToastProvider } from './components/Toast.jsx';

// ProtectedRoute guards a route by authentication status and required role.
// Unauthenticated users are redirected to /login. Authenticated users with the
// wrong role are redirected to their correct home route to prevent cross-role access.
function ProtectedRoute({ children, role: requiredRole }) {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && role !== requiredRole) {
    const homeRoute = role === 'fleet_manager' ? '/manager/dispatch' : '/driver/trips';
    return <Navigate to={homeRoute} replace />;
  }

  return children;
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<SwiftlinkHomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/booking" element={<BookingLandingPage />} />
        <Route path="/booking/history" element={<BookingHistoryPage />} />
        <Route path="/booking/:tripId" element={<ClientChatPage />} />

        {/* Fleet manager routes — nested under ManagerLayout */}
        <Route
          element={
            <ProtectedRoute role="fleet_manager">
              <ManagerLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/manager/dispatch" element={<ManagerDispatchPage />} />
          <Route path="/manager/drivers" element={<ManagerDriversPage />} />
          <Route path="/manager/vehicles" element={<ManagerVehiclesPage />} />
          <Route path="/manager/complaints" element={<ManagerComplaintsPage />} />
          <Route path="/manager/dashboard" element={<ManagerDashboardPage />} />
          <Route path="/manager/audit" element={<ManagerAuditPage />} />
        </Route>

        {/* Driver routes — nested under DriverLayout */}
        <Route
          element={
            <ProtectedRoute role="driver">
              <DriverLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/driver/trips" element={<DriverTripsPage />} />
          <Route path="/driver/trips/active" element={<DriverTripsPage defaultTab="active" />} />
          <Route path="/driver/trips/:tripId" element={<DriverActiveTripPage />} />
          <Route path="/driver/profile" element={<DriverProfilePage />} />
          <Route path="/driver/notifications" element={<DriverNotificationsPage />} />
        </Route>
      </Routes>
    </ToastProvider>
  );
}
