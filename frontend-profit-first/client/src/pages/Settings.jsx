import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../axios";
import { toast } from "react-toastify";
import { logout as logoutService, changePassword } from "../services/authService";

const TABS = ["Account", "Security", "Shopify", "Meta Ads", "Shiprocket"];

export default function Settings() {
  const [profile, setProfile] = useState(null);
  const [basic, setBasic] = useState({ firstName: "", lastName: "", email: "" });
  const [shopify, setShopify] = useState({ storeUrl: "", apiKey: "", apiSecret: "", accessToken: "" });
  const [meta, setMeta] = useState({ adAccountId: "" });
  const [shiprocket, setShiprocket] = useState({ shiproactId: "", shiproactPassword: "" });
  const [activeTab, setActiveTab] = useState("Account");
  const [passwordData, setPasswordData] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    axiosInstance
      .get("/user/profile")
      .then((res) => {
        const data = res.data;
        setProfile(data);
        setBasic({
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          email: data.email || "",
        });
        setShopify(data.onboarding.step2 || { storeUrl: "", apiKey: "", apiSecret: "", accessToken: "" });
        setMeta(data.onboarding.step4 || { adAccountId: "" });
        setShiprocket(data.onboarding.step5 || { shiproactId: "", shiproactPassword: "" });
      })
      .catch((err) => console.error("Error fetching profile:", err));
  }, []);

  const save = async (url, payload) => {
    try {
      await axiosInstance.put(url, payload);
      toast.success("Saved successfully!");
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Error saving data");
    }
  };

  if (!profile) {
    return <div className="text-center py-20 text-white">Loading…</div>;
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <h1 className="text-3xl font-bold text-white">Settings</h1>
      <p className="text-gray-400 mt-1 mb-6">Manage your account settings and preferences</p>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-8">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition 
              ${activeTab === tab
                ? "bg-white text-black"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"}
            `}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content Sections */}
      {activeTab === "Account" && (
        <div className="bg-[#161616] p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-white mb-2">Profile</h2>
          <p className="text-gray-400 mb-4">Set your account details</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Name</label>
              <input
                type="text"
                value={basic.firstName}
                onChange={(e) => setBasic(b => ({ ...b, firstName: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white"
                placeholder="First Name"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Surname</label>
              <input
                type="text"
                value={basic.lastName}
                onChange={(e) => setBasic(b => ({ ...b, lastName: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white"
                placeholder="Last Name"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-300 mb-1">Email</label>
              <input
                type="email"
                value={basic.email}
                onChange={(e) => setBasic(b => ({ ...b, email: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white"
                placeholder="Email"
              />
            </div>
          </div>
          <div className="mt-6">
            <button
              onClick={() => save("/user/profile/basic", basic)}
              className="bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-2 rounded transition"
            >
              Update
            </button>
          </div>
        </div>
      )}

      {activeTab === "Security" && (
        <div className="bg-[#161616] p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-white mb-2">Security Settings</h2>
          <p className="text-gray-400 mb-6">Manage your password and account security</p>

          {/* Change Password Section */}
          <div className="mb-8 pb-8 border-b border-gray-700">
            <h3 className="text-lg font-medium text-white mb-4">Change Password</h3>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Current Password</label>
                <input
                  type="password"
                  value={passwordData.oldPassword}
                  onChange={(e) => setPasswordData(p => ({ ...p, oldPassword: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white"
                  placeholder="Enter current password"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">New Password</label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData(p => ({ ...p, newPassword: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white"
                  placeholder="Enter new password"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Min 8 characters, uppercase, lowercase, number, and special character
                </p>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData(p => ({ ...p, confirmPassword: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white"
                  placeholder="Confirm new password"
                />
              </div>
              <button
                onClick={async () => {
                  if (!passwordData.oldPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
                    toast.error("Please fill all fields");
                    return;
                  }
                  if (passwordData.newPassword !== passwordData.confirmPassword) {
                    toast.error("New passwords do not match");
                    return;
                  }
                  setIsChangingPassword(true);
                  try {
                    const response = await changePassword(passwordData.oldPassword, passwordData.newPassword);
                    toast.success(response.message || "Password changed successfully!");
                    setPasswordData({ oldPassword: "", newPassword: "", confirmPassword: "" });
                  } catch (error) {
                    toast.error(error.response?.data?.error || error.response?.data?.message || "Failed to change password");
                  } finally {
                    setIsChangingPassword(false);
                  }
                }}
                disabled={isChangingPassword}
                className="bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isChangingPassword ? "Changing..." : "Change Password"}
              </button>
            </div>
          </div>

          {/* Logout Section */}
          <div>
            <h3 className="text-lg font-medium text-white mb-4">Account Actions</h3>
            <button
              onClick={async () => {
                try {
                  await logoutService();
                  toast.success("Logged out successfully");
                  navigate("/login");
                } catch (error) {
                  // Even if API fails, clear local storage and redirect
                  localStorage.clear();
                  navigate("/login");
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-medium px-6 py-2 rounded transition"
            >
              Logout
            </button>
            <p className="text-xs text-gray-400 mt-2">
              This will log you out from all devices
            </p>
          </div>
        </div>
      )}

      {activeTab === "Shopify" && (
        <div className="bg-[#161616] p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-white mb-2">Shopify Credentials</h2>
          <p className="text-gray-400 mb-4">Connect your Shopify store</p>
          <div className="space-y-4">
            {['storeUrl','apiKey','apiSecret','accessToken'].map(field => (
              <div key={field}>
                <label className="block text-sm text-gray-300 mb-1 capitalize">{field}</label>
                <input
                  type="text"
                  value={shopify[field] || ''}
                  onChange={e => setShopify(s => ({ ...s, [field]: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white"
                  placeholder={field}
                />
              </div>
            ))}
            <button
              onClick={() => save("/user/profile/shopify", shopify)}
              className="mt-4 bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-2 rounded transition"
            >
              Update 
            </button>
          </div>
        </div>
      )}

      {activeTab === "Meta Ads" && (
        <div className="bg-[#161616] p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-white mb-2">Meta Ads</h2>
          <p className="text-gray-400 mb-4">Configure your Meta ad account</p>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Ad Account ID</label>
            <input
              type="text"
              value={meta.adAccountId || ''}
              onChange={e => setMeta(m => ({ ...m, adAccountId: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white"
              placeholder="Ad Account ID"
            />
          </div>
          <div className="mt-6">
            <button
              onClick={() => save("/user/profile/meta", meta)}
              className="bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-2 rounded transition"
            >
              Update
            </button>
          </div>
        </div>
      )}

      {activeTab === "Shiprocket" && (
        <div className="bg-[#161616] p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-white mb-2">Shiprocket</h2>
          <p className="text-gray-400 mb-4">Manage your Shiprocket credentials</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Email</label>
              <input
                type="email"
                value={shiprocket.shiproactId || ''}
                onChange={e => setShiprocket(s => ({ ...s, shiproactId: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white"
                placeholder="Shiprocket Email"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Password</label>
              <input
                type="password"
                value={shiprocket.shiproactPassword || ''}
                onChange={e => setShiprocket(s => ({ ...s, shiproactPassword: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white"
                placeholder="Shiprocket Password"
              />
            </div>
          </div>
          <div className="mt-6">
            <button
              onClick={() => save("/user/profile/shiprocket", shiprocket)}
              className="bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-2 rounded transition"
            >
              Update
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
