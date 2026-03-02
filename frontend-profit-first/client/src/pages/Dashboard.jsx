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
  CartesianGrid,
  ReferenceLine,
  Cell,
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
const Card = ({ title, value, formula, decision, decisionColor, subtitle }) => (
  <div className="group relative bg-[#161616] p-3 lg:p-4 rounded-xl tooltip-wrapper overflow-hidden">
    {formula && (
      <div className="bottom-full left-1/2 mb-2 w-max tooltip-box bg-gray-800 text-white text-xs rounded-md py-1 px-3 border border-gray-600 shadow-lg absolute transform -translate-x-1/2 z-10">
        {formula}
      </div>
    )}
    <div className="text-sm text-gray-300 mb-1 truncate">{title}</div>
    {subtitle && (
      <div className="text-xs text-gray-500 mb-1 truncate">{subtitle}</div>
    )}
    {decision ? (
      <div className={`text-lg font-bold ${decisionColor || 'text-yellow-400'} break-words`}>
        {decision}
      </div>
    ) : (
      <div className="text-xl lg:text-2xl font-bold text-white break-words overflow-hidden">
        {value != null ? value : "—"}
      </div>
    )}
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

      console.log('🚀 Fetching Shiprocket data (V2 - from revenue_stats):', {
        startDate: startDateString,
        endDate: endDateString,
        userId,
        timestamp: new Date().toISOString()
      });

      try {
        const response = await axiosInstance.get("/shipping/dashboard-v2", {
          params: {
            startDate: startDateString,
            endDate: endDateString,
            _t: Date.now() // Cache buster
          },
        });

        console.log('✅ Shiprocket data received (V2):', response.data);
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

  // Merge Shopify and Shipping data
  const mergedDashboardData = useMemo(() => {
    const findShopifyCard = (title) => summaryCards.find(c => c?.title === title);
    
    // NEW: Handle shiprocketData.summary as an object (not array)
    const findShippingCard = (title) => {
      if (!shiprocketData?.summary) return null;
      
      // Map the summary object to card format
      const summary = shiprocketData.summary;
      
      switch(title) {
        case 'Revenue':
          return {
            title: 'Revenue Earned',
            value: `₹${(summary.deliveredRevenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
            subtitle: 'Only delivered orders'
          };
        case 'Delivered Orders':
          return {
            title: 'Delivered Orders',
            value: summary.deliveredOrders || 0,
            subtitle: 'Successfully delivered'
          };
        case 'RTO Count':
          return {
            title: 'RTO Count',
            value: summary.rtoOrders || 0,
            subtitle: 'Returned to origin'
          };
        case 'Shipping Spend':
          return {
            title: 'Shipping Spend',
            value: `₹${(summary.shippingCost || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
            subtitle: 'Total freight charges'
          };
        case 'AOV':
          // Calculate AOV from Shiprocket data: Revenue / Delivered Orders
          const aov = summary.deliveredOrders > 0 
            ? (summary.deliveredRevenue / summary.deliveredOrders) 
            : 0;
          return {
            title: 'Average Order Value',
            value: `₹${aov.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
            subtitle: 'Revenue ÷ Delivered Orders'
          };
        case 'Shipping Per Order':
          // Calculate Shipping per Order: Shipping Cost / Delivered Orders
          const shippingPerOrder = summary.deliveredOrders > 0 
            ? (summary.shippingCost / summary.deliveredOrders) 
            : 0;
          return {
            title: 'Shipping per Order',
            value: `₹${shippingPerOrder.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
            subtitle: 'Shipping ÷ Delivered Orders'
          };
        case 'RTO Revenue Lost':
          // Calculate RTO Revenue Lost: RTO Count × AOV
          const rtoAov = summary.deliveredOrders > 0 
            ? (summary.deliveredRevenue / summary.deliveredOrders) 
            : 0;
          const rtoRevenueLost = (summary.rtoOrders || 0) * rtoAov;
          return {
            title: 'RTO Revenue Lost',
            value: `₹${rtoRevenueLost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
            subtitle: 'RTO Count × AOV',
            formula: `${summary.rtoOrders || 0} RTO orders × ₹${rtoAov.toLocaleString('en-IN', { maximumFractionDigits: 0 })} AOV`
          };
        default:
          return null;
      }
    };
    
    const findShopifyShippingCard = (title) => shippingCards.find(c => c?.title === title);
    const findShippingMetric = (title) => dashboardData?.shipping?.find(c => c?.title === title);

    // Helper to calculate decision for POAS
    const getDecision = () => {
      const poasCard = findShopifyCard('POAS');
      if (!poasCard) return { text: 'Calculating...', color: 'text-gray-400' };
      const poasValue = parseFloat(String(poasCard.value).replace(/[^0-9.-]/g, ''));
      if (isNaN(poasValue)) return { text: 'No Data Available', color: 'text-gray-400' };

      if (poasValue < 0) {
        return {
          text: '🚨 STOP SCALING - Fix Ads First',
          color: 'text-red-500',
          subtitle: 'Losing money on every order'
        };
      } else if (poasValue >= 0 && poasValue < 0.5) {
        return {
          text: '⚠️ DO NOT SCALE - Fix Ads First',
          color: 'text-orange-500',
          subtitle: 'Barely profitable, fix costs'
        };
      } else if (poasValue >= 0.5 && poasValue < 1) {
        return {
          text: '⚡ Scale Carefully',
          color: 'text-yellow-400',
          subtitle: 'Profitable but watch margins'
        };
      } else if (poasValue >= 1 && poasValue < 2) {
        return {
          text: '✅ Scale with Confidence',
          color: 'text-green-400',
          subtitle: 'Good margins, scale safely'
        };
      } else {
        return {
          text: '🚀 SCALE AGGRESSIVELY',
          color: 'text-emerald-400',
          subtitle: 'Excellent margins, go big!'
        };
      }
    };

    const decision = getDecision();

    // Helper to get risk level color
    const getRiskColor = (card) => {
      if (!card || !card.riskColor) return 'text-white';
      const colorMap = {
        'green': 'text-green-400',
        'yellow': 'text-yellow-400',
        'red': 'text-red-500',
        'gray': 'text-gray-400'
      };
      return colorMap[card.riskColor] || 'text-white';
    };

    // Helper to get COGS from Money Flow chart data (pieData)
    const getCogsFromPieData = () => {
      const cogsItem = pieData.find(item => item.name === 'Product Cost (COGS)');
      if (cogsItem && cogsItem.value > 0) {
        return {
          title: 'COGS',
          value: `₹${cogsItem.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
          subtitle: 'From delivered orders',
          formula: 'Cost of Goods Sold for delivered orders'
        };
      }
      return { title: 'COGS', value: '--', subtitle: 'From delivered orders' };
    };

    return [
      // Money Funnel (Reality) - 5 cards
      {
        section: 'Actual Money', cards: [
          { ...(findShopifyCard('Revenue Generated') || {}), title: 'Revenue Generated', subtitle: 'What Shopify shows' },
          { ...(findShippingCard('Revenue') || {}), title: 'Revenue Earned', subtitle: 'Only delivered orders' },
          getCogsFromPieData(), // Get COGS directly from Money Flow chart data
          { ...(findShopifyCard('Net Profit') || {}), title: 'Money Kept', subtitle: 'After ALL expenses' },
          { ...(findShopifyCard('Net Profit Margin') || {}), title: 'Profit Margin', subtitle: 'Healthy but fragile' }
        ]
      },

      // Can I Scale Ads? - 4 cards
      {
        section: 'Ads Performance', cards: [
          { ...findShopifyCard('Ad Spend'), title: 'Ad Spend' },
          { ...findShopifyCard('ROAS'), title: 'ROAS' },
          { ...findShopifyCard('POAS'), title: 'POAS' },
          { title: 'Decision', decision: decision.text, decisionColor: decision.color, subtitle: decision.subtitle }
        ]
      },

      // Unit Economics (Delivered Orders) - 8 cards (merged with Shipment Breakdown)
      {
        section: 'Order Economics', cards: [
          { ...findShopifyCard('Total Orders'), title: 'Total Orders' },
          { ...findShippingCard('Delivered Orders'), title: 'Delivered Orders' },
          { ...findShippingCard('RTO Count'), title: 'RTO Count' },
          { ...findShopifyCard('Cancelled Orders'), title: 'Cancelled Orders' },
          { ...findShippingMetric('Prepaid Orders'), title: 'Prepaid Orders' },
          { ...findShippingCard('AOV'), title: 'Average Order Value' },
          { ...findShopifyCard('Net Profit Per Order'), title: 'Profit per Order' },
          { ...findShippingCard('Shipping Per Order'), title: 'Shipping per Order' }
        ]
      },

      // Cost Leakage (What's Hurting) - 5 cards
      {
        section: "Cost Leakage", cards: [
          { ...findShippingCard('Shipping Spend'), title: 'Shipping Spend' },
          { ...findShopifyCard('RTO Handling'), title: 'RTO Handling' },
          { ...findShopifyCard('Gateway Fees'), title: 'Gateway Fees' },
          { ...findShopifyCard('Fixed Costs'), title: 'Fixed Costs' },
          { ...findShippingCard('RTO Revenue Lost'), title: 'RTO Revenue Lost' }
        ]
      },

      // Money at Risk (Pending) - 4 cards
      {
        section: "Pending Outcome/Money", cards: [
          { ...findShopifyCard('In-Transit Orders'), title: 'In-Transit Orders' },
          { ...findShopifyCard('Expected Delivery'), title: 'Expected Delivery' },
          { ...findShopifyCard('Expected Revenue'), title: 'Expected Revenue' },
          {
            ...findShopifyCard('Risk Level'),
            title: 'Risk Level',
            decision: findShopifyCard('Risk Level')?.value,
            decisionColor: getRiskColor(findShopifyCard('Risk Level'))
          }
        ]
      }
    ];
  }, [summaryCards, shiprocketData, shippingCards, pieData]);

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
      startDate: new Date(range.startDate),
      endDate: new Date(range.endDate)
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

  // Show "No Connection" screen if Shopify is not connected
  if (dashboardData?.noConnection) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0D1D1E] text-white">
        <div className="bg-[#161616] p-8 rounded-lg shadow-lg max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-6xl mb-4">🔗</div>
            <h2 className="text-xl font-semibold mb-2">Connect Your Shopify Store</h2>
            <p className="text-gray-400 mb-6">
              {dashboardData.message || 'Please connect your Shopify store to view dashboard data.'}
            </p>

            <a
              href="/settings"
              className="inline-block px-6 py-3 rounded-lg text-lg font-medium bg-green-600 hover:bg-green-700"
            >
              Go to Settings
            </a>

            <div className="text-xs text-gray-500 mt-6">
              <p>• Your Shopify data will be synced automatically after connection</p>
              <p>• You can also connect Meta and Shiprocket for complete analytics</p>
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
    <div className="px-4 lg:px-8 py-4 lg:py-6 text-white space-y-4 lg:space-y-6 overflow-x-hidden bg-[#0D1D1E] min-h-screen">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl lg:text-4xl font-bold">Dashboard</h2>
        <div className="flex items-center gap-4 relative">
          <button
            onClick={() => setShowDateSelector(!showDateSelector)}
            className="px-2 py-1 rounded-md text-xs lg:text-sm border bg-[#161616] border-gray-700"
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

      {/* Merged Dashboard Sections */}      {mergedDashboardData.map((section, idx) => (
        <div key={idx}>
          <h2 className="text-xl lg:text-2xl font-bold pt-4 lg:pt-6 mb-4 lg:mb-7">
            {section.section}
          </h2>
          <div className={`grid ${section.cards.length === 8 ? 'grid-cols-2 lg:grid-cols-4' : section.cards.length === 5 ? 'grid-cols-2 lg:grid-cols-5' : 'grid-cols-2 lg:grid-cols-4'} gap-3 lg:gap-4 w-full`}>
            {section.cards.map((card, cardIdx) => (
              <Card
                key={cardIdx}
                title={card?.title || 'N/A'}
                value={card?.value}
                formula={card?.formula}
                decision={card?.decision}
                decisionColor={card?.decisionColor}
                subtitle={card?.subtitle}
              />
            ))}
          </div>

          {/* Product Profitability Table - Show after Order Economics */}
          {section.section.includes('Order Economics') && (
            <>
              <div className="mt-6">
                <h2 className="text-2xl font-bold mb-4">Product Profitability</h2>
                <div className="bg-[#161616] rounded-xl p-6">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-white">
                      <thead className="border-b border-gray-800">
                        <tr className="text-gray-400 text-sm">
                          <th className="py-3 px-4 font-medium">Product</th>
                          <th className="py-3 px-4 font-medium text-center">Delivered Qty</th>
                          <th className="py-3 px-4 font-medium text-right">Revenue</th>
                          <th className="py-3 px-4 font-medium text-right">COGS</th>
                          <th className="py-3 px-4 font-medium text-right">Product Profit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bestSelling.map(
                          (product, idx) => (
                            <tr
                              key={product.id || idx}
                              className="border-b border-gray-800 hover:bg-[#1a1a1a] transition-colors"
                            >
                              <td className="py-4 px-4 text-white">{product.name}</td>
                              <td className="py-4 px-4 text-gray-300 text-center">{product.sales}</td>
                              <td className="py-4 px-4 text-white text-right">{product.total}</td>
                              <td className="py-4 px-4 text-gray-300 text-right">₹{(product.cogs || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                              <td className="py-4 px-4 text-[#12EB8E] font-semibold text-right">₹{(product.netProfit || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      ))}

      {/* Daily Profit Status */}
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] rounded-2xl p-8 shadow-2xl border border-gray-800">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
              Daily Profit Status
            </h3>
            <p className="text-sm text-gray-400">
              Net Profit per Day • <span className="text-[#12EB8E]">Above ₹0 = profitable</span> • <span className="text-red-400">Below ₹0 = losing money</span>
            </p>
          </div>
        </div>

        <div className="h-96 w-full bg-[#0D1D1E] rounded-xl p-4 shadow-inner">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={performanceChartData}
              margin={{ top: 30, right: 30, bottom: 30, left: 30 }}
            >
              <defs>
                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#12EB8E" stopOpacity={1} />
                  <stop offset="100%" stopColor="#0A9F6E" stopOpacity={0.85} />
                </linearGradient>
                <linearGradient id="lossGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#DC2626" stopOpacity={0.75} />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="shadow">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3" />
                </filter>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1F2937"
                vertical={false}
                strokeOpacity={0.3}
              />

              <XAxis
                dataKey="name"
                stroke="#6B7280"
                tick={{ fill: "#9CA3AF", fontSize: 13, fontWeight: 500 }}
                tickLine={false}
                axisLine={{ stroke: '#374151', strokeWidth: 1 }}
                dy={10}
              />

              <YAxis
                stroke="#6B7280"
                tick={{ fill: "#9CA3AF", fontSize: 13, fontWeight: 500 }}
                tickLine={false}
                axisLine={{ stroke: '#374151', strokeWidth: 1 }}
                dx={-10}
                tickFormatter={(value) => {
                  const absValue = Math.abs(value);
                  if (absValue >= 1000) {
                    return `₹${(value / 1000).toFixed(0)}k`;
                  }
                  return `₹${value}`;
                }}
              />

              <Tooltip
                cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
                  color: '#fff'
                }}
                labelStyle={{
                  color: '#D1D5DB',
                  fontWeight: 600,
                  marginBottom: '8px',
                  fontSize: '14px'
                }}
                itemStyle={{
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 500
                }}
                formatter={(value, name) => {
                  if (name === 'netProfit') {
                    const formattedValue = `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
                    return [formattedValue, 'Net Profit'];
                  }
                  return [value, name];
                }}
              />

              <ReferenceLine
                y={0}
                stroke="#6B7280"
                strokeWidth={2}
                strokeDasharray="5 5"
                label={{
                  value: 'Break Even',
                  position: 'right',
                  fill: '#9CA3AF',
                  fontSize: 12,
                  fontWeight: 600
                }}
              />

              <Bar
                dataKey="netProfit"
                radius={[8, 8, 0, 0]}
                maxBarSize={60}
                filter="url(#shadow)"
              >
                {performanceChartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.netProfit >= 0 ? 'url(#profitGradient)' : 'url(#lossGradient)'}
                    style={{
                      filter: entry.netProfit >= 0 ? 'drop-shadow(0 0 8px rgba(18, 235, 142, 0.4))' : 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.4))',
                      transition: 'all 0.3s ease'
                    }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        {/* <div className="flex items-center justify-center gap-8 mt-6">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gradient-to-b from-[#12EB8E] to-[#0A9F6E] shadow-lg"></div>
            <span className="text-sm text-gray-300 font-medium">Profitable Day</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gradient-to-b from-[#EF4444] to-[#DC2626] shadow-lg"></div>
            <span className="text-sm text-gray-300 font-medium">Loss Day</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-gray-500 border-dashed"></div>
            <span className="text-sm text-gray-300 font-medium">Break Even Line</span>
          </div>
        </div>
         */}
      </div>

      <div className="bg-[#00131C] rounded-2xl p-6" style={{ display: 'none' }}>
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

      {/* Cost Breakdown - Bar Chart like Daily Profit Status */}
      <div className="grid grid-cols-1 gap-6">
        {/* Main Cost Breakdown */}
        {(() => {
          // Calculate Net Profit value outside the chart
          const netProfitCard = summaryCards.find(c => c.title === 'Net Profit');
          const netProfitValue = netProfitCard?.value
            ? parseFloat(String(netProfitCard.value).replace(/[^0-9.-]/g, ''))
            : 0;

          return (
            <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] rounded-2xl p-8 shadow-2xl border border-gray-800">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
                    Money Flow
                  </h3>
                  <p className="text-sm text-gray-400">
                    Revenue distribution across expenses and profit
                  </p>
                </div>
              </div>

              <div className="bg-[#0D1D1E] rounded-xl p-4 shadow-inner">
                <div className="h-96 w-full">
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          // Revenue as first bar (positive, green)
                          { name: 'Revenue', value: revenueValue, color: '#12EB8E', isRevenue: true, isProfit: false },
                          // All expenses as negative values (red)
                          ...pieData.map(item => ({
                            name: item.name,
                            value: -item.value, // Make negative to show going down
                            color: '#EF4444', // Red for all expenses
                            isRevenue: false,
                            isProfit: false
                          })),
                          // Money Kept (Net Profit) as LAST bar
                          {
                            name: 'Money Kept/Net Profit',
                            value: netProfitValue,
                            color: netProfitValue >= 0 ? '#12EB8E' : '#EF4444',
                            isRevenue: false,
                            isProfit: true
                          }
                        ]}
                        margin={{ top: 30, right: 30, bottom: 30, left: 30 }}
                      >
                        <defs>
                          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#12EB8E" stopOpacity={1} />
                            <stop offset="100%" stopColor="#0A9F6E" stopOpacity={0.85} />
                          </linearGradient>
                          <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#EF4444" stopOpacity={0.9} />
                            <stop offset="100%" stopColor="#DC2626" stopOpacity={0.75} />
                          </linearGradient>
                          <filter id="shadow">
                            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3" />
                          </filter>
                        </defs>

                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#1F2937"
                          vertical={false}
                          strokeOpacity={0.3}
                        />

                        <XAxis
                          dataKey="name"
                          stroke="#6B7280"
                          tick={{ fill: "#9CA3AF", fontSize: 12, fontWeight: 500 }}
                          tickLine={false}
                          axisLine={{ stroke: '#374151', strokeWidth: 1 }}
                          dy={10}
                          angle={-15}
                          textAnchor="end"
                          height={80}
                        />

                        <YAxis
                          stroke="#6B7280"
                          tick={{ fill: "#9CA3AF", fontSize: 13, fontWeight: 500 }}
                          tickLine={false}
                          axisLine={{ stroke: '#374151', strokeWidth: 1 }}
                          dx={-10}
                          tickFormatter={(value) => {
                            const absValue = Math.abs(value);
                            if (absValue >= 1000) {
                              return `₹${(value / 1000).toFixed(0)}k`;
                            }
                            return `₹${value}`;
                          }}
                        />

                        <Tooltip
                          cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                          contentStyle={{
                            backgroundColor: '#1F2937',
                            border: '1px solid #374151',
                            borderRadius: '12px',
                            padding: '12px 16px',
                            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
                            color: '#fff'
                          }}
                          labelStyle={{
                            color: '#D1D5DB',
                            fontWeight: 600,
                            marginBottom: '8px',
                            fontSize: '14px'
                          }}
                          itemStyle={{
                            color: '#fff',
                            fontSize: '14px',
                            fontWeight: 500
                          }}
                          formatter={(value, name) => {
                            const absValue = Math.abs(value);
                            return [`₹${absValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 'Amount'];
                          }}
                        />

                        <ReferenceLine
                          y={0}
                          stroke="#6B7280"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                        />

                        <Bar
                          dataKey="value"
                          radius={[8, 8, 0, 0]}
                          maxBarSize={80}
                          filter="url(#shadow)"
                        >
                          {[
                            { name: 'Revenue', value: revenueValue, color: '#12EB8E', isRevenue: true, isProfit: false },
                            ...pieData.map(item => ({
                              name: item.name,
                              value: -item.value,
                              color: '#EF4444',
                              isRevenue: false,
                              isProfit: false
                            })),
                            {
                              name: 'Money Kept/Net Profit',
                              value: netProfitValue,
                              color: netProfitValue >= 0 ? '#12EB8E' : '#EF4444',
                              isRevenue: false,
                              isProfit: true
                            }
                          ].map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                entry.isRevenue || (entry.isProfit && entry.value >= 0)
                                  ? 'url(#revenueGradient)'
                                  : 'url(#expenseGradient)'
                              }
                              style={{
                                filter: entry.isRevenue || (entry.isProfit && entry.value >= 0)
                                  ? 'drop-shadow(0 0 8px rgba(18, 235, 142, 0.4))'
                                  : 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.4))',
                                transition: 'all 0.3s ease'
                              }}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      No breakdown data
                    </div>
                  )}
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-6 mt-6 flex-wrap">
                {/* Revenue - Green */}
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded shadow-lg"
                    style={{ backgroundColor: '#12EB8E' }}
                  ></div>
                  <span className="text-sm text-gray-300 font-medium">Revenue</span>
                </div>
                {/* Money Kept - Green or Red based on value */}
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded shadow-lg"
                    style={{ backgroundColor: netProfitValue >= 0 ? '#12EB8E' : '#EF4444' }}
                  ></div>
                  <span className="text-sm text-gray-300 font-medium">Money Kept/Net Profit</span>
                </div>
                {/* Expenses - Red */}
                {pieData.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded shadow-lg"
                      style={{ backgroundColor: '#EF4444' }}
                    ></div>
                    <span className="text-sm text-gray-300 font-medium">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>


    </div>
  );
};

export default Dashboard;
