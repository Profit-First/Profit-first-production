import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { PulseLoader } from "react-spinners";
import actualIcon from "../assets/actual.png";
import predictionIcon from "../assets/prediction.png";

// Format number for Revenue (shows plain numbers until 10L, then uses L/Cr)
const formatRevenue = (num) => {
  if (num >= 10000000) { // 1 crore or more
    return `₹${(num / 10000000).toFixed(2)}Cr`;
  } else if (num >= 1000000) { // 10 lakh or more (double digit lakhs)
    return `₹${(num / 100000).toFixed(2)}L`;
  } else {
    // Show plain numbers with commas for values under 10 lakhs
    return `₹${num.toLocaleString('en-IN')}`;
  }
};

// Format number for Gross Profit (uses K/L/Cr formatting)
const formatGrossProfit = (num) => {
  if (num >= 10000000) { // 1 crore or more
    return `₹${(num / 10000000).toFixed(2)}Cr`;
  } else if (num >= 100000) { // 1 lakh or more
    return `₹${(num / 100000).toFixed(2)}L`;
  } else if (num >= 1000) { // 1 thousand or more
    return `₹${(num / 1000).toFixed(2)}K`;
  } else {
    return `₹${num}`;
  }
};

// Format as plain number with commas (for AOV, COGS, Other Expenses, Net Profit)
const formatPlainNumber = (num) => {
  return `₹${num.toLocaleString('en-IN')}`;
};

// Format ROAS with 2 decimal places
const formatROAS = (value) => {
  return `${parseFloat(value).toFixed(2)}x`;
};

const TinyChart = ({ data, strokeColor }) => (
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={data}>
      <Line
        type="monotone"
        dataKey="v"
        stroke={strokeColor}
        strokeWidth={2}
        dot={false}
      />
    </LineChart>
  </ResponsiveContainer>
);

const MetricCard = ({ title, value, change, changeType, label, chartData, glassEffect = false }) => {
  const isIncrease = changeType === "increase";
  const strokeColor = isIncrease ? "#10b981" : "#ef4444";

  return (
    <div className="bg-[#2a2a2a] p-3 rounded-lg border border-gray-800 overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-white mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{value}</p>
          <p className="text-[10px] text-gray-400 mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{title}</p>
          <p className={`text-[10px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis ${isIncrease ? "text-green-400" : "text-red-400"}`}>
            {change}
          </p>
          <p className="text-[9px] text-gray-500 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{label}</p>
        </div>
        <div className="w-16 h-12 flex-shrink-0">
          <TinyChart data={chartData || []} strokeColor={strokeColor} />
        </div>
      </div>
    </div>
  );
};

const EventIcon = ({ type, className = "w-6 h-6" }) => {
  if (type === "diwali") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L10 8L12 10L14 8L12 2Z" fill="#FFA500" />
        <path d="M12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10Z" fill="#FFD700" />
        <path d="M8 14C7.45 14 7 14.45 7 15V18C7 18.55 7.45 19 8 19H16C16.55 19 17 18.55 17 18V15C17 14.45 16.55 14 16 14H8Z" fill="#8B4513" />
        <path d="M6 19H18V21C18 21.55 17.55 22 17 22H7C6.45 22 6 21.55 6 21V19Z" fill="#654321" />
      </svg>
    );
  }
  if (type === "thanksgiving") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 3C8 3 5 6 5 10C5 12 6 14 7 15L8 19H16L17 15C18 14 19 12 19 10C19 6 16 3 12 3Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 19H16V21H8V19Z" fill="currentColor" />
        <path d="M10 8C10 7.5 10.5 7 11 7C11.5 7 12 7.5 12 8" strokeLinecap="round" />
        <path d="M14 8C14 7.5 13.5 7 13 7C12.5 7 12 7.5 12 8" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "christmas") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2L15 8H9L12 2Z" fill="currentColor" opacity="0.3" />
        <path d="M12 7L16 14H8L12 7Z" fill="currentColor" opacity="0.5" />
        <path d="M12 13L18 21H6L12 13Z" fill="currentColor" opacity="0.7" />
        <rect x="10" y="21" width="4" height="2" fill="currentColor" />
        <circle cx="12" cy="4" r="1" fill="#FFD700" />
      </svg>
    );
  }
  return null;
};

const Aiprediction = () => {
  const [data, setData] = useState({
    metricsByMonth: {},
    dashboardData: null,
    mainChartsData: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedMetric, setSelectedMetric] = useState("Revenue");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isFlipped, setIsFlipped] = useState(false);
  // For demo: Set onboarding date (in production, this comes from backend API)
  const [onboardingDate] = useState(() => {
    const date = new Date();
    // Set to current month for demo
    return date;
  });

  // Helper function to generate dynamic months based on current date
  // Always shows: 2 months before current + current month + 3 predicted months = 6 months total
  const generateDynamicMonths = () => {
    const currentDate = new Date();

    // Always show exactly 3 actual months (2 previous + current) and 3 predicted months
    const actualMonthsCount = 3;
    const predictedMonthsCount = 3;

    const months = [];
    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];

    // Generate actual months: 2 months before current + current month = 3 months
    for (let i = -2; i <= 0; i++) {
      const date = new Date(currentDate);
      date.setMonth(date.getMonth() + i);
      months.push({
        name: monthNames[date.getMonth()],
        shortName: monthNames[date.getMonth()].substring(0, 3),
        type: 'actual',
        index: i + 2 // 0, 1, 2
      });
    }

    // Generate predicted months: next 3 months after current
    for (let i = 1; i <= predictedMonthsCount; i++) {
      const date = new Date(currentDate);
      date.setMonth(date.getMonth() + i);
      months.push({
        name: monthNames[date.getMonth()],
        shortName: monthNames[date.getMonth()].substring(0, 3),
        type: 'predicted',
        index: i + 2 // 3, 4, 5
      });
    }

    return months;
  };

  useEffect(() => {
    const fetchPredictions = async () => {
      try {
        setLoading(true);
        setError("");

        // Get token from localStorage
        const token = localStorage.getItem('token');
        if (!token) {
          setError("Please login to view predictions");
          setLoading(false);
          return;
        }

        // Call backend API
        const response = await fetch('http://localhost:5000/api/predictions', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const result = await response.json();

        if (result.success && result.data) {
          // Transform API data to component format
          const transformedData = transformPredictionData(result.data);
          setData(transformedData);

          // Set selected month to current month
          const currentMonth = new Date().toLocaleString('default', { month: 'long' });
          setSelectedMonth(currentMonth);
        } else {
          throw new Error(result.message || "Failed to fetch predictions");
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching predictions:', err);
        setError(err.message || "Failed to load predictions. Please try again.");
        setLoading(false);
      }
    };

    fetchPredictions();
  }, []);

  // Transform API data to component format
  const transformPredictionData = (apiData) => {
    const { predictions, historicalData, monthlyTrends } = apiData;
    const dynamicMonths = generateDynamicMonths();

    // Build metrics by month from historical data
    const metricsByMonth = {};

    // Add historical months
    if (monthlyTrends && Array.isArray(monthlyTrends)) {
      monthlyTrends.forEach(monthData => {
        const monthName = new Date(monthData.month + '-01').toLocaleString('default', { month: 'long' });
        metricsByMonth[monthName] = buildMetricsArray(monthData, 'actual');
      });
    }

    // Add predicted month
    if (predictions) {
      const nextMonth = getNextMonthName();
      metricsByMonth[nextMonth] = buildMetricsArray(predictions, 'predicted');
    }

    // Build chart data
    const mainChartsData = buildChartData(monthlyTrends, predictions);

    // Build financial breakdown
    const financialBreakdown = buildFinancialBreakdown(monthlyTrends, predictions);

    return {
      metricsByMonth,
      dashboardData: {
        brand: { name: "Your Store" },
        financialBreakdown
      },
      mainChartsData
    };
  };

  // Helper: Get next month name
  const getNextMonthName = () => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date.toLocaleString('default', { month: 'long' });
  };

  // Helper: Build metrics array from data
  const buildMetricsArray = (monthData, type) => {
    const revenue = parseFloat(monthData.revenue) || 0;
    const orders = parseInt(monthData.orders) || 0;
    const profit = parseFloat(monthData.profit) || 0;
    const adSpend = parseFloat(monthData.adSpend) || 0;
    const roas = parseFloat(monthData.roas) || 0;
    const cogs = revenue * 0.35; // Estimate if not provided
    const grossProfit = revenue - cogs;
    const aov = orders > 0 ? revenue / orders : 0;
    const otherExpenses = adSpend + (revenue * 0.1); // Ad spend + 10% for shipping/other

    return [
      { title: "Revenue", value: formatRevenue(revenue), change: "+15%", changeType: "increase", label: "Shopify", chartData: [] },
      { title: "Orders", value: `${orders}`, change: "+12%", changeType: "increase", label: "Shopify", chartData: [] },
      { title: "AOV", value: formatPlainNumber(aov), change: "+3%", changeType: "increase", label: "Shopify", chartData: [] },
      { title: "COGS", value: formatPlainNumber(cogs), change: "+10%", changeType: "increase", label: "Calculated", chartData: [] },
      { title: "Gross Profit", value: formatGrossProfit(grossProfit), change: "+20%", changeType: "increase", label: "Profit First", chartData: [] },
      { title: "Other Expenses", value: formatPlainNumber(otherExpenses), change: "+5%", changeType: "increase", label: "Meta+Shipping", chartData: [] },
      { title: "ROAS", value: formatROAS(roas), change: "+10%", changeType: "increase", label: "Meta", chartData: [] },
      { title: "Net Profit", value: formatPlainNumber(profit), change: "+22%", changeType: "increase", label: "Profit First", chartData: [] },
    ];
  };

  // Helper: Build chart data
  const buildChartData = (monthlyTrends, predictions) => {
    const chartData = {};
    const metrics = ['Revenue', 'NetProfit', 'COGS'];

    metrics.forEach(metric => {
      const data = [];

      // Add historical data
      if (monthlyTrends && Array.isArray(monthlyTrends)) {
        monthlyTrends.forEach(month => {
          const value = metric === 'Revenue' ? parseFloat(month.revenue) / 1000 :
            metric === 'NetProfit' ? parseFloat(month.profit) / 1000 :
              (parseFloat(month.revenue) * 0.35) / 1000; // COGS estimate

          data.push({
            name: new Date(month.month + '-01').toLocaleString('default', { month: 'short' }),
            Actual: value,
            Predicted: null
          });
        });
      }

      // Add predicted data
      if (predictions) {
        const value = metric === 'Revenue' ? parseFloat(predictions.revenue) / 1000 :
          metric === 'NetProfit' ? parseFloat(predictions.profit) / 1000 :
            (parseFloat(predictions.revenue) * 0.35) / 1000;

        data.push({
          name: getNextMonthName().substring(0, 3),
          Actual: null,
          Predicted: value
        });
      }

      chartData[metric] = data;
    });

    return chartData;
  };

  // Helper: Build financial breakdown
  const buildFinancialBreakdown = (monthlyTrends, predictions) => {
    const breakdown = [];

    // Add historical months
    if (monthlyTrends && Array.isArray(monthlyTrends)) {
      monthlyTrends.forEach(month => {
        const revenue = parseFloat(month.revenue) || 0;
        const cogs = revenue * 0.35;
        const grossProfit = revenue - cogs;
        const operatingCosts = parseFloat(month.adSpend) || 0;
        const netProfit = parseFloat(month.profit) || 0;
        const netProfitMargin = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(2) : '0.00';

        breakdown.push({
          month: new Date(month.month + '-01').toLocaleString('default', { month: 'long' }),
          cogs: (cogs / 1000).toFixed(0) + 'K',
          grossProfit: (grossProfit / 1000).toFixed(0) + 'K',
          operatingCosts: (operatingCosts / 1000).toFixed(0) + 'K',
          netProfit: (netProfit / 1000).toFixed(0) + 'K',
          netProfitMargin: netProfitMargin + '%'
        });
      });
    }

    // Add predicted month
    if (predictions) {
      const revenue = parseFloat(predictions.revenue) || 0;
      const cogs = revenue * 0.35;
      const grossProfit = revenue - cogs;
      const operatingCosts = parseFloat(predictions.adSpend) || 0;
      const netProfit = parseFloat(predictions.profit) || 0;
      const netProfitMargin = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(2) : '0.00';

      breakdown.push({
        month: getNextMonthName(),
        cogs: (cogs / 1000).toFixed(0) + 'K',
        grossProfit: (grossProfit / 1000).toFixed(0) + 'K',
        operatingCosts: (operatingCosts / 1000).toFixed(0) + 'K',
        netProfit: (netProfit / 1000).toFixed(0) + 'K',
        netProfitMargin: netProfitMargin + '%'
      });
    }

    return breakdown;
  };

  const { metricsByMonth, dashboardData, mainChartsData } = data;

  const currentMetrics = useMemo(
    () => metricsByMonth?.[selectedMonth] || [],
    [metricsByMonth, selectedMonth]
  );

  const mainChartSeries = useMemo(
    () => (mainChartsData?.[selectedMetric] ? mainChartsData[selectedMetric] : []),
    [mainChartsData, selectedMetric]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0D1D1E]">
        <PulseLoader size={15} color="#10b981" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#0D1D1E] text-white p-6 h-screen flex justify-center items-center">
        <p className="text-red-400">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0D1D1E] text-white p-3 sm:p-6 min-h-screen overflow-y-auto">
      <div className="max-w-4xl 2xl:max-w-6xl mx-auto bg-gradient-to-br from-black via-[#0a1a1a] to-[#0d2d2d] rounded-2xl px-4 sm:px-8 md:px-12 2xl:px-16 py-4 sm:py-6 2xl:py-8 shadow-2xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
          <h1 className="text-lg sm:text-xl 2xl:text-2xl font-bold text-white">
            AI Powered Growth Dashboard
          </h1>
          <select
            className="bg-[#2a2a2a] text-white rounded-lg px-3 sm:px-4 py-2 text-sm 2xl:text-base focus:outline-none border border-gray-700 w-full sm:w-auto"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            {Object.keys(metricsByMonth || {}).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Metrics Grid - First Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 2xl:gap-6 mb-4 max-w-3xl 2xl:max-w-5xl mx-auto">
          {currentMetrics.slice(0, 4).map((metric) => (
            <MetricCard key={metric.title} {...metric} glassEffect={true} />
          ))}
        </div>

        {/* Metrics Grid - Second Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 2xl:gap-6 mb-6 max-w-3xl 2xl:max-w-5xl mx-auto">
          {currentMetrics.slice(4, 8).map((metric) => (
            <MetricCard key={metric.title} {...metric} />
          ))}
        </div>

        {/* Main Chart */}
        <div className="bg-[#2a2a2a] p-3 sm:p-4 2xl:p-6 rounded-lg mb-6 max-w-3xl 2xl:max-w-5xl mx-auto overflow-x-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
            <h2 className="text-sm sm:text-base font-semibold">Actual Vs Predicted Revenue</h2>
            <select
              className="bg-[#2a2a2a] text-white rounded-lg px-3 sm:px-4 py-2 text-sm focus:outline-none border border-gray-700 w-full sm:w-auto"
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
            >
              {Object.keys(mainChartsData || {}).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Interactive Chart with Image Patterns */}
          <div className="min-w-[600px] sm:min-w-0">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={mainChartSeries} margin={{ top: 15, right: 35, left: 5, bottom: 10 }}>
                <defs>
                  {/* Gradient fills with custom colors */}
                  <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(49, 77, 45, 1)" stopOpacity={1} />
                    <stop offset="100%" stopColor="rgba(113, 179, 104, 0.1)" stopOpacity={1} />
                  </linearGradient>
                  <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(19, 65, 42, 1)" stopOpacity={1} />
                    <stop offset="100%" stopColor="rgba(49, 167, 108, 0.2)" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="0" stroke="#555" vertical={true} horizontal={true} strokeOpacity={0.4} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#9ca3af", fontSize: 11 }}
                  axisLine={{ stroke: "#374151" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#9ca3af", fontSize: 11 }}
                  axisLine={{ stroke: "#374151" }}
                  tickLine={false}
                  tickFormatter={(value) => `${value}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(19, 65, 42, 0.95)",
                    borderColor: "rgba(113, 179, 104, 1)",
                    borderRadius: "12px",
                    border: "1px solid",
                    boxShadow: "0 10px 40px rgba(49, 167, 108, 0.3)"
                  }}
                  labelStyle={{ color: "#fff", fontWeight: "bold" }}
                  itemStyle={{ color: "rgba(113, 179, 104, 1)" }}
                  formatter={(value, name) => {
                    const numValue = value * 1000; // Convert back from K
                    if (numValue >= 100000) {
                      return [`₹${(numValue / 100000).toFixed(2)}L`, name];
                    }
                    return [`₹${(numValue / 1000).toFixed(0)}K`, name];
                  }}
                  animationDuration={300}
                />
                <Area
                  type="monotone"
                  dataKey="Actual"
                  stroke="transparent"
                  strokeWidth={0}
                  fillOpacity={1}
                  fill="url(#colorActual)"
                  connectNulls
                  dot={false}
                  activeDot={{ r: 8, fill: "rgba(113, 179, 104, 1)", stroke: "#fff", strokeWidth: 2 }}
                  animationDuration={1000}
                  animationEasing="ease-in-out"
                />
                <Area
                  type="monotone"
                  dataKey="Predicted"
                  stroke="transparent"
                  strokeWidth={0}
                  fillOpacity={1}
                  fill="url(#colorPredicted)"
                  connectNulls
                  dot={false}
                  activeDot={{ r: 8, fill: "rgba(49, 167, 108, 1)", stroke: "#fff", strokeWidth: 2 }}
                  animationDuration={1000}
                  animationEasing="ease-in-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex justify-center gap-4 sm:gap-6 mt-4 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: "rgba(113, 179, 104, 1)" }}></div>
              <span className="text-gray-400">Actual</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: "rgba(49, 167, 108, 1)" }}></div>
              <span className="text-gray-400">Predicted</span>
            </div>
          </div>
        </div>

        {/* Event Impact Card */}
        {selectedEvent && (
          <div className="bg-[#2a2a2a] p-4 rounded-lg border border-gray-800">
            <div className="flip-card-small">
              <div className={`flip-card-small-inner ${isFlipped ? 'flipped' : ''}`}>
                {/* Front - Event Impact */}
                <div className="flip-card-small-front">
                  <div className="bg-gradient-to-br from-[#1a1a1a] via-[#2a2a2a] to-[#1a1a1a] rounded-lg p-4 border border-gray-700 shadow-2xl h-[280px] flex flex-col">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-2">
                        <EventIcon type={selectedEvent.iconType} className="w-7 h-7 text-orange-400" />
                        <h3 className="text-sm font-bold text-white">{selectedEvent.event}</h3>
                      </div>
                      <div>
                        <button
                          onClick={() => setIsFlipped(true)}
                          className="text-white hover:text-green-400 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-3 flex-1">
                        {/* Net Profit */}
                        <div className="flex flex-col bg-[#1a1a1a] p-2 rounded-lg border border-gray-700">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="text-2xl font-bold text-red-400">-12%</p>
                              <p className="text-[10px] text-gray-400">Net Profit</p>
                            </div>
                            <svg className="w-12 h-8" viewBox="0 0 60 40">
                              <path d="M 5 20 Q 15 15, 25 18 T 45 25 T 55 30" stroke="#ef4444" strokeWidth="2" fill="none" />
                            </svg>
                          </div>
                          <p className="text-[9px] text-gray-300">• Fewer active users, higher ad spend.</p>
                        </div>

                        {/* Gross Profit */}
                        <div className="flex flex-col bg-[#1a1a1a] p-2 rounded-lg border border-gray-700">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="text-2xl font-bold text-green-400">+8%</p>
                              <p className="text-[10px] text-gray-400">Gross Profit</p>
                            </div>
                            <svg className="w-12 h-8" viewBox="0 0 60 40">
                              <path d="M 5 30 Q 15 25, 25 22 T 45 15 T 55 10" stroke="#10b981" strokeWidth="2" fill="none" />
                            </svg>
                          </div>
                          <p className="text-[9px] text-gray-300">• Festive Offer increases volume.</p>
                        </div>

                        {/* COGS */}
                        <div className="flex flex-col bg-[#1a1a1a] p-2 rounded-lg border border-gray-700">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="text-2xl font-bold text-yellow-400">6%</p>
                              <p className="text-[10px] text-gray-400">COGS</p>
                            </div>
                            <div className="w-12 h-8 flex items-center">
                              <div className="w-full h-1 bg-yellow-400 rounded"></div>
                            </div>
                          </div>
                          <p className="text-[9px] text-gray-300">• Raw material cause spike due to demand.</p>
                        </div>

                        {/* ROAS */}
                        <div className="flex flex-col bg-[#1a1a1a] p-2 rounded-lg border border-gray-700">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="text-2xl font-bold text-red-400">-10%</p>
                              <p className="text-[10px] text-gray-400">ROAS</p>
                            </div>
                            <svg className="w-12 h-8" viewBox="0 0 60 40">
                              <path d="M 5 15 Q 15 18, 25 22 T 45 28 T 55 32" stroke="#ef4444" strokeWidth="2" fill="none" />
                            </svg>
                          </div>
                          <p className="text-[9px] text-gray-300">• Users less active, CTR drops.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Back - Recommended Actions */}
                  <div className="flip-card-small-back">
                    <div className="bg-gradient-to-br from-[#1a1a1a] via-[#2a2a2a] to-[#1a1a1a] rounded-lg p-4 border border-gray-700 shadow-2xl h-[280px] flex flex-col">
                      {/* Header with bulb icon, title, and diya icon */}
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                          </svg>
                          <h3 className="text-sm font-bold text-white">Recommended Actions</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <EventIcon type={selectedEvent.iconType} className="w-7 h-7 text-orange-400" />
                          <button
                            onClick={() => setIsFlipped(false)}
                            className="text-white hover:text-green-400 transition-colors"
                          >
                            <svg className="w-5 h-5 transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2 flex-1 overflow-y-auto hide-scrollbar">
                        <div className="bg-[#1a1a1a] p-2.5 rounded-lg border border-gray-700">
                          <h4 className="text-[11px] font-bold text-white mb-1">Inventory</h4>
                          <p className="text-[9px] text-gray-300 leading-relaxed">Prep inventory early, order raw materials by Sept 25th to offset COGS rise and avoid stockouts.</p>
                        </div>
                        <div className="bg-[#1a1a1a] p-2.5 rounded-lg border border-gray-700">
                          <h4 className="text-[11px] font-bold text-white mb-1">Marketing</h4>
                          <p className="text-[9px] text-gray-300 leading-relaxed">Launch festive offer campaign. Start promotion 7 days before ROAS.</p>
                        </div>
                        <div className="bg-[#1a1a1a] p-2.5 rounded-lg border border-gray-700">
                          <h4 className="text-[11px] font-bold text-white mb-1">Finance</h4>
                          <p className="text-[9px] text-gray-300 leading-relaxed">Increase Ad spend Post-{selectedEvent.event.split(' ')[0]}, capture re-engagement spike after October 26th.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
        )}

        {/* Financial Breakdown Table */}
        <div className="bg-[#2a2a2a] p-3 sm:p-4 rounded-lg border border-gray-800">
          <h2 className="text-sm sm:text-base font-semibold mb-3">Financial Breakdown</h2>
          <div className="overflow-x-auto max-h-64 overflow-y-auto -mx-3 sm:mx-0 px-3 sm:px-0">
            <table className="w-full text-xs sm:text-sm border-collapse min-w-[600px]">
              <thead className="text-gray-400 border-b border-gray-600">
                <tr>
                  <th className="text-left px-4 py-3">Month</th>
                  <th className="text-left px-4 py-3">COGS</th>
                  <th className="text-left px-4 py-3">Gross Profit</th>
                  <th className="text-left px-4 py-3">Operating Cost</th>
                  <th className="text-left px-4 py-3">Net Profit</th>
                  <th className="text-left px-4 py-3">Net Margin</th>
                </tr>
              </thead>
              <tbody>
                {(dashboardData?.financialBreakdown || []).map((row) => (
                  <tr key={row.month} className="border-b border-gray-600 hover:bg-[#222]">
                    <td className="px-4 py-3 font-medium text-white border-r border-gray-600">{row.month}</td>
                    <td className="px-4 py-3 border-r border-gray-600">₹{row.cogs}</td>
                    <td className="px-4 py-3 border-r border-gray-600">₹{row.grossProfit}</td>
                    <td className="px-4 py-3 border-r border-gray-600">₹{row.operatingCosts}</td>
                    <td className="px-4 py-3 text-green-400 font-semibold border-r border-gray-600">₹{row.netProfit}</td>
                    <td className="px-4 py-3">{row.netProfitMargin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Aiprediction;