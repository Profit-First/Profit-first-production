import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { PulseLoader } from "react-spinners";
import axiosInstance from "../../axios";

const Step4 = ({ onComplete }) => {
  const [platform, setPlatform] = useState("Meta");
  const [adAccounts, setAdAccounts] = useState([]); // Stores the fetched ad accounts
  const [selectedAdAccountId, setSelectedAdAccountId] = useState(""); // Stores the selected ad account
  const [loading, setLoading] = useState(false);

  // Check Meta connection and fetch ad accounts
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await axiosInstance.get("/meta/connection");
        
        if (response.data.connected) {
          console.log("✅ Meta connected:", response.data.connection);
          setAdAccounts(response.data.connection.adAccounts || []);
          toast.success("Meta account connected!");
        }
      } catch (err) {
        if (err.response?.status !== 404) {
          console.error("Error checking Meta connection:", err);
        }
        // Not connected yet - user needs to click "Connect to Meta"
      }
    };

    checkConnection();

    // Listen for OAuth callback success
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('meta') === 'connected') {
      const accounts = urlParams.get('accounts');
      toast.success(`✅ Meta connected! Found ${accounts} ad account(s)`);
      // Refresh connection data
      checkConnection();
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (urlParams.get('meta') === 'error') {
      const message = urlParams.get('message');
      toast.error(`Failed to connect Meta: ${message}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!selectedAdAccountId) {
      toast.error("Please select your Ad account.");
      setLoading(false);
      return;
    }

    const numericAdAccountId = selectedAdAccountId.replace(/^act_/, "");

    try {
      console.log("💾 Saving ad account selection:", numericAdAccountId);

      // First, save the selected ad account to Meta connection
      await axiosInstance.post("/meta/select-account", {
        adAccountId: numericAdAccountId
      });

      console.log("✅ Ad account saved to Meta connection");

      // Then, update onboarding step
      await axiosInstance.post("/onboard/step", {
        step: 4,
        data: {
          adAccountId: numericAdAccountId,
          platform: platform,
          completedAt: new Date().toISOString()
        }
      });

      console.log("✅ Onboarding step updated");

      toast.success("✅ Ad account connected!", { autoClose: 1500 });
      
      // Smooth transition to next step
      setTimeout(() => {
        toast.info("🎯 Loading premium plans...", { autoClose: 1000 });
        setTimeout(() => onComplete(), 500);
      }, 1000);
    } catch (err) {
      console.error("❌ Submission error:", err);
      
      let errorMessage = "Failed to connect ad account.";
      
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleMetaConnect = async () => {
    try {
      console.log("🔗 Initiating Meta OAuth...");
      const response = await axiosInstance.post("/meta/connect");

      if (response.data?.authUrl) {
        console.log("✅ Redirecting to Facebook OAuth...");
        window.location.href = response.data.authUrl;
      }
    } catch (err) {
      console.error("❌ Meta connect error:", err);
      toast.error("Failed to initiate Meta login.");
    }
  };

  const handleSkip = async () => {
    try {
      setLoading(true);
      console.log("⏭️  Skipping Meta connection...");

      // Update onboarding step to 4 (mark as completed but skipped)
      await axiosInstance.post("/onboard/step", {
        step: 4,
        data: {
          skipped: true,
          completedAt: new Date().toISOString()
        }
      });

      toast.info("⏭️  Meta connection skipped. You can connect later from settings.", { autoClose: 2000 });
      
      // Smooth transition to next step
      setTimeout(() => {
        toast.info("🚚 Loading shipping setup...", { autoClose: 1000 });
        setTimeout(() => onComplete(), 500);
      }, 1000);

    } catch (err) {
      console.error("❌ Skip error:", err);
      toast.error("Failed to skip step.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0D1D1E]">
        <PulseLoader size={60} color="#12EB8E" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101218] text-white flex flex-col items-center justify-center relative overflow-hidden">
      <style>{`
        .bg-blob {
          position: absolute;
          width: 380px;
          height: 380px;
          filter: blur(80px);
          opacity: 0.14;
          z-index: 0;
          border-radius: 50%;
        }
        .blob-left { left: -120px; top: 100%; background: #5fc61fff; transform: translateY(-50%); }
        .blob-right { right: -120px; top: 0%; background: #5fc61fff; transform: translateY(0%); }
      `}</style>
      <div className="bg-blob blob-left"></div>
      <div className="bg-blob blob-right"></div>
      {/* Header logo */}
      <header className="w-full max-w-7xl px-12 py-10 flex items-center gap-3">
        <img
          src="https://res.cloudinary.com/dqdvr35aj/image/upload/v1748330108/Logo1_zbbbz4.png"
          alt="Profit First Logo"
          className="w-35"
        />
      </header>

      {/* Main layout */}
      <main className="w-full max-w-6xl flex flex-col lg:flex-row items-center justify-between px-12 gap-16">
        {/* LEFT CARD */}
        <div className="bg-[#1E1E1E] border-[#1E1E1E] rounded-[20px] p-10 shadow-lg w-full max-w-md">
          {/* Platform tabs */}
          <div className="rounded-lg p-1 flex mb-6 justify-center">
            <button
              onClick={() => setPlatform("Meta")}
              className={`px-4 py-1.5 rounded-md text-sm transition-colors duration-300 ${platform === "Meta"
                ? "bg-white text-black font-semibold"
                : "bg-transparent text-gray-400"
                }`}
            >
              Meta
            </button>
            <button
              onClick={() => setPlatform("Google")}
              className={`px-4 py-1.5 rounded-md text-sm transition-colors duration-300 ${platform === "Google"
                ? "bg-white text-black font-semibold"
                : "bg-transparent text-gray-400"
                }`}
            >
              Google
            </button>
          </div>

          {/* Platform icon */}
          <div className="flex justify-center mb-5">
            <div className="bg-white w-20 h-20 rounded-full flex items-center justify-center shadow-md">
              {platform === "Meta" ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-10 h-10"
                  viewBox="0 0 24 24"
                  fill="#1877F2"
                >
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-10 h-10"
                  viewBox="0 0 24 24"
                >
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
            </div>
          </div>

          {/* Heading */}
          <h2 className="text-center text-2xl font-bold mb-2">
            Connect your Ad Account
          </h2>
          <p className="text-center text-sm text-gray-400 mb-8">
            Track your ad performance and manage campaigns with your ad account.
          </p>

          {/* Form fields */}
          <form onSubmit={handleSubmit} className="space-y-4 mb-8">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Select your Ad account ID:
              </label>
              <select
                name="adAccountId"
                value={selectedAdAccountId}
                onChange={(e) => setSelectedAdAccountId(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-transparent border border-gray-600 text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-400"
              >
                <option value="" className="bg-[#1E1E1E]">Select an Ad Account</option>
                {adAccounts.map((account) => (
                  <option key={account.id} value={account.id} className="bg-[#1E1E1E]">
                    {account.accountId} - {account.name}
                  </option>
                ))}
              </select>
            </div>
          </form>

          {/* Buttons */}
          <div className="flex flex-col gap-3">
            <div className="flex justify-between gap-3">
              <button
                type="button"
                className="px-6 py-2.5 rounded-full bg-blue-500 text-white text-sm font-semibold transition hover:bg-blue-600"
                onClick={handleMetaConnect}
              >
                Connect to Meta
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={loading}
                className={`px-6 py-2.5 rounded-full bg-white text-black text-sm font-semibold transition hover:bg-gray-100 ${loading ? "opacity-50 cursor-not-allowed" : ""
                  }`}
              >
                {loading ? "Connecting..." : "Connect"}
              </button>
            </div>
            
            {/* Skip Button */}
            <button
              type="button"
              onClick={handleSkip}
              className="w-full px-6 py-2.5 rounded-full bg-transparent border border-gray-500 text-gray-400 text-sm font-semibold transition hover:bg-gray-800 hover:text-white"
            >
              Skip for Now →
            </button>
          </div>
        </div>
        {/* RIGHT VIDEO SECTION */}
        <div className="bg-[#141617] rounded-[20px] w-full max-w-xl h-[300px] flex items-center justify-center shadow-md">
          <div className="w-20 h-20 rounded-full border-2 border-gray-400 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10 text-gray-400"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7-11-7z" />
            </svg>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Step4;