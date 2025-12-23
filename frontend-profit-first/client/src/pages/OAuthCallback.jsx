import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { PulseLoader } from "react-spinners";
import { storeTokens, storeUserData } from "../services/authService";

const OAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("processing");

  useEffect(() => {
    const handleCallback = async () => {
      // Check for URL hash-based auth (direct token passing)
      const hash = window.location.hash;
      if (hash.includes('#auth=')) {
        try {
          const tokenParam = hash.split('#auth=')[1];
          const authData = JSON.parse(decodeURIComponent(tokenParam));
          
          // Validate required fields
          if (!authData.accessToken || !authData.user) {
            throw new Error('Invalid authentication data received');
          }

          // Store tokens using helper functions
          storeTokens({
            accessToken: authData.accessToken,
            idToken: authData.idToken,
            refreshToken: authData.refreshToken,
          });

          // Store user data
          storeUserData(authData.user);

          // Legacy token storage for backward compatibility
          localStorage.setItem("token", authData.accessToken);
          if (authData.user.userId) {
            localStorage.setItem("userId", authData.user.userId);
          }

          // Clean URL to remove sensitive data
          window.history.replaceState(null, '', window.location.pathname);

          // Notify App.jsx of authentication change
          window.dispatchEvent(new Event('tokenUpdated'));

          toast.success("OAuth login successful!");
          setStatus("success");

          // Check if user has completed onboarding
          const hasCompletedOnboarding = authData.user.hasCompletedOnboarding || 
                                        authData.user.onboardingCompleted || 
                                        authData.user.isOnboarded ||
                                        false;
          
          const redirectPath = hasCompletedOnboarding ? "/dashboard" : "/onboarding";

          // Redirect based on onboarding status
          setTimeout(() => {
            navigate(redirectPath);
          }, 1500);
          return;
        } catch (error) {
          console.error('Failed to parse OAuth tokens from hash:', error);
          toast.error('Failed to process authentication data');
          setStatus("error");
          setTimeout(() => navigate("/login"), 3000);
          return;
        }
      }

      // Handle query parameter-based OAuth (authorization code flow)
      const code = searchParams.get("code");
      const error = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");

      if (error) {
        const errorMsg = errorDescription || error;
        toast.error(`OAuth error: ${errorMsg}`);
        setStatus("error");
        setTimeout(() => navigate("/login"), 3000);
        return;
      }

      if (!code) {
        toast.error("No authorization code received");
        setStatus("error");
        setTimeout(() => navigate("/login"), 3000);
        return;
      }

      try {
        // Get backend URL from environment or use default
        const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        
        // Backend does HTML redirect with tokens in hash
        // Redirect to backend which will redirect back with #auth={data}
        window.location.href = `${backendUrl}/api/auth/oauth/callback?code=${code}`;
        
      } catch (error) {
        console.error("OAuth callback error:", error);
        toast.error("OAuth authentication failed. Please try again.");
        setStatus("error");
        setTimeout(() => navigate("/login"), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#101218] text-white">
      <div className="text-center">
        {status === "processing" && (
          <>
            <PulseLoader size={15} color="#12EB8E" />
            <p className="mt-4 text-gray-300">Processing authentication...</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-xl font-semibold text-white">Authentication Successful!</p>
            <p className="mt-2 text-gray-300">Redirecting to dashboard...</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <p className="text-xl font-semibold text-white">Authentication Failed</p>
            <p className="mt-2 text-gray-300">Redirecting to login...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default OAuthCallback;
