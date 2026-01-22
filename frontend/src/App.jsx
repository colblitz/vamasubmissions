import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Layout from './components/layout/Layout';

// Pages
import LoginPage from './pages/LoginPage';
import CallbackPage from './pages/CallbackPage';

// Phase 1: Community Features
import SearchPage from './pages/SearchPage';
import CommunityRequestsPage from './pages/CommunityRequestsPage';
import ReviewEditsPage from './pages/ReviewEditsPage';

// Admin pages
import ImportPostsPage from './pages/admin/ImportPostsPage';

// Legacy pages (hidden but preserved)
// import DashboardPageV2 from './pages/DashboardPageV2';
// import RequestsPage from './pages/RequestsPage';
// import VotesPage from './pages/VotesPage';
// import AdminDashboardPage from './pages/admin/AdminDashboardPage';

// Smart redirect - everyone goes to search
function HomeRedirect() {
  return <Navigate to="/search" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<CallbackPage />} />

          {/* Protected routes - Phase 1 */}
          <Route element={<Layout />}>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <HomeRedirect />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/search"
              element={
                <ProtectedRoute>
                  <SearchPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/requests"
              element={
                <ProtectedRoute>
                  <CommunityRequestsPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/review"
              element={
                <ProtectedRoute>
                  <ReviewEditsPage />
                </ProtectedRoute>
              }
            />
            
            {/* Admin routes */}
            <Route
              path="/admin/import"
              element={
                <ProtectedRoute requireAdmin>
                  <ImportPostsPage />
                </ProtectedRoute>
              }
            />

            {/* Legacy routes - commented out but preserved */}
            {/* <Route path="/dashboard" element={<ProtectedRoute><DashboardPageV2 /></ProtectedRoute>} /> */}
            {/* <Route path="/votes" element={<ProtectedRoute><VotesPage /></ProtectedRoute>} /> */}
            {/* <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboardPage /></ProtectedRoute>} /> */}
          </Route>

          {/* 404 */}
          <Route path="*" element={<Navigate to="/search" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
