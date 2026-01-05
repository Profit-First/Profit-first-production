/**
 * Main Application Component
 * 
 * This is the root component that handles:
 * - All application routing (public and protected routes)
 * - Authentication state management
 * - OAuth callback handling
 * - Route protection based on authentication status
 * 
 * AUTHENTICATION FLOW:
 * 1. User logs in → tokens stored in localStorage
 * 2. App checks token validity on mount and route changes
 * 3. Protected routes redirect to /login if not authenticated
 * 4. OAuth flow: callback → store tokens → redirect to dashboard/onboarding
 * 
 * KEY FEATURES:
 * - Reactive authentication state (updates when tokens change)
 * - OAuth token extraction from URL hash
 * - Multi-tab synchronization (storage events)
 * - Protected route guards
 * - Toast notifications for user feedback
 */

import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Homepage from "./pages/Homepage";
import Contactus from "./pages/Contactus";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import ScrollToTop from "./utils/ScrollToTop";
import { ToastContainer, Slide } from "react-toastify";
import VerifyEmail from "./pages/VerifyEmail";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import MainDashboard from "./MainDashboard";
import Marketing from "./pages/Marketing";
import Analytics from "./pages/Analytics";
import Shipping from "./pages/Shipping";
import Products from "./pages/Products";
import Returns from "./pages/Returns";
import Blogs from "./pages/Blogs";
import PrivacyPolicy from "./components/PrivacyPolicy";
import RetryPage from "./pages/RetryPage";
import Settings from "./pages/Settings";
import Customerstory from "./pages/Customerstory";
import Profitcalculater from "./components/Profitcalculater";
import Aiprediction from "./pages/Aiprediction";
import ChatbotPage from "./pages/ChatbotPage";
import MetaAds from "./pages/MetaAds";
import MetaAdsMerge from "./pages/MetaAdsMerge";
import CampaignDetails from "./pages/CampaignDetails";
import CampaignSetup from "./pages/CampaignSetup";
import CarouselCompletion from "./pages/CarouselCompletion";
import OrderConfirmation from "./pages/OrderConfirmation";
import AbandonedCall from "./pages/AbandonedCall";
import ForgotPassword from "./pages/ForgotPassword";
import OAuthCallback from "./pages/OAuthCallback";
import BusinessExpenses from "./pages/BusinessExpenses";
import { isTokenValid } from "./utils/auth";
import { useState, useEffect } from "react";

/**
 * AppWrapper Component
 * 
 * Wraps the application with authentication logic and routing.
 * This component is responsible for:
 * - Managing authentication state
 * - Handling OAuth callbacks
 * - Protecting routes based on authentication
 * - Synchronizing auth state across tabs
 */
function AppWrapper() {
  /**
   * Authentication State
   * 
   * Checks for valid tokens in this order:
   * 1. OAuth tokens in URL hash (from OAuth callback)
   * 2. Existing tokens in localStorage
   * 
   * This reactive state updates when:
   * - User logs in/out
   * - Tokens are refreshed
   * - OAuth callback completes
   * - Storage changes in another tab
   */
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // STEP 1: Check for OAuth tokens in URL hash FIRST
    // OAuth callback redirects with tokens in hash: #auth={...}
    const hash = window.location.hash;

    if (hash.includes('#auth=')) {
      try {
        // Extract and decode OAuth token data from URL hash
        const tokenParam = hash.split('#auth=')[1];
        const authData = JSON.parse(decodeURIComponent(tokenParam));

        // Validate that we have required tokens and user data
        if (authData.accessToken && authData.user) {
          // Store all tokens in localStorage for future requests
          localStorage.setItem("accessToken", authData.accessToken);
          if (authData.idToken) localStorage.setItem("idToken", authData.idToken);
          if (authData.refreshToken) localStorage.setItem("refreshToken", authData.refreshToken);
          localStorage.setItem("userData", JSON.stringify(authData.user));
          if (authData.user.userId) localStorage.setItem("userId", authData.user.userId);
          localStorage.setItem("token", authData.accessToken); // Legacy support

          // Clean URL by removing hash (better UX and security)
          window.history.replaceState(null, '', window.location.pathname);

          console.log('✅ OAuth tokens stored successfully! User is authenticated.');
          return true; // User is authenticated via OAuth
        }
      } catch (error) {
        console.error('❌ Failed to parse OAuth tokens from hash:', error);
        // Continue to check localStorage tokens
      }
    }

    // STEP 2: Check existing tokens in localStorage
    // This handles normal login flow and returning users
    const isValid = isTokenValid();
    console.log('Token validation result:', isValid);
    return isValid;
  });

  /**
   * Authentication State Synchronization
   * 
   * Re-checks authentication when:
   * - localStorage changes (login/logout in another tab)
   * - Custom 'tokenUpdated' event fires (same-tab login)
   * - User returns to tab (visibility change)
   * 
   * This ensures auth state is always in sync across:
   * - Multiple browser tabs
   * - After login/logout
   * - After token refresh
   */
  useEffect(() => {
    const checkAuth = () => {
      const isValid = isTokenValid();
      console.log('🔐 Auth state updated:', isValid ? '✓ Authenticated' : '✗ Not authenticated');
      setIsAuthenticated(isValid);
    };

    // Listen for storage changes (cross-tab synchronization)
    // Fires when localStorage is modified in another tab
    window.addEventListener('storage', checkAuth);

    // Custom event for same-tab token updates
    // Fired after login, token refresh, or OAuth callback
    window.addEventListener('tokenUpdated', checkAuth);

    // Check auth when user returns to tab
    // Ensures tokens haven't expired while user was away
    document.addEventListener('visibilitychange', checkAuth);

    // Cleanup event listeners on unmount
    return () => {
      window.removeEventListener('storage', checkAuth);
      window.removeEventListener('tokenUpdated', checkAuth);
      document.removeEventListener('visibilitychange', checkAuth);
    };
  }, []);
  return (
    <>
      <ScrollToTop />
      <ToastContainer 
        position="top-right" 
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick={true}
        rtl={false}
        pauseOnFocusLoss={false}
        draggable={true}
        pauseOnHover={true}
        theme="dark"
        closeButton={true}
        limit={3}
        transition={Slide}
        style={{ 
          zIndex: 99999,
          top: '20px',
          right: '20px'
        }}
      />
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/ourstorys" element={<Customerstory />} />
        <Route path="/Profitcalculater" element={<Profitcalculater />} />
        <Route path="/contact" element={<Contactus />} />
        <Route path="/blogs" element={<Blogs />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/oauth/callback" element={<OAuthCallback />} />
        <Route path="/retry" element={<RetryPage />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/verify-email/:token" element={<VerifyEmail />} />
        <Route
          path="/onboarding"
          element={
            (() => {
              // Check authentication with multiple fallbacks
              const hasAccessToken = localStorage.getItem('accessToken');
              const hasLegacyToken = localStorage.getItem('token');
              const hasToken = hasAccessToken || hasLegacyToken;
              
              console.log('🔍 Onboarding route check:', {
                isAuthenticated,
                hasAccessToken: !!hasAccessToken,
                hasLegacyToken: !!hasLegacyToken,
                hasToken: !!hasToken
              });

              if (isAuthenticated || hasToken) {
                // User is authenticated, show onboarding
                if (!isAuthenticated && hasToken) {
                  // State not updated yet, trigger update
                  console.log('⚠️ Token exists but state not updated, triggering refresh...');
                  setTimeout(() => window.dispatchEvent(new Event('tokenUpdated')), 0);
                }
                return <Onboarding />;
              }
              
              // No authentication, redirect to login
              console.log('❌ No authentication found, redirecting to login');
              return <Navigate to="/login" replace />;
            })()
          }
        />
        <Route
          path="/dashboard"
          element={
            (() => {
              // Check authentication with multiple fallbacks
              const hasAccessToken = localStorage.getItem('accessToken');
              const hasLegacyToken = localStorage.getItem('token');
              const hasToken = hasAccessToken || hasLegacyToken;
              
              console.log('🔍 Dashboard route check:', {
                isAuthenticated,
                hasToken: !!hasToken
              });

              if (isAuthenticated || hasToken) {
                // User is authenticated, show dashboard
                if (!isAuthenticated && hasToken) {
                  // State not updated yet, trigger update
                  setTimeout(() => window.dispatchEvent(new Event('tokenUpdated')), 0);
                }
                return <MainDashboard />;
              }
              
              // No authentication, redirect to login
              console.log('❌ No authentication, redirecting to login');
              return <Navigate to="/login" replace />;
            })()
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="chatbot" element={<ChatbotPage />} />
          <Route path="growth" element={<Aiprediction />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="marketing" element={<Marketing />} />
          <Route path="shipping" element={<Shipping />} />
          <Route path="products" element={<Products />} />
          <Route path="returns" element={<Returns />} />
          <Route path="settings" element={<Settings />} />
          <Route path="meta-ads" element={<MetaAds />} />
          <Route path="meta-ads-merge" element={<MetaAdsMerge />} />
          <Route path="campaign-setup" element={<CampaignSetup />} />
          <Route path="meta-ads/campaign/:campaignId" element={<CampaignDetails />} />
          <Route path="meta-ads/carousel-completion" element={<CarouselCompletion />} />
          <Route path="ai-agent/order-confirmations" element={<OrderConfirmation />} />
          <Route path="ai-agent/abandon-calls" element={<AbandonedCall />} />
          <Route path="business-expenses" element={<BusinessExpenses />} />
        </Route>
        <Route path="*" element={<Homepage />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <Router>
      <AppWrapper />
    </Router>
  );
}

export default App;
