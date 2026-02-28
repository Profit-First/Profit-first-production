import React, { useState, useEffect } from "react";
import { 
  FiPhone, 
  FiPhoneMissed, 
  FiPhoneIncoming, 
  FiX,
  FiShoppingCart,
  FiCheckCircle,
  FiSearch,
  FiRefreshCw,
  FiMail,
  FiPlay,
  FiPause
} from "react-icons/fi";
import axiosInstance from "../../axios";
import aiCalling from "../services/aiCalling";

const AbandonedCall = () => {
  console.log('🚀 AbandonedCall component rendering...');
  
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [isTableCollapsed, setIsTableCollapsed] = useState(false);
  const [isCallingInProgress, setIsCallingInProgress] = useState(false);
  const [callProgress, setCallProgress] = useState({ current: 0, total: 0 });
  const [playingCallId, setPlayingCallId] = useState(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(null);
  
  // New state for abandoned carts
  const [abandonedCarts, setAbandonedCarts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  console.log('📊 Current state:', { 
    abandonedCarts: abandonedCarts.length, 
    isLoading, 
    error,
    lastFetched: lastFetched?.toISOString()
  });

  // Fetch abandoned carts from API
  const fetchAbandonedCarts = async () => {
    console.log('🛒 fetchAbandonedCarts called!');
    
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🔗 axiosInstance:', axiosInstance);
      console.log('🔗 baseURL:', axiosInstance.defaults.baseURL);
      console.log('🔗 Full URL:', axiosInstance.defaults.baseURL + '/shopify/abandoned-carts');
      
      const response = await axiosInstance.get('/shopify/abandoned-carts');
      
      console.log('📦 API Response status:', response.status);
      console.log('📦 API Response data:', response.data);
      
      if (response.data && response.data.success) {
        console.log(`✅ Loaded ${response.data.abandonedCarts.length} abandoned carts`);
        setAbandonedCarts(response.data.abandonedCarts);
        setLastFetched(new Date());
      } else {
        throw new Error(response.data?.message || 'API returned success: false');
      }
    } catch (err) {
      console.error('❌ Error fetching abandoned carts:', err);
      console.error('❌ Error message:', err.message);
      console.error('❌ Error response:', err.response);
      console.error('❌ Error response data:', err.response?.data);
      console.error('❌ Error response status:', err.response?.status);
      
      // Set mock data for testing
      console.log('🧪 Setting mock data for testing...');
      const mockData = [
        {
          id: 'mock-1',
          customerName: 'Mock Customer 1',
          email: 'mock1@example.com',
          phone: '+91 9876543210',
          cartValue: '₹2,500',
          currency: 'INR',
          createdAt: new Date().toISOString(),
          lineItems: [
            { title: 'Mock Product 1', quantity: 1, price: '1500' },
            { title: 'Mock Product 2', quantity: 2, price: '500' }
          ],
          totalItems: 3,
          callDuration: "1:30",
          waveform: [30, 60, 45, 80, 55, 90, 40, 70, 35, 85, 50, 75, 60, 40, 55]
        },
        {
          id: 'mock-2',
          customerName: 'Mock Customer 2',
          email: 'mock2@example.com',
          phone: null,
          cartValue: '₹1,800',
          currency: 'INR',
          createdAt: new Date().toISOString(),
          lineItems: [
            { title: 'Mock Product 3', quantity: 1, price: '1800' }
          ],
          totalItems: 1,
          callDuration: "0:00",
          waveform: [20, 30, 25, 40, 35, 50, 30, 40, 25, 45, 30, 35, 40, 30, 35]
        }
      ];
      
      setAbandonedCarts(mockData);
      setLastFetched(new Date());
      setError(err.response?.data?.message || err.message || 'Failed to load abandoned carts (showing mock data)');
    } finally {
      setIsLoading(false);
    }
  };

  // Load abandoned carts on component mount
  useEffect(() => {
    console.log('🚀 useEffect triggered - calling fetchAbandonedCarts...');
    fetchAbandonedCarts();
  }, []);

  // Test API connection
  useEffect(() => {
    const testAPI = async () => {
      try {
        console.log('🧪 Testing API connection...');
        const response = await axiosInstance.get('/shopify/connection');
        console.log('🔗 Shopify connection status:', response.data);
      } catch (err) {
        console.error('❌ API connection test failed:', err);
        console.error('❌ Connection test error details:', err.response?.data);
      }
    };
    testAPI();
  }, []);

  const stats = {
    totalCarts: abandonedCarts.length,
    totalValue: abandonedCarts.reduce((sum, cart) => {
      const value = parseFloat(cart.cartValue.replace(/[₹,]/g, '')) || 0;
      return sum + value;
    }, 0),
    withPhone: abandonedCarts.filter(cart => cart.phone).length,
    withoutPhone: abandonedCarts.filter(cart => !cart.phone).length,
    avgCartValue: abandonedCarts.length > 0 ? 
      abandonedCarts.reduce((sum, cart) => {
        const value = parseFloat(cart.cartValue.replace(/[₹,]/g, '')) || 0;
        return sum + value;
      }, 0) / abandonedCarts.length : 0
  };

  const handleStartCampaign = async () => {
    if (isCallingInProgress) return;

    setIsCallingInProgress(true);
    // Get carts with phone numbers
    const cartsWithPhone = abandonedCarts.filter(cart => cart.phone);
    setCallProgress({ current: 0, total: cartsWithPhone.length });

    for (let i = 0; i < cartsWithPhone.length; i++) {
      const cart = cartsWithPhone[i];
      setCallProgress({ current: i + 1, total: cartsWithPhone.length });

      try {
        // Extract items from cart
        const items = cart.lineItems.map(item => item.title);
        
        const result = await aiCalling.makeAbandonedCartCall({
          customerName: cart.customerName,
          phoneNumber: cart.phone.replace(/\s/g, ''), // Remove spaces
          cartItems: items,
          cartValue: parseInt(cart.cartValue.replace(/[₹,]/g, '')),
          language: "hi-IN"
        });

        if (result.success) {
          console.log(`✅ Call initiated for ${cart.customerName} - Call ID: ${result.callId}`);
        } else {
          console.error(`❌ Call failed for ${cart.customerName}: ${result.error}`);
        }

        // Wait 5 seconds between calls
        if (i < cartsWithPhone.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (error) {
        console.error(`Error calling ${cart.customerName}:`, error);
      }
    }

    setIsCallingInProgress(false);
    setCallProgress({ current: 0, total: 0 });
    alert(`Campaign completed! Called ${cartsWithPhone.length} customers. Check console for details.`);
  };

  const filteredCarts = abandonedCarts.filter(cart => {
    const matchesFilter = selectedFilter === "all" || 
      (selectedFilter === "with-phone" && cart.phone) ||
      (selectedFilter === "without-phone" && !cart.phone);
    const matchesSearch = cart.customerName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (cart.phone && cart.phone.includes(searchQuery)) ||
                         (cart.email && cart.email.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#0D1D1E] text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center gap-2">
          <FiShoppingCart className="w-6 h-6" />
          <h1 className="text-xl font-bold">Abandoned Carts</h1>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-black rounded-lg p-4 flex items-center justify-between shadow-lg">
            <div>
              <div className="text-xs text-gray-400 mb-1">Total Carts</div>
              <div className="text-2xl font-bold">{stats.totalCarts}</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
              <FiShoppingCart className="w-5 h-5 text-black" />
            </div>
          </div>
          
          <div className="bg-black rounded-lg p-4 flex items-center justify-between shadow-lg">
            <div>
              <div className="text-xs text-gray-400 mb-1">Total Value</div>
              <div className="text-2xl font-bold">₹{stats.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
              <FiCheckCircle className="w-5 h-5 text-black" />
            </div>
          </div>
          
          <div className="bg-black rounded-lg p-4 flex items-center justify-between shadow-lg">
            <div>
              <div className="text-xs text-gray-400 mb-1">With Phone</div>
              <div className="text-2xl font-bold">{stats.withPhone}</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
              <FiPhone className="w-5 h-5 text-black" />
            </div>
          </div>
          
          <div className="bg-black rounded-lg p-4 flex items-center justify-between shadow-lg">
            <div>
              <div className="text-xs text-gray-400 mb-1">Without Phone</div>
              <div className="text-2xl font-bold">{stats.withoutPhone}</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
              <FiPhoneMissed className="w-5 h-5 text-black" />
            </div>
          </div>
          
          <div className="bg-black rounded-lg p-4 flex items-center justify-between shadow-lg">
            <div>
              <div className="text-xs text-gray-400 mb-1">Avg Value</div>
              <div className="text-2xl font-bold">₹{stats.avgCartValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
              <FiPhoneIncoming className="w-5 h-5 text-black" />
            </div>
          </div>
        </div>

        {/* Abandoned Carts Table */}
        <div className="bg-[#161616] rounded-lg overflow-hidden shadow-lg">
          {/* Filter Bar */}
          <div 
            className="p-3 flex items-center justify-between border-b border-gray-800 cursor-pointer"
            style={{ backgroundColor: 'rgb(22, 55, 40)' }}
            onClick={() => setIsTableCollapsed(!isTableCollapsed)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold text-white">Customer List</h2>
                <div className="flex items-center gap-2">
                  {showSearch ? (
                    <div className="flex items-center gap-2 bg-black rounded-lg px-3 py-1.5 shadow-md animate-slideIn" onClick={(e) => e.stopPropagation()}>
                      <FiSearch className="text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name or phone..."
                        className="bg-transparent text-white placeholder-gray-400 outline-none w-48 text-sm"
                        autoFocus
                      />
                      <button onClick={(e) => {
                        e.stopPropagation();
                        setShowSearch(false);
                        setSearchQuery("");
                      }}>
                        <FiX className="text-gray-400 hover:text-white w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFilter("all");
                      }}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-md ${
                        selectedFilter === "all" 
                          ? "bg-black text-white" 
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      All
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div 
            className={`overflow-x-auto transition-all duration-500 ease-in-out ${
              isTableCollapsed 
                ? 'opacity-0 max-h-0 overflow-hidden' 
                : 'opacity-100 max-h-[2000px]'
            }`}
            style={{ background: 'linear-gradient(to bottom, rgb(22, 55, 40), rgb(5, 15, 10))' }}
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
                  <div className="text-center">
                    <div className="text-lg font-medium">Loading abandoned carts...</div>
                    <div className="text-sm">Fetching data from Shopify</div>
                  </div>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center max-w-md">
                  <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                    <FiX className="w-8 h-8 text-red-400" />
                  </div>
                  <div className="text-lg font-medium text-white mb-2">Failed to load data</div>
                  <div className="text-sm text-[#9ca3af] mb-6">{error}</div>
                  <button
                    onClick={fetchAbandonedCarts}
                    className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-black rounded-lg font-medium transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : filteredCarts.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center max-w-md">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                    <FiShoppingCart className="w-8 h-8 text-emerald-500" />
                  </div>
                  <div className="text-lg font-medium text-white mb-2">No abandoned carts found</div>
                  <div className="text-sm text-[#9ca3af]">
                    {searchQuery ? 'Try adjusting your search criteria' : 'Great! No customers have abandoned their carts recently.'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-center py-3 px-3 text-gray-400 text-sm font-normal bg-black">Customer</th>
                      <th className="text-center py-3 px-3 text-gray-400 text-sm font-normal bg-black">Phone</th>
                      <th className="text-center py-3 px-3 text-gray-400 text-sm font-normal bg-black">Cart Value</th>
                      <th className="text-center py-3 px-3 text-gray-400 text-sm font-normal bg-black">Items</th>
                      <th className="text-center py-3 px-3 text-gray-400 text-sm font-normal bg-black">Date</th>
                      <th className="text-center py-3 px-3 text-gray-400 text-sm font-normal bg-black">Calls Done</th>
                      <th className="text-center py-3 px-3 text-gray-400 text-sm font-normal bg-black">Summary</th>
                      <th className="text-center py-3 px-3 text-gray-400 text-sm font-normal bg-black">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCarts.map((cart, index) => (
                      <tr 
                        key={cart.id} 
                        className="border-b border-gray-800 hover:bg-black/30 transition-colors"
                      >
                        <td className="py-2 px-3 text-white text-xs text-center max-w-[120px]">
                          <div className="truncate" title={cart.customerName}>{cart.customerName}</div>
                        </td>
                        <td className="py-2 px-3 text-gray-300 text-xs text-center max-w-[110px]">
                          <div className="truncate" title={cart.phone || 'No phone'}>{cart.phone || 'No phone'}</div>
                        </td>
                        <td className="py-2 px-3 text-white text-xs text-center font-medium whitespace-nowrap">{cart.cartValue}</td>
                        <td className="py-2 px-3 text-gray-300 text-xs text-center">{cart.totalItems}</td>
                        <td className="py-2 px-3 text-gray-300 text-xs text-center whitespace-nowrap">
                          {new Date(cart.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5 relative">
                            <button 
                              onClick={() => {
                                if (playingCallId === cart.id) {
                                  setPlayingCallId(null);
                                } else {
                                  setPlayingCallId(cart.id);
                                }
                              }}
                              className="hover:opacity-80 transition-opacity"
                            >
                              {playingCallId === cart.id ? (
                                <FiPause className="w-3 h-3 text-white" />
                              ) : (
                                <FiPlay className="w-3 h-3 text-white" />
                              )}
                            </button>
                            <div className="flex items-center gap-0.5 h-3">
                              {(cart.waveform || [30, 60, 45, 80, 55, 90, 40, 70, 35, 85, 50, 75, 60, 40, 55]).map((height, i) => (
                                <div 
                                  key={i} 
                                  className="w-0.5 bg-white rounded-full" 
                                  style={{ height: `${height}%` }}
                                ></div>
                              ))}
                            </div>
                            <span className="text-xs text-white ml-1">{cart.callDuration || "0:00"}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center gap-3">
                            <span className="text-xs text-gray-300">
                              {cart.totalItems} items • {cart.cartValue}
                            </span>
                            {cart.lineItems && cart.lineItems.length > 0 && (
                              <div className="text-xs text-gray-400 max-w-[150px] truncate">
                                {cart.lineItems[0].title}
                                {cart.lineItems.length > 1 && ` +${cart.lineItems.length - 1} more`}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-center">
                          {cart.phone ? (
                            <span className="inline-block px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap min-w-[70px] text-center bg-emerald-500 text-black">
                              Ready
                            </span>
                          ) : (
                            <span className="inline-block px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap min-w-[70px] text-center bg-orange-500 text-black">
                              Email Only
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex justify-between items-center">
          {/* Refresh Button */}
          <button 
            onClick={() => {
              console.log('🔄 Manual refresh triggered');
              fetchAbandonedCarts();
            }}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiRefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Refreshing...' : 'Refresh Carts'}
          </button>

          {/* Calling Progress and Button */}
          <div className="flex gap-3 items-center">
            {isCallingInProgress && (
              <div className="text-sm text-gray-300">
                Calling {callProgress.current} of {callProgress.total}...
              </div>
            )}
            <button 
              onClick={handleStartCampaign}
              disabled={isCallingInProgress || stats.withPhone === 0}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
                isCallingInProgress || stats.withPhone === 0
                  ? 'bg-gray-600 cursor-not-allowed text-gray-400' 
                  : 'bg-emerald-500 hover:bg-emerald-600 text-black'
              }`}
            >
              <FiPhone className="w-4 h-4" />
              {isCallingInProgress ? 'Calling...' : 'Start AI Campaign'}
            </button>
          </div>
        </div>

        <style jsx>{`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateX(20px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          .animate-slideIn {
            animation: slideIn 0.3s ease-out;
          }
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>
      </div>
    </div>
  );
};

export default AbandonedCall;
