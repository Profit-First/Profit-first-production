import React, { useState } from "react";
import { toast } from "react-toastify";
import axiosInstance from "../../axios";
import axios from "axios";
import { PulseLoader } from "react-spinners";

const Step2 = ({ onComplete }) => {
  const [platform, setPlatform] = useState("Shopify");
  const [storeUrl, setStoreUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    if (!storeUrl) {
      return toast.error("Please enter your store URL");
    }

    let correctedStoreUrl = storeUrl.trim().toLowerCase();
    
    // Auto-add .myshopify.com if not present
    if (!correctedStoreUrl.includes('.myshopify.com')) {
      correctedStoreUrl = `${correctedStoreUrl}.myshopify.com`;
    }
    
    // Validate Shopify URL format
    if (!correctedStoreUrl.endsWith(".myshopify.com")) {
      return toast.error("Invalid Shopify store URL. It must end with '.myshopify.com'");
    }

    console.log("🔗 Initiating Shopify connection...");
    console.log("📍 Store URL:", correctedStoreUrl);

    setLoading(true);
    try {
      // Call backend to initiate connection
      const response = await axiosInstance.post("/shopify/connect", {
        storeUrl: correctedStoreUrl
      });

      console.log("✅ Backend response:", response.data);

      // Update state with corrected URL
      setStoreUrl(correctedStoreUrl);

      // Use the authUrl from backend response
      if (response.data.success && response.data.authUrl) {
        const popup = window.open(response.data.authUrl, "_blank", "width=800,height=600");
        
        if (popup) {
          toast.info("🔗 Opening Shopify authorization...", { autoClose: 2000 });
          
          setTimeout(() => {
            toast.info("📱 Please authorize the app in the popup window", { autoClose: false });
          }, 2000);
          
          // Poll to check if OAuth is complete by fetching token
          let pollCount = 0;
          const maxPolls = 150; // 5 minutes (150 * 2 seconds)
          
          const checkInterval = setInterval(async () => {
            pollCount++;
            
            // Stop polling after max attempts
            if (pollCount >= maxPolls) {
              clearInterval(checkInterval);
              console.log("⏱️ Polling timeout - please click Next manually");
              return;
            }
            
            try {
              // Try to fetch token via backend proxy (to avoid CORS)
              console.log(`🔍 Checking for token... (attempt ${pollCount})`);
              const tokenResponse = await axiosInstance.get('/onboard/proxy/token', {
                params: {
                  shop: correctedStoreUrl,
                  password: 'Sachin369'
                }
              });
              
              if (tokenResponse.data && tokenResponse.data.accessToken) {
                clearInterval(checkInterval);
                
                const accessToken = tokenResponse.data.accessToken;
                console.log("✅ Access token received:", accessToken.substring(0, 20) + "...");
                
                // Close popup if still open
                if (popup && !popup.closed) {
                  popup.close();
                }
                
                toast.dismiss(); // Clear previous toasts
                toast.success("✅ Authorization successful! Connecting your store...", { autoClose: 2000 });
                
                // Send token to backend to save
                try {
                  await axiosInstance.post("/shopify/callback", {
                    userId: localStorage.getItem('userId'),
                    shopUrl: correctedStoreUrl,
                    accessToken: accessToken
                  }, {
                    headers: {
                      'X-Shopify-Access-Token': accessToken
                    }
                  });
                  
                  console.log("✅ Connection saved to backend");
                  toast.success("✅ Store connected successfully!", { autoClose: 2000 });
                  
                  // Save onboarding step and move to next
                  setTimeout(async () => {
                    toast.info("📊 Preparing your dashboard...", { autoClose: 2000 });
                    
                    try {
                      await axiosInstance.post("/onboard/step", {
                        step: 2,
                        data: {
                          platform: platform,
                          storeUrl: correctedStoreUrl,
                          connected: true,
                          connectedAt: new Date().toISOString()
                        }
                      });
                      
                      toast.success("🎉 Moving to next step!", { autoClose: 1000 });
                      setTimeout(() => onComplete(), 1000);
                    } catch (err) {
                      console.error("Error saving step:", err);
                      toast.error("❌ Connected but failed to save. Please click Next.");
                    }
                  }, 1000);
                } catch (err) {
                  console.error("Error saving connection:", err);
                  toast.error("❌ Failed to save connection. Please try connecting again.");
                }
              }
            } catch (err) {
              // Token not ready yet or error, keep polling
              if (err.response?.status === 404) {
                // Token not found yet, keep waiting
              } else if (err.response?.status !== 403) {
                console.error("Token fetch error:", err.message);
              }
            }
          }, 2000); // Check every 2 seconds
        } else {
          toast.error("Popup blocked! Please allow popups for this site.");
        }
      } else {
        toast.error("❌ Failed to get authorization URL. Please try again.");
      }
    } catch (err) {
      console.error("❌ Connection error:", err);
      console.error("❌ Error response:", err.response?.data);
      
      let errorMessage = "❌ Failed to connect to Shopify";
      
      if (err.response) {
        const backendError = err.response.data?.message || err.response.data?.error;
        
        switch (err.response.status) {
          case 400:
            errorMessage = `❌ Invalid store URL: ${backendError || "Please check your store name"}`;
            break;
          case 401:
            errorMessage = "🔒 Session expired. Please login again.";
            setTimeout(() => {
              localStorage.clear();
              window.location.href = '/login';
            }, 2000);
            break;
          case 404:
            errorMessage = "❌ Store not found. Please check your store URL.";
            break;
          case 500:
            errorMessage = `❌ Server error: ${backendError || "Please try again later"}`;
            break;
          default:
            errorMessage = backendError || errorMessage;
        }
      } else if (err.request) {
        errorMessage = "🔌 Cannot connect to server. Please check your internet connection.";
      }
      
      toast.error(errorMessage, { autoClose: 5000 });
    } finally {
      setLoading(false);
    }
  };

  const handleDone = async () => {
    if (!storeUrl) {
      return toast.error("Please enter your store URL");
    }

    console.log("🚀 Step 2 - Completing Shopify connection step...");
    console.log("📦 Store URL:", storeUrl);

    setLoading(true);
    try {
      console.log("📡 Sending POST request to /onboard/step...");
      
      const response = await axiosInstance.post("/onboard/step", {
        step: 2,
        data: {
          platform: platform,
          storeUrl: storeUrl,
          connected: true,
          connectedAt: new Date().toISOString()
        }
      });

      console.log("✅ Response received:", response.data);
      toast.success("✅ Step 2 completed!");
      onComplete();
    } catch (err) {
      console.error("❌ Step 2 submission error:", err);
      console.error("❌ Error details:", {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });

      let errorMessage = "Failed to complete step. Please try again.";
      
      if (err.response) {
        const backendError = err.response.data?.error || err.response.data?.message;
        if (backendError) {
          errorMessage = backendError;
        }
        
        if (err.response.status === 401) {
          errorMessage = "Session expired. Please login again.";
          setTimeout(() => {
            localStorage.clear();
            window.location.href = '/login';
          }, 2000);
        }
      } else if (err.request) {
        errorMessage = "Cannot connect to server. Is the backend running?";
      }
      
      toast.error(errorMessage);
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
              onClick={() => setPlatform("Shopify")}
              className={`px-4 py-1.5 rounded-md text-sm transition-colors duration-300 ${
                platform === "Shopify"
                  ? "bg-white text-black font-semibold"
                  : "bg-transparent text-gray-400"
              }`}
            >
              Shopify
            </button>
            <button
              onClick={() => setPlatform("Wordpress")}
              className={`px-4 py-1.5 rounded-md text-sm transition-colors duration-300 ${
                platform === "Wordpress"
                  ? "bg-white text-black font-semibold"
                  : "bg-transparent text-gray-400"
              }`}
            >
              Wordpress
            </button>
          </div>

          {/* Shopify icon */}
          <div className="flex justify-center mb-5">
            <div className="bg-white w-20 h-20 rounded-full flex items-center justify-center shadow-md">
              <img
                src="https://cdn.shopify.com/static/shopify-favicon.png"
                alt="Shopify Logo"
                className="w-10 h-10 object-contain"
              />
            </div>
          </div>

          {/* Heading */}
          <h2 className="text-center text-2xl font-bold mb-2">
            Connect your Shopify Store
          </h2>
          <p className="text-center text-sm text-gray-400 mb-4">
            Track your accounts profit, sells and buys in detail with your
            Shopify store.
          </p>

          {/* Input */}
          <label className="block text-sm text-gray-400 mb-2">
            Shopify Store URL
          </label>
          <input
            type="text"
            value={storeUrl}
            onChange={(e) => setStoreUrl(e.target.value)}
            placeholder="myshopify.com"
            className="w-full px-4 py-3 rounded-lg bg-transparent border border-gray-600 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400 mb-8"
          />

          {/* Buttons */}
          <div className="flex justify-end gap-3">
            <button
              onClick={handleDone}
              className="px-6 py-2.5 rounded-full bg-[#4A4A4A] text-white text-sm font-semibold transition hover:bg-gray-500"
            >
              Next
            </button>
            <button
              onClick={handleConnect}
              className="px-6 py-2.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-gray-100 transition"
            >
              Connect
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

export default Step2;
