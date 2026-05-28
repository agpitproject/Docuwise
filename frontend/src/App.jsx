import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

import Navbar      from './components/Layout/Navbar';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import AnalysePage from './pages/AnalysePage';
import AskAIPage from './pages/AskAIPage';
import PricingPage from './pages/PricingPage';
import ApiPage     from './pages/ApiPage';
import SettingsPage from './pages/SettingsPage';
import InfoPage from './pages/InfoPage';

// Guard: redirects to landing if not authenticated
const PrivateRoute = ({ children }) => {
  const token = useAuthStore(s => s.token);
  return token ? children : <Navigate to="/" replace />;
};

export default function App() {
  const { token, fetchMe } = useAuthStore();

  // Re-hydrate user on refresh if token exists
  useEffect(() => {
    if (token) fetchMe();
  }, []);

  return (
    <>
      <Navbar />
      <Routes>
        {/* Public landing page */}
        <Route path="/"          element={<LandingPage />} />
        {/* Public pricing information */}
        <Route path="/pricing"   element={<PricingPage />} />
        {/* Public API documentation */}
        <Route path="/api-docs"  element={<ApiPage />} />
        {/* Public informational content pages */}
        <Route path="/info/:slug" element={<InfoPage />} />
        {/* Authenticated dashboard workspace */}
        <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        {/* Authenticated analysis creation page */}
        <Route path="/analyse"   element={<PrivateRoute><AnalysePage /></PrivateRoute>} />
        {/* Authenticated analysis details page */}
        <Route path="/analyse/:analysisId" element={<PrivateRoute><AnalysePage /></PrivateRoute>} />
        {/* Authenticated document Q&A page */}
        <Route path="/analyse/:analysisId/ask" element={<PrivateRoute><AskAIPage /></PrivateRoute>} />
        {/* Authenticated account settings page */}
        <Route path="/settings"  element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
        {/* Fallback route */}
        <Route path="*"          element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
