
import React, { useEffect, useState, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/auth/ProtectedRoute';

// Dashboard Layout Component
import { DashboardLayout } from './components/dashboard-layout';
import { MainDashboard } from './components/pages/main-dashboard';

// Lazy load Chatbot for better performance
const Chatbot = React.lazy(() => import('./components/Chatbot'));

// Lazy load pages for better performance
const HomePage = React.lazy(() => import('./pages/HomePage'));
const AuthPage = React.lazy(() => import('./pages/AuthPage'));
const ResetPasswordPage = React.lazy(() => import('./components/auth/ResetPasswordPage'));
const PricingPage = React.lazy(() => import('./pages/PricingPage'));
const UseCasesPage = React.lazy(() => import('./pages/UseCasesPage'));
const ServicesPage = React.lazy(() => import('./pages/ServicesPage'));
const AboutPage = React.lazy(() => import('./pages/AboutPage'));
// DashboardPage removed - using MainDashboard instead
const ContactPage = React.lazy(() => import('./pages/ContactPage'));

// Lazy load dashboard pages
const PromptInjectionPage = React.lazy(() => import('./components/pages/prompt-injection-page').then(module => ({ default: module.PromptInjectionPage })));
const ModelPoisoningPage = React.lazy(() => import('./components/pages/model-poisoning-page').then(module => ({ default: module.ModelPoisoningPage })));
const VectorSecurityPage = React.lazy(() => import('./components/pages/vector-security-page').then(module => ({ default: module.VectorSecurityPage })));
const CodeScannerPage = React.lazy(() => import('./components/pages/code-scanning-page').then(module => ({ default: module.CodeScanningPage })));
const SettingsPage = React.lazy(() => import('./components/pages/settings-page').then(module => ({ default: module.SettingsPage })));
const HistoryPage = React.lazy(() => import('./components/pages/history-page').then(module => ({ default: module.HistoryPage })));
const DataPoisoningPage = React.lazy(() => import('./components/pages/data-poisoning-page').then(module => ({ default: module.DataPoisoningPage })));
const UserProfilePage = React.lazy(() => import('./pages/dashboard/UserProfilePage'));
const MFASettingsPage = React.lazy(() => import('./pages/dashboard/MFASettingsPage'));

function App() {
  const [showChatbot, setShowChatbot] = useState(true);
  
  // Optimized chatbot visibility logic
  useEffect(() => {
    const isAuthPage = window.location.pathname === '/auth';
    setShowChatbot(!isAuthPage);
  }, []);

  // Optimized loading component for Suspense fallback
  const LoadingSpinner = () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex items-center justify-center animated-gradient">
      <div className="flex flex-col items-center space-y-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-teal-500/30 border-t-teal-400 rounded-full animate-spin shadow-lg"></div>
          <div className="absolute inset-0 w-16 h-16 border-4 border-purple-500/20 border-b-purple-400 rounded-full animate-spin animation-delay-150"></div>
        </div>
        <div className="text-center">
          <p className="text-white text-lg font-semibold mb-2">Loading Dashboard...</p>
          <div className="w-32 h-1 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-teal-400 to-purple-500 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  );

  const AppContent = () => {
    const location = useLocation();

    return (
      <>
        {showChatbot && (
          <Suspense fallback={null}>
            <Chatbot />
          </Suspense>
        )}
        
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            {/* Main Website Routes with Layout */}
            <Route path="/" element={<Layout><HomePage /></Layout>} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/login" element={<AuthPage />} />
            <Route path="/signup" element={<AuthPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/pricing" element={<Layout><PricingPage /></Layout>} />
            <Route path="/use-cases" element={<Layout><UseCasesPage /></Layout>} />
            <Route path="/services" element={<Layout><ServicesPage /></Layout>} />
            <Route path="/about" element={<Layout><AboutPage /></Layout>} />
            <Route path="/contact" element={<Layout><ContactPage /></Layout>} />

            {/* Dashboard Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <MainDashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/profile"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <UserProfilePage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/prompt-injection"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PromptInjectionPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/model-poisoning"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ModelPoisoningPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/vector-security"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <VectorSecurityPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            {/* Redirect old vector-embedding route to consolidated vector-security page */}
            <Route
              path="/dashboard/vector-embedding"
              element={<Navigate to="/dashboard/vector-security" replace />}
            />
            <Route
              path="/dashboard/code-scanning"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <CodeScannerPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/data-poisoning"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <DataPoisoningPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/history"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <HistoryPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/settings"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <SettingsPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/mfa"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <MFASettingsPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            {/* Catch-all route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </>
    );
  };

  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <Suspense fallback={<LoadingSpinner />}>
            <AppContent />
          </Suspense>
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
