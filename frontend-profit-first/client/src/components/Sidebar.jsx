import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { HiMenuAlt3, HiX } from "react-icons/hi";
import { 
  FiHome, 
  FiBarChart2, 
  FiPackage, 
  FiSettings, 
  FiHelpCircle,
  FiMessageSquare,
  FiTrendingUp,
  FiChevronDown,
  FiZap
} from "react-icons/fi";
import logo from "../assets/logo.png";

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showAffiliate, setShowAffiliate] = useState(true);
  const [showRunAdsMenu, setShowRunAdsMenu] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    navigate("/login");
  };

  return (
    <>
      {/* Mobile Topbar - Menu Icon */}
      <div className="md:hidden absolute top-4 left-4 z-50">
        <button onClick={() => setIsOpen(true)} className="text-white">
          <HiMenuAlt3 size={28} />
        </button>
      </div>
      
      <div
        className={`fixed top-0 left-0 h-screen w-72 2xl:w-80 bg-[#0a0a0a] text-white z-50 transform transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"} 
          md:static md:translate-x-0 md:block border-r border-gray-800`}
      >
        <div className="p-6 2xl:p-8 flex flex-col justify-between h-full">
          <div>
            {/* Close button (mobile only) */}
            <div className="flex justify-between items-center mb-8 md:hidden">
              <div className="flex items-center gap-2">
                <img src={logo} alt="Logo" className="h-8 w-auto" />
              </div>
              <button onClick={() => setIsOpen(false)}>
                <HiX size={28} />
              </button>
            </div>

            {/* Logo (desktop only) */}
            <div className="flex items-center gap-2 mb-8 hidden md:flex">
              <img src={logo} alt="Logo" className="h-8 2xl:h-10 w-auto" />
            </div>

            {/* Navigation */}
            <div className="space-y-1 2xl:space-y-2">
              <NavLink
                to="/dashboard/chatbot"
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 p-2 2xl:p-3 rounded-lg transition-colors text-sm 2xl:text-base ${
                    isActive ? "bg-[#1a1a1a] text-white" : "text-gray-400 hover:bg-[#1a1a1a] hover:text-white"
                  }`
                }
              >
                <FiMessageSquare className="w-4 h-4 2xl:w-5 2xl:h-5" />
                <span>Chatbot</span>
              </NavLink>

              <NavLink
                to="/dashboard/growth"
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 p-2 2xl:p-3 rounded-lg transition-colors text-sm 2xl:text-base ${
                    isActive ? "bg-[#1a1a1a] text-white" : "text-gray-400 hover:bg-[#1a1a1a] hover:text-white"
                  }`
                }
              >
                <FiTrendingUp className="w-4 h-4 2xl:w-5 2xl:h-5" />
                <span>Growth</span>
              </NavLink>
              <NavLink
                to="/dashboard"
                end
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 p-2 2xl:p-3 rounded-lg transition-colors text-sm 2xl:text-base ${
                    isActive ? "bg-[#1a1a1a] text-white" : "text-gray-400 hover:bg-[#1a1a1a] hover:text-white"
                  }`
                }
              >
                <FiHome className="w-4 h-4 2xl:w-5 2xl:h-5" />
                <span>Dashboard</span>
              </NavLink>

              <NavLink
                to="/dashboard/analytics"
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 p-2 2xl:p-3 rounded-lg transition-colors text-sm 2xl:text-base ${
                    isActive ? "bg-[#1a1a1a] text-white" : "text-gray-400 hover:bg-[#1a1a1a] hover:text-white"
                  }`
                }
              >
                <FiBarChart2 className="w-4 h-4 2xl:w-5 2xl:h-5" />
                <span>Customer Analytics</span>
                <span className="ml-auto bg-green-500/20 text-green-400 text-[10px] 2xl:text-xs px-1.5 py-0.5 rounded">β</span>
              </NavLink>

              <NavLink
                to="/dashboard/products"
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 p-2 2xl:p-3 rounded-lg transition-colors text-sm 2xl:text-base ${
                    isActive ? "bg-[#1a1a1a] text-white" : "text-gray-400 hover:bg-[#1a1a1a] hover:text-white"
                  }`
                }
              >
                <FiPackage className="w-4 h-4 2xl:w-5 2xl:h-5" />
                <span>Products</span>
              </NavLink>

              {/* Run Ads with Dropdown */}
              <div 
                className="relative"
                onMouseEnter={() => setShowRunAdsMenu(true)}
                onMouseLeave={() => setShowRunAdsMenu(false)}
              >
                <div
                  className="flex items-center gap-2 p-2 2xl:p-3 rounded-lg transition-colors text-sm 2xl:text-base text-gray-400 hover:bg-[#1a1a1a] hover:text-white cursor-pointer"
                >
                  <FiZap className="w-4 h-4 2xl:w-5 2xl:h-5" />
                  <span>Run Ads</span>
                  <FiChevronDown 
                    className={`w-4 h-4 ml-auto transition-transform ${showRunAdsMenu ? 'rotate-180' : ''}`}
                  />
                </div>

                {/* Dropdown Menu */}
                {showRunAdsMenu && (
                  <div className="ml-6 mt-1 space-y-1">
                    <NavLink
                      to="/dashboard/meta-ads"
                      onClick={() => setIsOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-2 p-2 2xl:p-3 rounded-lg transition-colors text-sm 2xl:text-base ${
                          isActive ? "bg-[#1a1a1a] text-white" : "text-gray-400 hover:bg-[#1a1a1a] hover:text-white"
                        }`
                      }
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                      <span>Meta Ads</span>
                    </NavLink>
                    <div className="flex items-center gap-2 p-2 2xl:p-3 rounded-lg text-sm 2xl:text-base text-gray-600 cursor-not-allowed">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-600"></span>
                      <span>Google Ads</span>
                      <span className="ml-auto text-[10px] bg-gray-800 px-1.5 py-0.5 rounded">Soon</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Affiliate Program Card */}
            {showAffiliate && (
              <div className="mt-8 bg-[#1a1a1a] rounded-lg p-4 relative">
                <button 
                  onClick={() => setShowAffiliate(false)}
                  className="absolute top-2 right-2 text-gray-500 hover:text-white"
                >
                  <HiX size={16} />
                </button>
                <div className="bg-green-500/20 text-green-400 text-xs font-semibold px-2 py-1 rounded inline-block mb-2">
                  New
                </div>
                <h3 className="text-white font-semibold mb-1">Partners affiliate program</h3>
                <p className="text-gray-400 text-sm mb-3">
                  Run your own affiliate program and earn up to 100$ a month.
                </p>
                <button className="text-green-400 text-sm font-medium hover:text-green-300 flex items-center gap-1">
                  Try it out →
                </button>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="space-y-1 border-t border-gray-800 pt-4 pb-6">
            <NavLink
              to="/dashboard/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 p-2 rounded-lg text-gray-400 hover:bg-[#1a1a1a] hover:text-white transition-colors text-sm"
            >
              <FiSettings size={16} />
              <span>Settings</span>
            </NavLink>
            <button className="w-full flex items-center gap-2 p-2 rounded-lg text-gray-400 hover:bg-[#1a1a1a] hover:text-white transition-colors text-sm">
              <FiHelpCircle size={16} />
              <span>Help Center</span>
            </button>
          </div>
        </div>
      </div>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default Sidebar; 
