/**
 * Dashboard Component
 * 
 * PURPOSE: Main business analytics dashboard showing comprehensive e-commerce metrics
 * 
 * KEY FEATURES:
 * 1. Date Range Selection - Filter data by custom date ranges
 * 2. Performance Charts - Revenue, profit, costs visualization
 * 3. Cost Breakdown - Pie chart showing expense categories
 * 4. Marketing Analytics - Ad spend, ROAS, reach, clicks
 * 5. Product Performance - Best/least selling products
 * 6. Customer Analytics - New vs returning customers
 * 7. Shipping Status - Delivery tracking and status breakdown
 * 
 * DATA SOURCES:
 * - Shopify: Orders, revenue, products
 * - Meta/Facebook: Ad campaigns, ROAS
 * - Shiprocket: Shipping and delivery status
 * 
 * API ENDPOINT: GET /api/data/dashboard
 * Query params: startDate, endDate, userId
 */

import React, { useState, useEffect, useMemo } from "react";
import axiosInstance from "../../axios";
import { format } from "date-fns";
import AnimatedPieChart from "../components/AnimatedPieChart";
import {
  BarChart,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Sector,
} from "recharts";
import DateRangeSelector from "../components/DateRangeSelector";
import { PulseLoader } from "react-spinners";

/**
 * Card Component - Displays individual metric
 * 
 * @param {string} title - Metric name (e.g., "Revenue", "Orders")
 * @param {string|number} value - Metric value (e.g., "₹125,000", "45")
 * @param {string} formula - Optional tooltip showing how metric is calculated
 */
const Card = ({ title, value, formula }) => (
  <div className="group relative bg-[#161616] p-4 rounded-xl tooltip-wrapper">
    {formula && (
      <div className="bottom-full left-1/2 mb-2 w-max tooltip-box bg-gray-800 text-white text-xs rounded-md py-1 px-3 border border-gray-600 shadow-lg absolute transform -translate-x-1/2">
        {formula}
      </div>
    )}
    <div className="text-sm text-gray-300">{title}</div>
    <div className="text-xl font-bold text-white">
      {value != null ? value : "—"}
    </div>
  </div>
);
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0a2a2a] p-4 rounded-xl border border-gray-600 shadow-2xl text-white min-w-[240px]">
        <p className="font-bold text-lg mb-3 text-white">{label}</p>
        <div className="space-y-2.5">
          {payload.map((p, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-1 h-6 rounded-full" 
                  style={{ backgroundColor: p.color }}
                ></div>
                <span className="text-gray-400 text-sm">{p.name} :</span>
              </div>
              <span className="text-white text-base font-medium">
                {p.name.includes("Margin")
                  ? `₹ ${p.value.toFixed(2)}`
                  : `₹ ${p.value.toLocaleString("en-IN")}`}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const MarketingTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#00131C] p-4 rounded-lg border border-gray-700 shadow-xl text-white">
        <p className="font-bold text-base mb-2">{label}</p>
        {payload.map((p, i) => (
          <div
            key={i}
            style={{
              color: p.color,
              display: "flex",
              justifyContent: "space-between",
              width: "200px",
            }}
          >
            <span>{p.name}:</span>
            <span className="font-semibold">
              {p.name === "Spend"
                ? `₹${p.value.toLocaleString("en-IN")}`
                : p.name === "ROAS"
                  ? `${p.value.toFixed(2)}%`
                  : p.name === "Reach" || p.name === "Link Clicks"
                    ? p.value.toLocaleString("en-IN")
                    : p.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } =
    props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke={fill}
      />
    </g>
  );
};

const Dashboard = () => {
  // State for data, loading, and errors
  const [dashboardData, setDashboardData] = useState(null);
  const [shiprocketData, setShiprocketData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingShiprocket, setIsLoadingShiprocket] = useState(true);
  const [error, setError] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);

  const [dateRange, setDateRange] = useState(() => {
    // Set to last 30 days by default
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 29);
    return { startDate, endDate };
  });
  const [showDateSelector, setShowDateSelector] = useState(false);
  const [productView, setProductView] = useState("best");
  const [activeIndex, setActiveIndex] = useState(null);

  // Manual Shopify sync function
  const handleSyncShopify = async () => {
    try {
      setIsSyncing(true);
      setSyncStatus({ status: 'starting', message: 'Starting sync...' });
      
      const response = await axiosInstance.post('/data/sync-shopify');
      
      if (response.data.success) {
        setSyncStatus(response.data.status);
        
        // Poll for sync status every 10 seconds
        const pollInterval = setInterval(async () => {
          try {
            const statusResponse = await axiosInstance.get('/data/sync-status');
            const status = statusResponse.data.syncStatus;
            setSyncStatus(status);
            
            if (status.status === 'completed' || status.status === 'error') {
              clearInterval(pollInterval);
              setIsSyncing(false);
              
              if (status.status === 'completed') {
                // Refresh dashboard data
                window.location.reload();
              }
            }
          } catch (err) {
            console.error('Error polling sync status:', err);
          }
        }, 10000);
        
        // Stop polling after 10 minutes max
        setTimeout(() => {
          clearInterval(pollInterval);
          setIsSyncing(false);
        }, 600000);
      }
    } catch (err) {
      console.error('Sync error:', err);
      setSyncStatus({ status: 'error', message: err.response?.data?.message || 'Sync failed' });
      setIsSyncing(false);
    }
  };

  // Fetch effect
  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      setError(null);
      const startDateString = format(dateRange.startDate, "yyyy-MM-dd");
      const endDateString = format(dateRange.endDate, "yyyy-MM-dd");
      const userId = localStorage.getItem("userId");

      console.log('Fetching dashboard data:', {
        startDate: startDateString,
        endDate: endDateString,
        userId
      });

      try {
        const response = await axiosInstance.get("/data/dashboard", {
          params: {
            startDate: startDateString,
            endDate: endDateString,
            userId: userId
          },
        });

        console.log('✅ Dashboard data received:', response.data);
        
        // Check if sync is in progress
        if (response.data.syncInProgress) {
          console.log('🔄 Sync in progress:', response.data.syncStatus);
          setDashboardData({
            syncInProgress: true,
            syncStatus: response.data.syncStatus,
            message: response.data.message
          });
          
          // Poll for sync status every 30 seconds if sync is in progress
          setTimeout(() => {
            fetchDashboardData();
          }, 30000);
          
          return;
        }
        
        setDashboardData(response.data);
      } catch (err) {
        console.error('❌ Dashboard fetch error:', err);
        setError(err.response?.data?.message || err.message || 'Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [dateRange]);

  // Fetch Shiprocket data separately
  useEffect(() => {
    const fetchShiprocketData = async () => {
      setIsLoadingShiprocket(true);
      const startDateString = format(dateRange.startDate, "yyyy-MM-dd");
      const endDateString = format(dateRange.endDate, "yyyy-MM-dd");
      const userId = localStorage.getItem("userId");

      console.log('🚀 Fetching Shiprocket data:', {
        startDate: startDateString,
        endDate: endDateString,
        userId,
        timestamp: new Date().toISOString()
      });

      try {
        const response = await axiosInstance.get("/data/shiprocket-dashboard", {
          params: {
            startDate: startDateString,
            endDate: endDateString,
            userId: userId,
            _t: Date.now() // Cache buster
          },
        });

        console.log('✅ Shiprocket data received:', response.data);
        setShiprocketData(response.data);
      } catch (err) {
        console.error('❌ Shiprocket fetch error:', err);
        // Don't set error, just log it - Shiprocket is optional
        setShiprocketData(null);
      } finally {
        setIsLoadingShiprocket(false);
      }
    };

    fetchShiprocketData();
  }, [dateRange]);

  // Derived safe variables to avoid undefined errors
  const pieData = dashboardData?.financialsBreakdownData?.pieData ?? [];
  const financialList = dashboardData?.financialsBreakdownData?.list ?? [];
  const revenueValue = dashboardData?.financialsBreakdownData?.revenue ?? 0;
  const bestSelling = dashboardData?.products?.bestSelling ?? [];
  const leastSelling = dashboardData?.products?.leastSelling ?? [];
  const websiteOverview = dashboardData?.website ?? [];
  const summaryCards = dashboardData?.summary ?? [];
  const marketingCards = dashboardData?.marketing ?? [];
  const shippingCards = dashboardData?.shipping ?? [];
  const performanceChartData = dashboardData?.performanceChartData ?? [];
  const customerTypeByDay = dashboardData?.charts?.customerTypeByDay ?? [];
  const marketingChart = dashboardData?.charts?.marketing ?? [];

  // Debug logging
  useEffect(() => {
    if (dashboardData) {
      console.log('📊 Dashboard Data Check:', {
        hasPerformanceData: performanceChartData.length > 0,
        hasMarketingData: marketingChart.length > 0,
        hasCustomerData: customerTypeByDay.length > 0,
        hasPieData: pieData.length > 0
      });
    }
  }, [dashboardData, performanceChartData, marketingChart, customerTypeByDay, pieData]);

  // Handlers
  const onPieEnter = (_, index) => setActiveIndex(index);
  const onPieLeave = () => setActiveIndex(null);
  const onListHover = (name) => {
    const index = pieData.findIndex((item) => item.name === name);
    if (index >= 0) setActiveIndex(index);
  };

  const handleApply = (range) => {
    setDateRange({
      startDate: range.startDate,
      endDate: range.endDate
    });
    setShowDateSelector(false);
  };

  const [orderTypeActiveIndex, setOrderTypeActiveIndex] = useState(null);
  const [shipmentStatusActiveIndex, setShipmentStatusActiveIndex] = useState(null);

  const orderTypeData = dashboardData?.orderTypeData ?? [];
  const shipmentStatusData = useMemo(() => {
    const findValue = (title) => {
      const card = shippingCards.find(c => c.title === title);
      if (!card) return 0;
      const numValue = parseInt(String(card.value).replace(/[^0-9]/g, ''), 10);
      return isNaN(numValue) ? 0 : numValue;
    };

    return [
      { name: 'Delivered', value: findValue('Delivered'), color: '#0d2923' },
      { name: 'In-Transit', value: findValue('In-Transit'), color: '#1a4037' },
      { name: 'RTO', value: findValue('RTO'), color: '#2d6a4f' },
      { name: 'NDR Pending', value: findValue('NDR Pending'), color: '#40916c' },
      { name: 'Pickup Pending', value: findValue('Pickup Pending'), color: '#52b788' },
    ].filter(item => item.value > 0);
  }, [shippingCards]);

  const onOrderPieEnter = (_, index) => setOrderTypeActiveIndex(index);
  const onOrderListHover = (name) => {
    const index = orderTypeData.findIndex((item) => item.name === name);
    if (index >= 0) setOrderTypeActiveIndex(index);
  };

  const onShipmentPieEnter = (_, index) => setShipmentStatusActiveIndex(index);
  const onShipmentListHover = (name) => {
    const index = shipmentStatusData.findIndex((item) => item.name === name);
    if (index >= 0) setShipmentStatusActiveIndex(index);
  };
  const PieLegend = ({ data, onHover, onLeave }) => (
    <div className="flex flex-col justify-center space-y-3">
      {data.map((item) => (
        <div
          key={item.name}
          className="flex items-center cursor-pointer"
          onMouseEnter={() => onHover(item.name)}
          onMouseLeave={onLeave}
        >
          <div style={{ backgroundColor: item.color }} className="w-3 h-3 rounded-sm mr-3"></div>
          <div className="flex flex-col">
            <span className="text-gray-400 text-sm">{item.name}</span>
            <span className="text-white font-semibold">
              {item.value.toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      ))}
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0D1D1E]">
        <PulseLoader size={15} color="#12EB8E" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen text-red-500 bg-[#0D1D1E]">
        {error}
      </div>
    );
  }
  
  // Show sync progress if data is being synced
  if (dashboardData?.syncInProgress) {
    const syncStatus = dashboardData.syncStatus || {};
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0D1D1E] text-white">
        <div className="bg-[#161616] p-8 rounded-lg shadow-lg max-w-md w-full mx-4">
          <div className="text-center">
            <div className="mb-4">
              <PulseLoader size={12} color="#12EB8E" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Syncing Your Data</h2>
            <p className="text-gray-400 mb-4">
              {syncStatus.message || 'We are fetching your Shopify data. This may take several minutes.'}
            </p>
            
            {syncStatus.processedOrders > 0 && (
              <div className="bg-[#0D1D1E] p-4 rounded-lg mb-4">
                <div className="text-sm text-gray-300 mb-2">Progress:</div>
                <div className="text-lg font-semibold text-green-400">
                  {syncStatus.processedOrders} / {syncStatus.totalOrders || '?'} orders
                </div>
                {syncStatus.currentPage && (
                  <div className="text-sm text-gray-400">
                    Page {syncStatus.currentPage}
                  </div>
                )}
              </div>
            )}
            
            <div className="text-xs text-gray-500 mt-4">
              <p>• Syncing in progress...</p>
              <p>• You can safely close this page - sync will continue in background</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Show "Needs Sync" screen if no orders found
  if (dashboardData?.needsSync) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0D1D1E] text-white">
        <div className="bg-[#161616] p-8 rounded-lg shadow-lg max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-xl font-semibold mb-2">No Orders Found</h2>
            <p className="text-gray-400 mb-6">
              {dashboardData.message || 'Click the button below to sync your Shopify orders.'}
            </p>
            
            <button
              onClick={handleSyncShopify}
              disabled={isSyncing}
              className={`px-6 py-3 rounded-lg text-lg font-medium ${
                isSyncing 
                  ? 'bg-gray-600 cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {isSyncing ? (
                <span className="flex items-center gap-2">
                  <PulseLoader size={8} color="#fff" />
                  Syncing...
                </span>
              ) : (
                '🔄 Sync Shopify Orders (Last 3 Months)'
              )}
            </button>
            
            {syncStatus && (
              <div className={`mt-4 text-sm px-3 py-2 rounded ${
                syncStatus.status === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
              }`}>
                {syncStatus.message || syncStatus.status}
              </div>
            )}
            
            <div className="text-xs text-gray-500 mt-6">
              <p>• This will fetch your last 3 months of orders</p>
              <p>• Sync takes about 30 seconds per 250 orders</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!dashboardData) {
    return (
      <div className="flex justify-center items-center min-h-screen text-white bg-[#0D1D1E]">
        No data available for the selected period.
      </div>
    );
  }

  return (
    <div className="p-6 text-white space-y-6 overflow-x-hidden bg-[#0D1D1E] min-h-screen">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <div className="flex items-center gap-4 relative">
          {/* Sync Shopify Orders Button */}
          <button
            onClick={handleSyncShopify}
            disabled={isSyncing}
            className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${
              isSyncing 
                ? 'bg-gray-600 cursor-not-allowed' 
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isSyncing ? (
              <>
                <PulseLoader size={8} color="#fff" />
                <span>Syncing...</span>
              </>
            ) : (
              <>
                <span>🔄</span>
                <span>Sync Shopify Orders</span>
              </>
            )}
          </button>
          
          {/* Sync Status Display */}
          {syncStatus && (
            <div className={`text-xs px-2 py-1 rounded ${
              syncStatus.status === 'completed' ? 'bg-green-500/20 text-green-400' :
              syncStatus.status === 'error' ? 'bg-red-500/20 text-red-400' :
              'bg-yellow-500/20 text-yellow-400'
            }`}>
              {syncStatus.message || syncStatus.status}
            </div>
          )}
          
          <button
            onClick={() => setShowDateSelector(!showDateSelector)}
            className="px-3 py-1 rounded-md text-sm border bg-[#161616] border-gray-700"
          >
            {`${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()}`}
          </button>
          {showDateSelector && (
            <div className="absolute top-full mt-2 right-0 z-50 bg-[#161616] rounded-lg shadow-lg border border-gray-700">
              <DateRangeSelector onApply={handleApply} initialRange={dateRange} />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 w-full">
        {summaryCards.map(({ title, value, formula }) => (
          <Card key={title} title={title} value={value} formula={formula} />
        ))}
      </div>

      {/* Shiprocket Metrics Section */}
      {isLoadingShiprocket ? (
        <div className="bg-[#00131C] rounded-2xl p-6">
          <div className="flex items-center justify-center h-32">
            <PulseLoader size={10} color="#12EB8E" />
            <span className="ml-3 text-gray-400">Loading Shiprocket data...</span>
          </div>
        </div>
      ) : shiprocketData && shiprocketData.summary ? (
        <div className="bg-gradient-to-br from-[#001a1a] to-[#00131C] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              📦 Shiprocket + Meta Data
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Live API</span>
            </h3>
          </div>
          
          {/* Extract Shiprocket metrics */}
          {(() => {
            const shiprocketSummary = shiprocketData.summary || [];
            
            // Available metrics (with real data)
            const availableMetrics = shiprocketSummary.filter(card => 
              ['Revenue', 'Delivered Orders', 'Ad Spend', 'Shipping Charges', 'RTO Charges', 'Business Expenses', 'Net Profit', 'Net Profit Margin', 'ROAS', 'POAS', 'AOV', 'CPP'].includes(card.title) && 
              card.value !== '--'
            );
            
            // Unavailable metrics (COGS related)
            const unavailableMetrics = shiprocketSummary.filter(card => 
              ['COGS', 'Gross Profit', 'Gross Profit Margin'].includes(card.title) || 
              card.value === '--'
            );
            
            return (
              <>
                {/* Available Metrics */}
                {availableMetrics.length > 0 && (
                  <div className="mb-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                      {availableMetrics.map(({ title, value, formula }) => (
                        <Card key={title} title={title} value={value} formula={formula} />
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Unavailable Metrics */}
                {unavailableMetrics.length > 0 && (
                  <div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {unavailableMetrics.map(({ title, value, formula }) => (
                        <Card key={title} title={title} value={value} formula={formula} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      ) : null}

      <div className="bg-[#00131C] rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-4">Performance</h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={performanceChartData}
              margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
            >
              <defs>
                <linearGradient
                  id="revenueGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#00A389" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#00A389" stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis
                yAxisId="left"
                stroke="#4B5563"
                tick={{ fill: "#9CA3AF" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `₹${value / 1000}k`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#4B5563"
                tick={{ fill: "#9CA3AF" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
              />
              <XAxis
                dataKey="name"
                stroke="#4B5563"
                tick={{ fill: "#9CA3AF" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                fill="url(#revenueGradient)"
                stroke="#00A389"
                name="Revenue"
                yAxisId="left"
              />
              <Line
                type="monotone"
                dataKey="netProfit"
                stroke="#E3D35E"
                dot={false}
                strokeWidth={2}
                name="Net Profit"
                yAxisId="left"
              />
              <Bar
                dataKey="totalCosts"
                barSize={10}
                fill="#3B82F6"
                name="Total Costs"
                yAxisId="left"
              />
              <Line
                type="monotone"
                dataKey="netProfitMargin"
                stroke="#F44336"
                dot={false}
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Net Profit Margin"
                yAxisId="right"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cost Breakdown - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Main Cost Breakdown */}
        <div className="bg-[#00131C] rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-6">🛍️ Shopify Breakdown</h3>
          <div className="flex items-center justify-center">
            {pieData.length > 0 ? (
              <AnimatedPieChart
                data={pieData}
                centerLabel="Revenue"
                centerValue={`₹${revenueValue.toLocaleString("en-IN")}`}
                size={450}
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-400">
                No breakdown data
              </div>
            )}
          </div>
        </div>

        {/* Right: Shiprocket Cost Breakdown */}
        <div className="bg-[#00131C] rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-6">📦 Shiprocket Breakdown</h3>
          <div className="flex items-center justify-center">
            {(() => {
              if (!shiprocketData || !shiprocketData.summary) {
                return (
                  <div className="flex items-center justify-center h-64 text-gray-400">
                    No Shiprocket data
                  </div>
                );
              }

              const shiprocketSummary = shiprocketData.summary || [];
              
              // Extract values for pie chart
              const findValue = (title) => {
                const card = shiprocketSummary.find(c => c.title === title);
                if (!card || card.value === '--') return 0;
                const numValue = parseFloat(String(card.value).replace(/[^0-9.-]/g, ''));
                return isNaN(numValue) ? 0 : Math.abs(numValue);
              };

              const revenue = findValue('Revenue');
              const adSpend = findValue('Ad Spend');
              const shippingCost = findValue('Shipping Cost');
              const businessExpenses = findValue('Business Expenses');
              const netProfit = findValue('Net Profit');

              const shiprocketPieData = [
                { name: 'Ad Spend', value: adSpend, color: '#2d6a4f' },
                { name: 'Shipping Cost', value: shippingCost, color: '#1a4037' },
                { name: 'Business Expenses', value: businessExpenses, color: '#0d2923' },
                { name: 'Net Profit', value: Math.max(0, netProfit), color: '#40916c' },
              ].filter(item => item.value > 0);

              if (shiprocketPieData.length === 0) {
                return (
                  <div className="flex items-center justify-center h-64 text-gray-400">
                    No cost data available
                  </div>
                );
              }

              return (
                <AnimatedPieChart
                  data={shiprocketPieData}
                  centerLabel="Revenue"
                  centerValue={`₹${revenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
                  size={450}
                />
              );
            })()}
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold pt-6">Marketing</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 w-full">
        {marketingCards.map(({ title, value, formula }) => (
          <Card key={title} title={title} value={value} formula={formula} />
        ))}
      </div>

      <div className="bg-[#00131C] rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-4">
          Marketing Performance
        </h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={marketingChart}
              margin={{ top: 20, right: 40, bottom: 20, left: 20 }}
            >
              <XAxis
                dataKey="name"
                stroke="#4B5563"
                tick={{ fill: "#9CA3AF" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="left"
                stroke="#4B5563"
                tick={{ fill: "#9CA3AF" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#4B5563"
                tick={{ fill: "#9CA3AF" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v.toFixed(2)}%`}
              />
              <Tooltip content={<MarketingTooltip />} />
              <Bar
                dataKey="spend"
                name="Spend"
                yAxisId="left"
                barSize={8}
                fill="#10B981"
              />
              <Bar
                dataKey="reach"
                name="Reach"
                yAxisId="left"
                barSize={8}
                fill="#6366F1"
              />
              <Bar
                dataKey="linkClicks"
                name="Link Clicks"
                yAxisId="left"
                barSize={8}
                fill="#F59E0B"
              />
              <Line
                type="monotone"
                dataKey="roas"
                name="ROAS"
                yAxisId="right"
                dot={false}
                strokeWidth={2}
                stroke="#FBBF24"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="pb-6">
        <h2 className="text-2xl font-bold mb-4 pt-6">📊 Business Insights</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
          {websiteOverview.map(({ title, value, formula }) => (
            <Card key={title} title={title} value={value} formula={formula} />
          ))}
        </div>

        <div className="bg-[#161616] mt-10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="space-x-2">
              {["best", "least"].map((type) => (
                <button
                  key={type}
                  onClick={() => setProductView(type)}
                  className={`px-3 py-2 rounded-lg text-sm ${productView === type
                      ? "bg-[#434343] text-white font-bold"
                      : "bg-[#2a2a2a] text-gray-400"
                    }`}
                >
                  {type === "best"
                    ? "Best Selling Products"
                    : "Least Selling Products"}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-[225px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
            <table className="w-full text-left text-white">
              <thead className="border-b border-gray-700 sticky top-0 bg-[#161616]">
                <tr className="text-gray-400 text-sm">
                  <th className="py-2 px-2">NO.</th>
                  <th className="py-2 px-2">Product Name</th>
                  <th className="py-2 px-2">Orders</th>
                  <th className="py-2 px-2">Total Sales</th>
                </tr>
              </thead>
              <tbody>
                {(productView === "best" ? bestSelling : leastSelling).map(
                  (product, idx) => (
                    <tr
                      key={product.id || idx}
                      className="border-b border-gray-800 text-sm"
                    >
                      <td className="py-3 px-2">{idx + 1}</td>
                      <td className="py-3 px-2">{product.name}</td>
                      <td className="py-3 px-2">{product.sales}</td>
                      <td className="py-3 px-2">{product.total}</td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-[#00131C] rounded-2xl p-6 mt-6">
          <h3 className="text-xl font-bold text-white mb-4">
            Customer Type (New vs Returning)
          </h3>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={customerTypeByDay}
                margin={{ top: 20, right: 20, bottom: 20, left: 0 }}
              >
                <XAxis
                  dataKey="name"
                  stroke="#4B5563"
                  tick={{ fill: "#9CA3AF" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#4B5563"
                  tick={{ fill: "#9CA3AF" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(value, name) => {
                    return [value, name === "newCustomers" ? "New" : "Returning"];
                  }}
                  contentStyle={{
                    backgroundColor: "#161616",
                    border: "1px solid #2e2e2e",
                  }}
                />
                <Bar
                  dataKey="newCustomers"
                  stackId="a"
                  name="New Customers"
                  fill="#22c55e"
                />
                <Bar
                  dataKey="returningCustomers"
                  stackId="a"
                  name="Returning Customers"
                  fill="#6366F1"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>


      <h2 className="text-2xl font-bold pt-6">Shipping</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 w-full">
        {shippingCards.map(({ title, value, formula }) => (
          <Card key={title} title={title} value={value} formula={formula} />
        ))}
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-[#00131C] rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-6">Order Type Breakdown</h3>
          <div className="flex items-center justify-center">
            {orderTypeData.length > 0 ? (
              <AnimatedPieChart
                data={orderTypeData}
                centerLabel="Total Orders"
                centerValue={orderTypeData.reduce((sum, item) => sum + item.value, 0).toLocaleString("en-IN")}
                size={400}
              />
            ) : <div className="flex items-center justify-center h-full text-gray-400">No Order Data</div>}
          </div>
        </div>

        <div className="bg-[#00131C] rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-6">Shipment Status</h3>
          <div className="flex items-center justify-center">
            {shipmentStatusData.length > 0 ? (
              <AnimatedPieChart
                data={shipmentStatusData}
                centerLabel="Total Shipments"
                centerValue={shipmentStatusData.reduce((sum, item) => sum + item.value, 0).toLocaleString("en-IN")}
                size={450}
              />
            ) : <div className="flex items-center justify-center h-full text-gray-400">No Status Data</div>}
          </div>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
