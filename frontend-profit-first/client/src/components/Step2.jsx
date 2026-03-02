import { useState } from "react";
import { toast } from "react-toastify";
import axiosInstance from "../../axios";
import { PulseLoader } from "react-spinners";

const Step2 = ({ onComplete }) => {
  const [platform, setPlatform] = useState("Shopify");
  const [storeUrl, setStoreUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const handleConnect = async () => {
    console.log("🔗 Connect button clicked");
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
    setIsConnected(false);
    
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
        // Open in new tab for Shopify OAuth
        window.open(response.data.authUrl, "_blank");
        
        toast.info("🔗 Opening Shopify in new tab. Please install the app there.", { autoClose: 5000 });
        
        // Stop loading - user needs to install app manually
        setLoading(false);
        
        toast.info("📱 After installing the app, click 'Verify Connection' below", { autoClose: false });
        
      } else {
        toast.error("❌ Failed to get authorization URL. Please try again.");
        setLoading(false);
      }
    } catch (err) {
      console.error("❌ Connection error:", err);
      
      let errorMessage = "❌ Failed to connect to Shopify";
      
      if (err.response) {
        const backendError = err.response.data?.message || err.response.data?.error;
        
        if (err.response.status === 400) {
          errorMessage = `❌ Invalid store URL: ${backendError || "Please check your store name"}`;
        } else if (err.response.status === 404) {
          errorMessage = "❌ Store not found. Please check your store URL.";
        } else if (err.response.status === 500) {
          errorMessage = `❌ Server error: ${backendError || "Please try again later"}`;
        } else {
          errorMessage = backendError || errorMessage;
        }
      } else if (err.request) {
        errorMessage = "🔌 Cannot connect to server. Please check your internet connection.";
      }
      
      toast.error(errorMessage, { autoClose: 5000 });
      setLoading(false);
    }
  };

  // New function to verify connection after user installs app
  const handleVerifyConnection = async () => {
    if (!storeUrl) {
      return toast.error("Please enter your store URL first");
    }

    let correctedStoreUrl = storeUrl.trim().toLowerCase();
    if (!correctedStoreUrl.includes('.myshopify.com')) {
      correctedStoreUrl = `${correctedStoreUrl}.myshopify.com`;
    }

    console.log("🔍 Verifying Shopify connection...");
    setLoading(true);
    
    try {
      // Step 1: Get token from external service
      console.log("📡 Fetching token from external service...");
      toast.info("🔍 Checking for access token...", { autoClose: 2000 });
      
      const tokenResponse = await axiosInstance.get('/onboard/proxy/token', {
        params: {
          shop: correctedStoreUrl,
          password: 'Sachin369'
        }
      });
      
      if (!tokenResponse.data || !tokenResponse.data.accessToken) {
        toast.error("❌ No access token found. Please install the app in Shopify first.");
        setLoading(false);
        return;
      }
      
      const accessToken = tokenResponse.data.accessToken;
      console.log("✅ Token received:", accessToken.substring(0, 20) + "...");
      
      // Step 2: Test the token by calling Shopify API directly via backend
      console.log("🔐 Testing token with Shopify API...");
      toast.info("🔐 Verifying token with Shopify...", { autoClose: 2000 });
      
      try {
        // Save token to backend (backend will verify it)
        const saveResponse = await axiosInstance.post("/shopify/callback", {
          userId: localStorage.getItem('userId'),
          shopUrl: correctedStoreUrl,
          accessToken: accessToken
        }, {
          headers: {
            'X-Shopify-Access-Token': accessToken
          }
        });
        
        if (saveResponse.data.success) {
          console.log("✅ Token verified and saved!");
          toast.dismiss();
          toast.success("✅ Shopify store connected successfully!", { autoClose: 3000 });
          setIsConnected(true);
          setLoading(false);
          
          setTimeout(() => {
            toast.info("👉 Click 'Next' to continue to product setup", { autoClose: false });
          }, 2000);
        } else {
          throw new Error("Failed to save connection");
        }
        
      } catch (saveError) {
        console.error("❌ Token verification failed:", saveError);
        
        if (saveError.response?.status === 401) {
          toast.error("❌ Invalid token. Please make sure you installed the app in Shopify.", { autoClose: 5000 });
        } else {
          toast.error("❌ Failed to verify connection. Please try again.", { autoClose: 5000 });
        }
        setLoading(false);
      }
      
    } catch (err) {
      console.error("❌ Verify connection error:", err);
      
      if (err.response?.status === 404) {
        toast.error("❌ No token found. Please install the app in Shopify first.", { autoClose: 5000 });
      } else {
        toast.error("❌ Failed to verify connection. Please try again.", { autoClose: 5000 });
      }
      setLoading(false);
    }
  };

  const handleDone = async () => {
    if (!storeUrl) {
      return toast.error("Please enter your store URL and connect first");
    }

    console.log("🚀 Step 2 - Proceeding to next step...");
    console.log("📦 Store URL:", storeUrl);

    setLoading(true);
    try {
      // First, verify that Shopify connection exists
      console.log("🔍 Checking if Shopify is connected...");
      
      const verifyResponse = await axiosInstance.get("/shopify/connection");
      
      if (!verifyResponse.data.connected) {
        toast.error("❌ Please connect your Shopify store first. Click 'Connect' then 'Verify Connection'.");
        setLoading(false);
        return;
      }
      
      console.log("✅ Shopify connection exists in database");
      
      // Test the access token by fetching products
      console.log("🔐 Testing access token with Shopify API...");
      toast.info("🔐 Verifying your Shopify connection...", { autoClose: 2000 });
      
      try {
        const testResponse = await axiosInstance.get("/onboard/fetchproduct", {
          timeout: 15000
        });
        
        if (!testResponse.data.success) {
          throw new Error("Failed to fetch products");
        }
        
        console.log("✅ Access token verified! Products fetched successfully");
        console.log(`   Found ${testResponse.data.count} products`);
        
      } catch (tokenError) {
        console.error("❌ Access token verification failed:", tokenError);
        
        let errorMsg = "❌ Connection invalid. Please click 'Connect' and reinstall the app.";
        
        if (tokenError.response?.status === 401) {
          errorMsg = "❌ Access token expired. Please click 'Connect' to reconnect.";
        } else if (tokenError.response?.status === 404) {
          errorMsg = "❌ No Shopify connection found. Please click 'Connect' first.";
        }
        
        toast.error(errorMsg, { autoClose: 5000 });
        setIsConnected(false);
        setLoading(false);
        return;
      }
      
      // Save step and proceed
      console.log("📡 Saving step 2...");
      
      const response = await axiosInstance.post("/onboard/step", {
        step: 2,
        data: {
          platform: platform,
          storeUrl: storeUrl,
          connected: true,
          connectedAt: new Date().toISOString()
        }
      });

      console.log("✅ Step 2 completed:", response.data);
      toast.success("✅ Step 2 completed!");
      onComplete();
      
    } catch (err) {
      console.error("❌ Step 2 error:", err);
      
      let errorMessage = "Failed to complete step. Please try again.";
      
      if (err.response?.status === 404) {
        errorMessage = "❌ Shopify not connected. Please click 'Connect' first.";
      }
      
      toast.error(errorMessage);
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
          <div className="flex flex-col gap-3">
            <div className="flex justify-end gap-3">
              <button
                onClick={handleVerifyConnection}
                className="px-6 py-2.5 rounded-full bg-[#2E7D32] text-white text-sm font-semibold transition hover:bg-[#1B5E20]"
              >
                Verify Connection
              </button>
              <button
                onClick={handleConnect}
                className="px-6 py-2.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-gray-100 transition"
              >
                Connect
              </button>
            </div>
            {isConnected && (
              <div className="flex justify-end">
                <button
                  onClick={handleDone}
                  className="px-6 py-2.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-gray-100 transition"
                >
                  Next →
                </button>
              </div>
            )}
            {!isConnected && (
              <p className="text-center text-xs text-gray-500 mt-2">
                1. Click "Connect" to open Shopify<br/>
                2. Install the app in Shopify<br/>
                3. Click "Verify Connection"<br/>
                4. Click "Next" to continue
              </p>
            )}
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
