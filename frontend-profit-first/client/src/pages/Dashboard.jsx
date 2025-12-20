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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sync state
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

  // Sync handler - triggers manual sync and polls for status
  const handleSync = async () => {
    try {
      setIsSyncing(true);
      setSyncStatus({ status: 'in_progress', message: 'Starting sync...' });
      
      // Start the sync
      await axiosInstance.post('/onboard/manual-sync');
      
      // Poll for status every 5 seconds (reduced from 2s to avoid excessive requests)
      let pollCount = 0;
      const maxPolls = 120; // 10 minutes max (120 * 5 seconds)
      
      const pollInterval = setInterval(async () => {
        pollCount++;
        
        // Stop polling after max attempts
        if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
          setIsSyncing(false);
          setSyncStatus({ status: 'error', message: 'Sync timeout - please try again' });
          setTimeout(() => setSyncStatus(null), 5000);
          return;
        }
        
        try {
          const response = await axiosInstance.get('/onboard/sync-status');
          const status = response.data.status;
          setSyncStatus(status);
          
          // If sync is complete or errored, stop polling
          if (status.status === 'completed' || status.status === 'error' || status.status === 'idle') {
            clearInterval(pollInterval);
            setIsSyncing(false);
            
            // If completed successfully, refresh dashboard data
            if (status.status === 'completed') {
              console.log('✅ Sync completed, refreshing dashboard...');
              // Trigger dashboard refresh by updating dateRange (same values)
              setDateRange(prev => ({ ...prev }));
            }
            
            // Auto-hide status message after 5 seconds
            setTimeout(() => {
              setSyncStatus(null);
            }, 5000);
          }
        } catch (err) {
          console.error('Error polling sync status:', err);
          clearInterval(pollInterval);
          setIsSyncing(false);
          setSyncStatus({ status: 'error', message: 'Failed to get sync status' });
          
          // Auto-hide error after 5 seconds
          setTimeout(() => {
            setSyncStatus(null);
          }, 5000);
        }
      }, 5000); // Poll every 5 seconds instead of 2
      
    } catch (err) {
      console.error('Error starting sync:', err);
      setIsSyncing(false);
      setSyncStatus({ status: 'error', message: 'Failed to start sync' });
      
      // Auto-hide error after 5 seconds
      setTimeout(() => {
        setSyncStatus(null);
      }, 5000);
    }
  };

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
          {/* Sync Button */}
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className={`px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${
              isSyncing 
                ? 'bg-gray-600 cursor-not-allowed' 
                : 'bg-[#12EB8E] hover:bg-[#0fd67e] text-black'
            }`}
          >
            {isSyncing ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>{syncStatus?.ordersCount ? `${syncStatus.ordersCount} orders` : 'Syncing...'}</span>
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Sync Now</span>
              </>
            )}
          </button>
          
          {/* Sync Status Toast */}
          {syncStatus && syncStatus.status === 'completed' && (
            <div className="absolute top-full mt-2 right-0 bg-green-600 text-white px-4 py-2 rounded-md text-sm shadow-lg z-50">
              ✓ {syncStatus.message}
            </div>
          )}
          {syncStatus && syncStatus.status === 'error' && (
            <div className="absolute top-full mt-2 right-0 bg-red-600 text-white px-4 py-2 rounded-md text-sm shadow-lg z-50">
              ✗ {syncStatus.message}
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

      <div className="bg-[#00131C] rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-6">Cost Breakdown</h3>
        <div className="flex items-center justify-center">
          {pieData.length > 0 ? (
            <AnimatedPieChart
              data={pieData}
              centerLabel="Revenue"
              centerValue={`₹${revenueValue.toLocaleString("en-IN")}`}
              size={550}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400">
              No breakdown data
            </div>
          )}
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
        <h2 className="text-2xl font-bold mb-4 pt-6">🛍 Website Overview</h2>
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
