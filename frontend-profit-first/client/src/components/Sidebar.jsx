import { useState } from "react";
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
  FiZap,
  FiCpu,
  FiCheckCircle,
  FiPhoneCall,
  FiLogOut
} from "react-icons/fi";
import logo from "../assets/logo.png";

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showAffiliate, setShowAffiliate] = useState(true);
  const [showAIAgentMenu, setShowAIAgentMenu] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    // Clear all local storage
    localStorage.clear();
    // Redirect to login page
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
        className={`fixed top-0 left-0 h-screen w-56 2xl:w-64 bg-[#0a0a0a] text-white z-50 transform transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"} 
          md:static md:translate-x-0 md:block border-r border-gray-800`}
      >
        <div className="p-4 2xl:p-5 flex flex-col justify-between h-full">
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
            <div className="flex items-center gap-2 mb-6 hidden md:flex">
              <img src={logo} alt="Logo" className="h-6 2xl:h-8 w-auto" />
            </div>

            {/* Navigation */}
            <div className="space-y-0.5 2xl:space-y-1">

              <NavLink
                to="/dashboard"
                end
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 p-1.5 2xl:p-2 rounded-lg transition-colors text-xs 2xl:text-sm ${isActive ? "bg-[#1a1a1a] text-white" : "text-gray-400 hover:bg-[#1a1a1a] hover:text-white"
                  }`
                }
              >
                <FiHome className="w-3.5 h-3.5 2xl:w-4 2xl:h-4" />
                <span>Dashboard</span>
              </NavLink>

              <NavLink
                to="/dashboard/chatbot"
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 p-1.5 2xl:p-2 rounded-lg transition-colors text-xs 2xl:text-sm ${isActive ? "bg-[#1a1a1a] text-white" : "text-gray-400 hover:bg-[#1a1a1a] hover:text-white"
                  }`
                }
              >
                <FiMessageSquare className="w-3.5 h-3.5 2xl:w-4 2xl:h-4" />
                <span>Chatbot</span>
              </NavLink>

              <NavLink
                to="/dashboard/growth"
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 p-1.5 2xl:p-2 rounded-lg transition-colors text-xs 2xl:text-sm ${isActive ? "bg-[#1a1a1a] text-white" : "text-gray-400 hover:bg-[#1a1a1a] hover:text-white"
                  }`
                }
              >
                <FiTrendingUp className="w-3.5 h-3.5 2xl:w-4 2xl:h-4" />
                <span>Growth</span>
              </NavLink>


  <div className="relative group">
                <div
                  className="flex items-center gap-2 p-1.5 2xl:p-2 rounded-lg transition-colors text-xs 2xl:text-sm text-gray-600 cursor-not-allowed opacity-60"
                >
                  <FiZap className="w-3.5 h-3.5 2xl:w-4 2xl:h-4" />
                  <span>Customer Analytics</span>
                  <span className="ml-auto text-[9px] bg-gray-800 px-1 py-0.5 rounded">Soon</span>
                </div>
                {/* Tooltip on hover */}
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-lg border border-gray-700">
                  🚀 Coming soon with this feature!
                </div>
              </div>


              {/* <NavLink
                to="/dashboard/analytics"
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 p-2 2xl:p-3 rounded-lg transition-colors text-sm 2xl:text-base ${isActive ? "bg-[#1a1a1a] text-white" : "text-gray-400 hover:bg-[#1a1a1a] hover:text-white"
                  }`
                }
              >
                <FiBarChart2 className="w-4 h-4 2xl:w-5 2xl:h-5" />
                <span>Customer Analytics</span>
                <span className="ml-auto bg-green-500/20 text-green-400 text-[10px] 2xl:text-xs px-1.5 py-0.5 rounded">β</span>
              </NavLink> */}

              <NavLink
                to="/dashboard/products"
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 p-1.5 2xl:p-2 rounded-lg transition-colors text-xs 2xl:text-sm ${isActive ? "bg-[#1a1a1a] text-white" : "text-gray-400 hover:bg-[#1a1a1a] hover:text-white"
                  }`
                }
              >
                <FiPackage className="w-3.5 h-3.5 2xl:w-4 2xl:h-4" />
                <span>Products</span>
              </NavLink>

              {/* AI Ads - Disabled with Coming Soon tooltip */}
              <div className="relative group">
                <div
                  className="flex items-center gap-2 p-1.5 2xl:p-2 rounded-lg transition-colors text-xs 2xl:text-sm text-gray-600 cursor-not-allowed opacity-60"
                >
                  <FiZap className="w-3.5 h-3.5 2xl:w-4 2xl:h-4" />
                  <span>AI Ads</span>
                  <span className="ml-auto text-[9px] bg-gray-800 px-1 py-0.5 rounded">Soon</span>
                </div>
                {/* Tooltip on hover */}
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-lg border border-gray-700">
                  🚀 Coming soon with this feature!
                </div>
              </div>

              {/* AI Agent with Dropdown */}
              <div className="relative">
                <div
                  onClick={() => setShowAIAgentMenu(!showAIAgentMenu)}
                  className="flex items-center gap-2 p-1.5 2xl:p-2 rounded-lg transition-colors text-xs 2xl:text-sm text-gray-400 hover:bg-[#1a1a1a] hover:text-white cursor-pointer"
                >
                  <FiCpu className="w-3.5 h-3.5 2xl:w-4 2xl:h-4" />
                  <span>AI Agent</span>
                  <FiChevronDown
                    className={`w-3 h-3 ml-auto transition-transform ${showAIAgentMenu ? 'rotate-180' : ''}`}
                  />
                </div>

                {/* Dropdown Menu */}
                {showAIAgentMenu && (
                  <div className="ml-5 mt-1 space-y-0.5">
                    <NavLink
                      to="/dashboard/ai-agent/order-confirmations"
                      onClick={() => {
                        setIsOpen(false);
                        setShowAIAgentMenu(false);
                      }}
                      className={({ isActive }) =>
                        `flex items-center gap-2 p-1.5 2xl:p-2 rounded-lg transition-colors text-xs 2xl:text-sm ${isActive ? "bg-[#1a1a1a] text-white" : "text-gray-400 hover:bg-[#1a1a1a] hover:text-white"
                        }`
                      }
                    >
                      <FiCheckCircle className="w-3 h-3" />
                      <span>Order Confirmations</span>
                    </NavLink>
                    <NavLink
                      to="/dashboard/ai-agent/abandon-calls"
                      onClick={() => {
                        setIsOpen(false);
                        setShowAIAgentMenu(false);
                      }}
                      className={({ isActive }) =>
                        `flex items-center gap-2 p-1.5 2xl:p-2 rounded-lg transition-colors text-xs 2xl:text-sm ${isActive ? "bg-[#1a1a1a] text-white" : "text-gray-400 hover:bg-[#1a1a1a] hover:text-white"
                        }`
                      }
                    >
                      <FiPhoneCall className="w-3 h-3" />
                      <span>Abandon Calls</span>
                    </NavLink>
                  </div>
                )}
              </div>

              <NavLink
                to="/dashboard/business-expenses"
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 p-1.5 2xl:p-2 rounded-lg transition-colors text-xs 2xl:text-sm ${isActive ? "bg-[#1a1a1a] text-white" : "text-gray-400 hover:bg-[#1a1a1a] hover:text-white"
                  }`
                }
              >
                <FiSettings className="w-3.5 h-3.5 2xl:w-4 2xl:h-4" />
                <span>Business Expenses</span>
                <span className="ml-auto bg-blue-500/20 text-blue-400 text-[9px] 2xl:text-[10px] px-1 py-0.5 rounded">New</span>
              </NavLink>
            </div>

            {/* Affiliate Program Card */}
            {showAffiliate && (
              <div className="mt-6 bg-[#1a1a1a] rounded-lg p-3 relative">
                <button
                  onClick={() => setShowAffiliate(false)}
                  className="absolute top-1.5 right-1.5 text-gray-500 hover:text-white"
                >
                  <HiX size={14} />
                </button>
                <div className="bg-green-500/20 text-green-400 text-[10px] font-semibold px-1.5 py-0.5 rounded inline-block mb-1.5">
                  New
                </div>
                <h3 className="text-white font-semibold text-sm mb-1">Partners affiliate program</h3>
                <p className="text-gray-400 text-xs mb-2">
                  Run your own affiliate program and earn up to 100$ a month.
                </p>
               <a
  href="https://profitfirst-affiliate.vercel.app/"
  target="_blank"
  rel="noopener noreferrer"
  className="text-green-400 text-xs font-medium hover:text-green-300 flex items-center gap-1"
>
  Try it out →
</a>

              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="space-y-0.5 border-t border-gray-800 pt-3 pb-4">
            {/* Settings - Hidden for now */}
            <NavLink
              to="/dashboard/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 p-1.5 rounded-lg text-gray-400 hover:bg-[#1a1a1a] hover:text-white transition-colors text-xs"
            >
              <FiSettings size={14} />
              <span>Settings</span>
            </NavLink>
            <button className="w-full flex items-center gap-2 p-1.5 rounded-lg text-gray-400 hover:bg-[#1a1a1a] hover:text-white transition-colors text-xs">
              <FiHelpCircle size={14} />
              <span>Help Center</span>
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors text-xs"
            >
              <FiLogOut size={14} />
              <span>Logout</span>
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
