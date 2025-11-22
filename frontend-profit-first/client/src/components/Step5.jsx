import React, { useState } from "react";
import { PulseLoader } from "react-spinners";
import { toast } from "react-toastify";
import axiosInstance from "../../axios";

const Step5 = ({ onComplete }) => {
  const [platform, setPlatform] = useState("Shiprocket");
  const [formData, setFormData] = useState({
    access_token: "",
    secret_key: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Clear fields that don't belong to the selected platform before sending
      let payload = { platform };
      switch (platform) {
        case "Shiprocket":
        case "Nimbuspost":
          payload.email = formData.email;
          payload.password = formData.password;
          break;
        case "Shipway":
          payload.email = formData.email;
          payload.password = formData.password; // Backend knows this is the license key
          break;
        case "Dilevery":
          payload.access_token = formData.access_token;
          break;
        case "Ithink Logistics":
          payload.access_token = formData.access_token;
          payload.secret_key = formData.secret_key;
          break;
        default:
          break;
      }

      // Step 1: Connect shipping account
      await axiosInstance.post("/onboard/step5", payload);
      toast.success("✅ Shipping account connected!", { autoClose: 1500 });
      
      // Step 2: Sync shipments (only for Shiprocket for now)
      if (platform === "Shiprocket") {
        setTimeout(async () => {
          try {
            toast.info("🔄 Syncing shipment data...", { autoClose: 2000 });
            const syncResponse = await axiosInstance.post("/shipping/sync");
            toast.success(`✅ Synced ${syncResponse.data.count} shipments!`, { autoClose: 2000 });
          } catch (syncErr) {
            console.error("Sync error:", syncErr);
            toast.warning("⚠️ Connected but sync failed. You can sync later from dashboard.", { autoClose: 3000 });
          }
        }, 1500);
      }
      
      // Step 3: Update onboarding step
      await axiosInstance.post("/onboard/step", {
        step: 5,
        data: {
          platform: platform,
          completedAt: new Date().toISOString()
        }
      });
      
      // Step 4: Smooth transition to dashboard
      setTimeout(() => {
        toast.success("🎉 Onboarding complete! Redirecting to dashboard...", { autoClose: 1500 });
        setTimeout(() => onComplete(), 1000);
      }, platform === "Shiprocket" ? 3500 : 1500);
      
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Failed to connect shipping account.";
      toast.error(errorMessage);
      console.error("Submission error:", err.response || err);
    } finally {
      setLoading(false);
    }
  };

  const renderFields = () => {
    switch (platform) {
      case "Shiprocket":
        return (
          <>
            <InputField
              label="Shiprocket Email"
              name="email"
              value={formData.email}
              onChange={handleChange}
            />
            <InputField
              label="Password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
            />
          </>
        );
      case "Dilevery":
        return (
          <InputField
            label="Access Token"
            name="access_token"
            value={formData.access_token}
            onChange={handleChange}
          />
        );
      case "Shipway":
        return (
          <>
            <InputField
              label="Email"
              name="email"
              value={formData.email}
              onChange={handleChange}
            />
            <InputField
              label="License Key"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
            />
          </>
        );
      case "Ithink Logistics":
        return (
          <>
            <InputField
              label="Access Token"
              name="access_token"
              value={formData.access_token}
              onChange={handleChange}
            />
            <InputField
              label="Secret Key"
              name="secret_key"
              value={formData.secret_key}
              onChange={handleChange}
            />
          </>
        );
      case "Nimbuspost":
        return (
          <>
            <InputField
              label="Email"
              name="email"
              value={formData.email}
              onChange={handleChange}
            />
            <InputField
              label="Password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
            />
          </>
        );
      default:
        return null;
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
      <header className="w-full max-w-7xl px-8 py-6 flex items-center gap-3">
        <img
          src="https://res.cloudinary.com/dqdvr35aj/image/upload/v1748330108/Logo1_zbbbz4.png"
          alt="Profit First Logo"
          className="w-35"
        />
      </header>

      {/* Main layout */}
      <main className="w-full max-w-6xl flex flex-col lg:flex-row items-center justify-between px-8 gap-16">
        {/* LEFT CARD */}
        <div className="bg-[#1E1E1E] border-[#1E1E1E] rounded-[20px] p-10 shadow-lg w-full max-w-md">
          {/* Platform tabs */}
          <div className="rounded-lg p-1 flex mb-2 justify-center flex-wrap gap-2">
            {[
              "Shiprocket",
              "Dilevery",
              "Shipway",
              "Ithink Logistics",
              "Nimbuspost",
            ].map((name) => (
              <button
                key={name}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors duration-300 ${
                  platform === name
                    ? "bg-white text-black font-semibold"
                    : "bg-transparent text-gray-400"
                }`}
                onClick={() => setPlatform(name)}
              >
                {name}
              </button>
            ))}
          </div>

          {/* Platform icon */}
          <div className="flex justify-center mb-3">
            <div className="bg-white w-15 h-15 rounded-full flex items-center justify-center shadow-md">
              <img
                src="https://res.cloudinary.com/dqdvr35aj/image/upload/v1760000741/Screenshot_2025-10-09_143355_ihadan.png"
                alt="Shopify Logo"
                className="w-10 h-10 object-contain"
              />
            </div>
          </div>

          {/* Heading */}
          <h2 className="text-center text-2xl font-bold mb-2">
           Connect your Shiprocket Account
          </h2>
          <p className="text-center text-sm text-gray-400 mb-4">
Track your accounts profit, sells and buys in detail with shipping account.          </p>

          {/* Form fields */}
          <form onSubmit={handleSubmit} className="space-y-4 mb-4">
            {renderFields()}
          </form>

          {/* Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              onClick={handleSubmit}
              className="px-3 py-2.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-gray-100 transition"
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

const InputField = ({ label, name, value, onChange, type = "text" }) => (
  <div>
    <label className="block text-sm text-gray-400 mb-2">{label}</label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      className="w-full px-3 py-2 rounded-lg bg-transparent border border-gray-600 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400"
      autoComplete="off"
    />
  </div>
);

export default Step5;