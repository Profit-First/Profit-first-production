import React, { useState, useEffect } from "react";
import {
  FiPhone,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiPackage,
  FiShoppingBag,
  FiPlay,
  FiFileText,
  FiX,
  FiPause
} from "react-icons/fi";
import aiCalling from "../services/aiCalling";
import axiosInstance from "../../axios";

const OrderConfirmation = () => {
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCall, setSelectedCall] = useState(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [isTableCollapsed, setIsTableCollapsed] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState("Last 30 days");
  const [playingCallId, setPlayingCallId] = useState(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(null);
  const [isCallingInProgress, setIsCallingInProgress] = useState(false);
  const [callProgress, setCallProgress] = useState({ current: 0, total: 0 });
  const [orderCalls, setOrderCalls] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOrders: 0,
    confirmed: 0,
    cancelled: 0,
    pending: 0,
    modified: 0,
    confirmationRate: 0,
    totalValue: "₹0"
  });

  // Fetch real Shopify orders on component mount
  useEffect(() => {
    fetchShopifyOrders();
    
    // Auto-refresh orders every 2 minutes (120000ms)
    const refreshInterval = setInterval(() => {
      console.log('🔄 Auto-refreshing orders...');
      fetchShopifyOrders();
    }, 120000); // 2 minutes
    
    // Cleanup interval on component unmount
    return () => clearInterval(refreshInterval);
  }, []);

  const fetchShopifyOrders = async () => {
    try {
      setIsLoading(true);
      
      // Get date range for last 30 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      
      console.log('🔍 Fetching order confirmation data...');
      const response = await axiosInstance.get('/order-confirmation/data', {
        params: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          _t: Date.now() // Cache buster
        }
      });

      console.log('📦 Full API Response:', response);
      console.log('📦 Response Data:', response.data);
      console.log('📦 Response Data Type:', typeof response.data);
      console.log('📦 Response Data Keys:', response.data ? Object.keys(response.data) : 'null');
      
      // Try multiple possible response structures
      let orders = null;
      let stats = null;
      
      // Structure 1: { success: true, data: { orders: [...], stats: {...} } }
      if (response.data?.data?.orders) {
        orders = response.data.data.orders;
        stats = response.data.data.stats;
        console.log('✅ Found orders in response.data.data.orders');
      }
      // Structure 2: { orders: [...], stats: {...} }
      else if (response.data?.orders) {
        orders = response.data.orders;
        stats = response.data.stats;
        console.log('✅ Found orders in response.data.orders');
      }
      // Structure 3: Direct array
      else if (Array.isArray(response.data)) {
        orders = response.data;
        console.log('✅ Found orders as direct array');
      }
      
      console.log('📊 Orders found:', orders?.length || 0);
      console.log('📊 Stats found:', stats);

      if (orders && Array.isArray(orders) && orders.length > 0) {
        console.log(`✅ Found ${orders.length} orders from backend`);
        console.log('📦 First order sample:', orders[0]);
        console.log('📋 Customer details:', {
          name: orders[0].customerName,
          phone: orders[0].customerPhone,
          email: orders[0].customerEmail,
          orderValue: orders[0].totalPrice,
          items: orders[0].itemCount,
          paymentMethod: orders[0].paymentMethod,
          status: orders[0].orderStatus
        });
        
        // Transform backend orders to display format
        const transformedOrders = orders.map((order, index) => {
          const orderDate = new Date(order.createdAt);
          
          return {
            id: index,
            orderId: order.orderNumber || order.orderId || `#${order.orderId}`,
            customerName: order.customerName,
            phone: order.customerPhone,
            status: order.orderStatus,
            date: orderDate.toLocaleDateString('en-IN', { 
              day: 'numeric', 
              month: 'short',
              year: 'numeric'
            }),
            time: orderDate.toLocaleTimeString('en-IN', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: true
            }),
            orderValue: `₹${parseFloat(order.totalPrice).toLocaleString('en-IN', { 
              minimumFractionDigits: 0,
              maximumFractionDigits: 0 
            })}`,
            items: order.itemCount,
            paymentMethod: order.paymentMethod,
            callDuration: order.callAttempts > 0 ? "1:30" : "0:00",
            hasRecording: order.callAttempts > 0,
            waveform: [30, 60, 45, 80, 55, 90, 40, 70, 35, 85, 50, 75, 60, 40, 55],
            transcript: order.callNotes || "",
            callStatus: order.callStatus,
            lastCallDate: order.lastCallDate,
            // Store original order data for reference
            originalOrder: order
          };
        });

        console.log(`✅ Transformed ${transformedOrders.length} orders for display`);
        console.log('📋 First transformed order:', transformedOrders[0]);

        // Update state with transformed orders
        setOrderCalls(transformedOrders);
        console.log('✅ setOrderCalls called with', transformedOrders.length, 'orders');

        // Use stats from backend (with fallback calculation)
        let formattedStats;
        if (stats) {
          console.log('📊 Using backend stats:', stats);
          formattedStats = {
            totalOrders: stats.totalOrders || 0,
            confirmed: stats.confirmed || 0,
            cancelled: stats.cancelled || 0,
            pending: stats.pending || 0,
            modified: stats.modified || 0,
            confirmationRate: stats.confirmationRate || 0,
            totalValue: `₹${parseFloat(stats.totalValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
          };
        } else {
          // Calculate stats from orders if backend didn't provide them
          console.log('📊 Calculating stats from orders');
          const totalOrders = transformedOrders.length;
          const confirmed = transformedOrders.filter(o => o.status === 'confirmed').length;
          const cancelled = transformedOrders.filter(o => o.status === 'cancelled').length;
          const pending = transformedOrders.filter(o => o.status === 'pending').length;
          const totalValue = orders.reduce((sum, order) => sum + parseFloat(order.totalPrice || 0), 0);
          
          formattedStats = {
            totalOrders,
            confirmed,
            cancelled,
            pending,
            modified: 0,
            confirmationRate: totalOrders > 0 ? ((confirmed / totalOrders) * 100).toFixed(1) : 0,
            totalValue: `₹${totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
          };
        }
        
        setStats(formattedStats);
        console.log('✅ Stats updated:', formattedStats);
      } else {
        console.warn('⚠️ No orders found in response');
        console.warn('Response structure:', {
          success: response.data?.success,
          hasData: !!response.data?.data,
          hasOrders: !!response.data?.data?.orders,
          ordersLength: response.data?.data?.orders?.length
        });
        
        // Set empty state
        setOrderCalls([]);
        setStats({
          totalOrders: 0,
          confirmed: 0,
          cancelled: 0,
          pending: 0,
          modified: 0,
          confirmationRate: 0,
          totalValue: "₹0"
        });
      }
    } catch (error) {
      console.error('❌ Error fetching Shopify orders:', error);
      console.error('Error details:', error.response?.data || error.message);
      
      // Show empty state on error
      setOrderCalls([]);
      setStats({
        totalOrders: 0,
        confirmed: 0,
        cancelled: 0,
        pending: 0,
        modified: 0,
        confirmationRate: 0,
        totalValue: "₹0"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Removed mock data - using only real data from backend

  const getStatusIcon = (status) => {
    switch (status) {
      case "confirmed": return <FiCheckCircle className="text-green-500" />;
      case "cancelled": return <FiXCircle className="text-red-500" />;
      case "pending": return <FiClock className="text-yellow-500" />;
      default: return <FiPhone />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "confirmed": return "Confirmed";
      case "cancelled": return "Cancelled";
      case "pending": return "Pending";
      default: return status;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "confirmed": return "text-green-500 bg-green-500/10";
      case "cancelled": return "text-red-500 bg-red-500/10";
      case "pending": return "text-yellow-500 bg-yellow-500/10";
      default: return "text-gray-500 bg-gray-500/10";
    }
  };

  const filteredOrders = orderCalls.filter(order => {
    const matchesFilter = selectedFilter === "all" || order.status === selectedFilter;
    const matchesSearch = order.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.orderId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.phone?.includes(searchQuery);
    return matchesFilter && matchesSearch;
  });

  // Debug filtered orders
  console.log('🔍 Filter Debug:', {
    totalOrders: orderCalls.length,
    filteredCount: filteredOrders.length,
    selectedFilter,
    searchQuery,
    sampleOrder: orderCalls[0]
  });

  const handleStartConfirmationCalls = async () => {
    if (isCallingInProgress) return;

    setIsCallingInProgress(true);
    // Only call test number (Harsh)
    const pendingOrders = orderCalls.filter(order => 
      order.phone === "+919322023539" && order.status === "pending"
    );
    setCallProgress({ current: 0, total: pendingOrders.length });

    for (let i = 0; i < pendingOrders.length; i++) {
      const order = pendingOrders[i];
      setCallProgress({ current: i + 1, total: pendingOrders.length });

      try {
        const result = await aiCalling.makeOrderStatusCall({
          customerName: order.customerName,
          phoneNumber: order.phone.replace(/\s/g, ''),
          orderId: order.orderId,
          orderStatus: "pending",
          language: "hi-IN"
        });

        if (result.success) {
          console.log(`✅ Confirmation call initiated for ${order.customerName} - Call ID: ${result.callId}`);
        } else {
          console.error(`❌ Call failed for ${order.customerName}: ${result.error}`);
        }

        // Wait 5 seconds between calls
        if (i < pendingOrders.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (error) {
        console.error(`Error calling ${order.customerName}:`, error);
      }
    }

    setIsCallingInProgress(false);
    setCallProgress({ current: 0, total: 0 });
    alert('Confirmation calls completed! Check console for details.');
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0D1D1E] text-white p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading orders...</p>
        </div>
      </div>
    );
  }

  // Debug: Log current state before rendering
  console.log('🎨 Rendering with:', {
    orderCallsLength: orderCalls.length,
    filteredOrdersLength: filteredOrders.length,
    statsTotal: stats.totalOrders,
    selectedFilter,
    searchQuery
  });

  return (
    <div className="min-h-screen bg-[#0D1D1E] text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center gap-2">
          <FiShoppingBag className="w-6 h-6" />
          <h1 className="text-xl font-bold">Order Confirmation</h1>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          <div className="bg-black rounded-lg p-4 flex items-center justify-between shadow-lg">
            <div>
              <div className="text-xs text-gray-400 mb-1">Total Orders</div>
              <div className="text-2xl font-bold">{stats.totalOrders}</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
              <FiShoppingBag className="w-5 h-5 text-black" />
            </div>
          </div>
          <div className="bg-black rounded-lg p-4 flex items-center justify-between shadow-lg">
            <div>
              <div className="text-xs text-gray-400 mb-1">Confirmed</div>
              <div className="text-2xl font-bold">{stats.confirmed}</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
              <FiCheckCircle className="w-5 h-5 text-black" />
            </div>
          </div>
          <div className="bg-black rounded-lg p-4 flex items-center justify-between shadow-lg">
            <div>
              <div className="text-xs text-gray-400 mb-1">Cancelled</div>
              <div className="text-2xl font-bold">{stats.cancelled}</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
              <FiXCircle className="w-5 h-5 text-black" />
            </div>
          </div>
          <div className="bg-black rounded-lg p-4 flex items-center justify-between shadow-lg">
            <div>
              <div className="text-xs text-gray-400 mb-1">Pending</div>
              <div className="text-2xl font-bold">{stats.pending}</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
              <FiClock className="w-5 h-5 text-black" />
            </div>
          </div>
          <div className="bg-black rounded-lg p-4 flex items-center justify-between shadow-lg">
            <div>
              <div className="text-xs text-gray-400 mb-1">Confirm Rate</div>
              <div className="text-2xl font-bold">{stats.confirmationRate}%</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
              <FiCheckCircle className="w-5 h-5 text-black" />
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-[#161616] rounded-lg overflow-hidden shadow-lg">
          {/* Filter Bar inside table */}
          <div 
            className="p-3 flex items-center justify-between border-b border-gray-800 cursor-pointer"
            style={{ backgroundColor: 'rgb(22, 55, 40)' }}
            onClick={() => setIsTableCollapsed(!isTableCollapsed)}
          >
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

          <div 
            className={`overflow-x-auto transition-all duration-500 ease-in-out ${
              isTableCollapsed 
                ? 'opacity-0 max-h-0 overflow-hidden' 
                : 'opacity-100 max-h-[2000px]'
            }`}
            style={{ background: 'linear-gradient(to bottom, rgb(22, 55, 40), rgb(5, 15, 10))' }}
          >
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-center py-3 px-3 text-gray-400 text-sm font-normal bg-black">
                    Customer
                  </th>
                  <th className="text-center py-3 px-3 text-gray-400 text-sm font-normal bg-black">
                    Phone
                  </th>
                  <th className="text-center py-3 px-3 text-gray-400 text-sm font-normal bg-black">
                    Status
                  </th>
                  <th className="text-center py-3 px-3 text-gray-400 text-sm font-normal bg-black">
                    Order Value
                  </th>
                  <th className="text-center py-3 px-3 text-gray-400 text-sm font-normal bg-black">
                    Items
                  </th>
                  <th className="text-center py-3 px-3 text-gray-400 text-sm font-normal bg-black">
                    Payment
                  </th>
                  <th className="text-center py-3 px-3 text-gray-400 text-sm font-normal bg-black">
                    Date
                  </th>
                  <th className="text-center py-3 px-3 text-gray-400 text-sm font-normal bg-black">
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <FiPackage className="w-12 h-12 text-gray-600" />
                        <p className="text-gray-400 text-base">No orders found</p>
                        <p className="text-gray-500 text-sm">
                          {searchQuery 
                            ? "Try adjusting your search or filters" 
                            : "Orders will appear here once customers place orders"}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                  <tr 
                    key={order.id} 
                    className="border-b border-gray-800 hover:bg-black/30 transition-colors"
                  >
                    <td className="py-2 px-3 text-white text-xs text-center max-w-[120px]">
                      <div className="truncate" title={order.customerName}>{order.customerName}</div>
                    </td>
                    <td className="py-2 px-3 text-gray-300 text-xs text-center max-w-[110px]">
                      <div className="truncate" title={order.phone}>{order.phone}</div>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className={`inline-flex items-center justify-center gap-2 px-3 py-1 rounded-full min-w-[90px] ${
                        order.status === "confirmed" ? "bg-green-500" :
                        order.status === "cancelled" ? "bg-red-500" :
                        order.status === "pending" ? "bg-yellow-500" : "bg-gray-500"
                      }`}>
                        <span className="text-xs font-medium whitespace-nowrap text-black">
                          {getStatusText(order.status)}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-white text-xs text-center font-medium whitespace-nowrap">{order.orderValue}</td>
                    <td className="py-2 px-3 text-gray-300 text-xs text-center">{order.items}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap min-w-[70px] text-center ${order.paymentMethod === "COD"
                        ? "bg-orange-500 text-black"
                        : "bg-green-500 text-black"
                        }`}>
                        {order.paymentMethod}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-300 text-xs text-center whitespace-nowrap">{order.date}</td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 relative">
                        <button 
                          onClick={() => {
                            if (playingCallId === order.id) {
                              setPlayingCallId(null);
                            } else {
                              setPlayingCallId(order.id);
                            }
                          }}
                          className="hover:opacity-80 transition-opacity"
                        >
                          {playingCallId === order.id ? (
                            <FiPause className="w-3 h-3 text-white" />
                          ) : (
                            <FiPlay className="w-3 h-3 text-white" />
                          )}
                        </button>
                        <div className="flex items-center gap-0.5 h-3">
                          {(order.waveform || [30, 60, 45, 80, 55, 90, 40, 70, 35, 85, 50, 75, 60, 40, 55]).map((height, i) => (
                            <div 
                              key={i} 
                              className="w-0.5 bg-white rounded-full" 
                              style={{ height: `${height}%` }}
                            ></div>
                          ))}
                        </div>
                        <span className="text-xs text-white ml-1">{order.callDuration}</span>
                        {playingCallId === order.id && (
                          <div className="relative">
                            <button
                              onClick={() => setShowSpeedMenu(showSpeedMenu === order.id ? null : order.id)}
                              className="text-xs text-white ml-1 px-1.5 py-0.5 bg-black/50 rounded hover:bg-black/70 transition-colors"
                            >
                              {playbackSpeed}x
                            </button>
                            {showSpeedMenu === order.id && (
                              <div className="absolute top-full mt-1 right-0 bg-black border border-gray-700 rounded-lg shadow-xl z-50 py-1 min-w-[60px]">
                                {[1, 1.5, 2].map((speed) => (
                                  <button
                                    key={speed}
                                    onClick={() => {
                                      setPlaybackSpeed(speed);
                                      setShowSpeedMenu(null);
                                    }}
                                    className={`w-full px-3 py-1.5 text-xs text-left hover:bg-gray-800 transition-colors ${
                                      playbackSpeed === speed ? 'text-emerald-500 font-medium' : 'text-white'
                                    }`}
                                  >
                                    {speed}x
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex justify-between items-center">
          {/* Refresh Button */}
          <button 
            onClick={() => {
              console.log('🔄 Manual refresh triggered');
              fetchShopifyOrders();
            }}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg 
              className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isLoading ? 'Refreshing...' : 'Refresh Orders'}
          </button>

          {/* Calling Progress and Button */}
          <div className="flex gap-3 items-center">
            {isCallingInProgress && (
              <div className="text-sm text-gray-300">
                Calling {callProgress.current} of {callProgress.total}...
              </div>
            )}
            <button 
              onClick={handleStartConfirmationCalls}
              disabled={isCallingInProgress}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
                isCallingInProgress 
                  ? 'bg-gray-600 cursor-not-allowed' 
                  : 'bg-emerald-500 hover:bg-emerald-600'
              } text-black`}
            >
              <FiPhone className="w-4 h-4" />
              {isCallingInProgress ? 'Calling...' : 'Start Confirmation Calls'}
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

        {/* Transcript Modal */}
        {showTranscript && selectedCall && (
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            onClick={() => {
              setShowTranscript(false);
              setSelectedCall(null);
            }}
          >
            <div 
              className="rounded-xl border border-gray-700 max-w-xl w-full max-h-[70vh] overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              style={{ background: 'linear-gradient(to bottom, rgb(22, 55, 40), rgb(5, 15, 10))' }}
            >
              <div className="p-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Call Transcript</h3>
                  <p className="text-gray-300 text-xs mt-0.5">{selectedCall.customerName} - {selectedCall.time}</p>
                </div>
                <button 
                  onClick={() => {
                    setShowTranscript(false);
                    setSelectedCall(null);
                  }}
                  className="p-1.5 rounded-lg text-gray-300 hover:text-white transition-colors"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>
              <div 
                className="p-4 pb-6 overflow-y-scroll max-h-[58vh] scrollbar-hide"
              >
                <div className="space-y-3">
                  {selectedCall.transcript.split('\n').map((line, index) => {
                    const isAI = line.startsWith('AI:');
                    const isCustomer = line.startsWith('Customer:');
                    const text = line.replace(/^(AI:|Customer:)\s*/, '');
                    
                    return (
                      <div key={index} className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-lg p-3 ${
                          isAI 
                            ? 'bg-black/50 border border-gray-700' 
                            : 'bg-emerald-500/20 border border-emerald-500/40'
                        }`}>
                          <div className="text-[10px] text-gray-400 mb-1 font-medium">
                            {isAI ? 'AI Agent' : 'Customer'}
                          </div>
                          <p className="text-white text-sm leading-relaxed">{text}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderConfirmation;
