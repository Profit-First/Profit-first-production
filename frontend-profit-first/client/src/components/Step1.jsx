import React, { useState } from "react";
import axiosInstance from "../../axios";
import { toast } from "react-toastify";
import { PulseLoader } from "react-spinners";

const Step1 = ({ onComplete }) => {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    whatsapp: "",
    industry: "",
    referral: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { fullName, email, phone, whatsapp, industry, referral } = form;
    
    // Validate all required fields
    if (!fullName || !email || !phone || !whatsapp || !industry) {
      const missing = [];
      if (!fullName) missing.push("Full Name");
      if (!email) missing.push("Work Mail");
      if (!phone) missing.push("Phone Number");
      if (!whatsapp) missing.push("WhatsApp Number");
      if (!industry) missing.push("Industry");
      
      toast.error(`❌ Please fill in: ${missing.join(", ")}`);
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("❌ Invalid email format. Please enter a valid work email (e.g., name@company.com)");
      return;
    }

    // Validate phone number (Indian format)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      toast.error("❌ Invalid phone number. Please enter a 10-digit Indian mobile number starting with 6-9");
      return;
    }

    // Validate WhatsApp number
    if (!phoneRegex.test(whatsapp)) {
      toast.error("❌ Invalid WhatsApp number. Please enter a 10-digit mobile number starting with 6-9");
      return;
    }

    console.log("🚀 Step 1 - Starting submission...");
    console.log("📦 Data to send:", { fullName, email, phone, whatsapp, industry, referral });

    // Check token before sending
    const token = localStorage.getItem("accessToken");
    console.log("🔑 Token exists:", !!token);
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const isExpired = Date.now() >= payload.exp * 1000;
        console.log("⏰ Token expired:", isExpired);
        if (isExpired) {
          toast.error("Your session has expired. Please login again.");
          setTimeout(() => {
            localStorage.clear();
            window.location.href = '/login';
          }, 2000);
          return;
        }
      } catch (e) {
        console.error("❌ Token decode error:", e);
      }
    } else {
      toast.error("No access token found. Please login again.");
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
      return;
    }

    setLoading(true);
    try {
      console.log("📡 Sending POST request to /onboard/step...");

      // Call the correct API endpoint with proper data structure
      const response = await axiosInstance.post("/onboard/step", {
        step: 1,
        data: {
          fullName,
          email,
          phone,
          whatsapp,
          industry,
          referral
        }
      });

      console.log("✅ Response received:", response.data);

      toast.success("✅ Step 1 completed successfully!", { autoClose: 1500 });

      // Clear form
      setForm({
        fullName: "",
        email: "",
        phone: "",
        whatsapp: "",
        industry: "",
        referral: "",
      });

      // Smooth transition to next step
      setTimeout(() => {
        toast.info("📋 Loading next step...", { autoClose: 1000 });
        setTimeout(() => onComplete(), 500);
      }, 1000);
    } catch (err) {
      console.error("❌ Step 1 submission error:", err);
      console.error("❌ Error details:", {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        hasRequest: !!err.request,
        hasResponse: !!err.response
      });

      // User-friendly error messages
      let errorMessage = "❌ Failed to save your details. Please try again.";

      if (err.message === "Token expired") {
        errorMessage = "🔒 Your session has expired. Redirecting to login...";
        toast.error(errorMessage);
        setTimeout(() => {
          localStorage.clear();
          window.location.href = '/login';
        }, 2000);
        return;
      }

      if (err.response) {
        // Server responded with error
        const backendError = err.response.data?.error || err.response.data?.message;
        
        switch (err.response.status) {
          case 400:
            errorMessage = `❌ Invalid data: ${backendError || "Please check your inputs"}`;
            break;
          case 401:
            errorMessage = "🔒 Session expired. Redirecting to login...";
            toast.error(errorMessage);
            setTimeout(() => {
              localStorage.clear();
              window.location.href = '/login';
            }, 2000);
            return;
          case 404:
            errorMessage = "❌ Service not found. Please contact support.";
            break;
          case 409:
            errorMessage = "⚠️ This information already exists. Please use different details.";
            break;
          case 500:
            errorMessage = `❌ Server error: ${backendError || "Our team has been notified. Please try again later."}`;
            break;
          default:
            if (backendError) {
              errorMessage = `❌ ${backendError}`;
            }
        }
      } else if (err.request) {
        // Request made but no response
        console.error("❌ No response from server");
        errorMessage = "🔌 Cannot connect to server. Please check:\n• Is your internet working?\n• Is the backend running?";
      } else {
        // Something else went wrong
        errorMessage = `❌ Request failed: ${err.message}`;
      }

      toast.error(errorMessage, { autoClose: 5000 });
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
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-6"
      style={{
        background:
          "linear-gradient(to bottom, rgb(0, 40, 38), rgb(0, 85, 58))",
      }}
    >
      <div className="bg-[#0D191C] text-white rounded-3xl shadow-2xl flex flex-col lg:flex-row w-full max-w-6xl overflow-hidden">
        <div className="w-full lg:w-1/2 p-6 sm:p-10 flex flex-col justify-center text-center lg:text-left">
          <div className="flex justify-center lg:justify-start mb-6">
            <img className="w-48 sm:w-64" src="https://res.cloudinary.com/dqdvr35aj/image/upload/v1748330108/Logo1_zbbbz4.png" alt="profit first" />
          </div>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-semibold text-[#12EB8E] leading-tight">
            Let us find <br /> more about <br /> you...
          </h1>
        </div>

        {/* Form Section */}
        <div className="w-full lg:w-1/2 p-6 sm:p-10">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0">
              <div className="w-full sm:w-1/2">
                <label className="block text-sm mb-1">Full Name</label>
                <input
                  type="text"
                  name="fullName"
                  value={form.fullName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-md bg-transparent border border-gray-400 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="w-full sm:w-1/2">
                <label className="block text-sm mb-1">Work Mail</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-md bg-transparent border border-gray-400 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1">Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-md bg-transparent border border-gray-400 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Whats app Number</label>
              <input
                type="tel"
                name="whatsapp"
                value={form.whatsapp}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-md bg-transparent border border-gray-400 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm mb-1 text-white">Industry</label>
              <select
                name="industry"
                value={form.industry}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-md bg-[#0D191C] border border-gray-400 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Select</option>
                <option value="E-commerce">E-commerce</option>
                <option value="Technology">Technology</option>
                <option value="Health & Wellness">Health & Wellness</option>
                <option value="Finance">Finance</option>
                <option value="Education">Education</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1 text-white">
                Where did you hear about Profit First
              </label>
              <select
                name="referral"
                value={form.referral}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-md bg-[#0D191C] border border-gray-400 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Select</option>
                <option value="Google Search">Google Search</option>
                <option value="YouTube">YouTube</option>
                <option value="Social Media">Social Media</option>
                <option value="Friend or Colleague">Friend or Colleague</option>
                <option value="Event or Webinar">Event or Webinar</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <button
                type="submit"
                className="w-full py-3 rounded-md hover:text-white transition duration-200 text-black font-semibold"
                style={{ backgroundColor: "#12EB8E" }}
              >
                Done
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Step1;
