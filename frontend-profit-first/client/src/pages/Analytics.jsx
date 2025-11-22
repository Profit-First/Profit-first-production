import React, { useEffect, useState, useRef } from "react";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import DateRangeSelector from "../components/DateRangeSelector";
import axiosInstance from "../../axios";
import { PulseLoader } from "react-spinners";
import { subDays } from "date-fns";
import CohortHeatmap from "../components/CohortHeatmap";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

const getChange = (curr, prev) => {
  if (prev === 0) {
    if (curr > 0) return { value: 100, direction: 'up' };
    return { value: 0, direction: 'none' };
  }
  const diff = curr - prev;
  const percent = ((diff / prev) * 100).toFixed(1);
  return {
    value: Math.abs(percent),
    direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'none',
  };
};

const toISTDateString = (date) => {
  const istOffset = 330 * 60 * 1000; // 5.5 hours in milliseconds
  const istDate = new Date(date.getTime() + istOffset);
  return istDate.toISOString().split("T")[0];
};

const Analytics = () => {
  // --- State ---
  const [view, setView] = useState("Visitor");
  const [dateRange, setDateRange] = useState({
    startDate: subDays(new Date(), 29),
    endDate: new Date(),
  });
  const [showDateSelector, setShowDateSelector] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  // Year selector state
  const [years, setYears] = useState([]);
  const [yearA, setYearA] = useState(null);
  const [yearB, setYearB] = useState(null);

  // Chart data for two years
  const [chartA, setChartA] = useState([]);
  const [chartB, setChartB] = useState([]);
  const [loadingChart, setLoadingChart] = useState(false);
  const [chartError, setChartError] = useState(null);

  // Freeze chart type by view at mount
  const chartTypeRef = useRef(view.toLowerCase());

  // Initialize available years and defaults
  useEffect(() => {
    const current = new Date().getFullYear();
    const list = Array.from({ length: 5 }, (_, i) => current - i);
    setYears(list);
    setYearA(list[0]);
    setYearB(list[1]);
  }, []);

  // Fetch analytics summary
  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoadingAnalytics(true);
      try {
        const resp = await axiosInstance.get("/data/analytics", {
          params: {
            startDate: toISTDateString(dateRange.startDate),
            endDate: toISTDateString(dateRange.endDate),
          },
        });
        setAnalytics(resp.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingAnalytics(false);
      }
    };
    fetchAnalytics();
  }, [dateRange]);

  // Fetch yearly charts when either year changes
  useEffect(() => {
    if (!yearA || !yearB) return;
    const fetchCharts = async () => {
      setLoadingChart(true);
      setChartError(null);
      try {
        const type = chartTypeRef.current;
        const [respA, respB] = await Promise.all([
          axiosInstance.get("/data/analyticschart", {
            params: { year: yearA, type },
          }),
          axiosInstance.get("/data/analyticschart", {
            params: { year: yearB, type },
          }),
        ]);
        const blockA = respA.data[type];
        const blockB = respB.data[type];
        setChartA(blockA.thisYear || blockA || []);
        setChartB(blockB.thisYear || blockB || []);
      } catch (err) {
        console.error(err);
        setChartError("Could not load yearly charts");
      } finally {
        setLoadingChart(false);
      }
    };
    fetchCharts();
  }, [yearA, yearB]);

  // Date range apply handler
  const handleApply = (range) => {
    setDateRange(range);
    setShowDateSelector(false);
  };

  // Loading / error
  if (loadingAnalytics)
    return (
      <div className="flex h-screen items-center justify-center bg-[#0D1D1E]">
        <PulseLoader size={15} color="#12EB8E" />
      </div>
    );
  if (!analytics)
    return (
      <div className="flex h-screen items-center justify-center bg-[#0D1D1E] text-white">
        Error loading analytics.
      </div>
    );

  // Summary cards
  const sum = analytics.summary[view.toLowerCase()];
  const summaryData =
    view === "Visitor"
      ? [
          ["Total Visitors", sum.total],
          ["New Visitors", sum.new],
          ["Returning Visitors", sum.returning],
          ["Visitor Churn", sum.churn+"%"],
        ]
      : [
          ["Total Customers", sum.total],
          ["New Customers", sum.new],
          ["Returning Customers", sum.returning],
          ["Customer Churn", sum.churn+"%"],
        ];

  // Merge chart data by month
  const mergedChart = (chartA || []).map((pt, i) => ({
    month: pt.month,
    [yearA]: pt.orders,
    [yearB]: chartB[i]?.orders ?? null,
  }));

  // Location & returning customer max values
  const maxSessions = Math.max(
    ...analytics.locations.map((d) => Math.max(d.current, d.previous)),
    0
  );
  const maxAmount = Math.max(
    ...analytics.returningCustomers.map((c) => c.amount),
    0
  );

  return (
    <div className="p-6 bg-[#0D1D1E] min-h-screen text-white space-y-6">

<h2 className="text-2xl font-bold text-red-500">This section is under maintenance</h2>


      {/* Header & date */}
     <div className="flex justify-between items-center">
  <h2 className="text-2xl font-bold">{view} Analysis</h2>

  <div className="relative">
    <button
      onClick={() => setShowDateSelector((f) => !f)}
      className="px-3 py-1 border rounded bg-[#161616]"
    >
      {dateRange.startDate.toLocaleDateString()} –{" "}
      {dateRange.endDate.toLocaleDateString()}
    </button>

    {showDateSelector && (
      <div className="absolute top-full right-0 mt-2 z-50 bg-[#161616] rounded-lg shadow-lg border border-gray-700">
        <DateRangeSelector onApply={handleApply} />
      </div>
    )}
  </div>
</div>

      {/* View tabs */}
      <div className="flex space-x-4">
        {["Visitor", "Customer"].map((t) => (
          <button
            key={t}
            onClick={() => setView(t)}
            className={`px-3 py-1 rounded ${
              view === t ? "bg-[#00B0FF] font-bold border" : "bg-[#434343]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {summaryData.map(([title, val]) => (
          <div key={title} className="bg-[#161616] p-4 rounded-xl">
            <div className="text-sm text-gray-300">{title}</div>
            <div className="text-xl font-bold">{val.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Yearly chart selectors */}
      <div className="flex space-x-4 justify-end items-center">
        <select
          value={yearA}
          onChange={(e) => setYearA(+e.target.value)}
          className="px-2 py-1 bg-[#161616] border rounded cursor-pointer"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y} 
            </option>
          ))}
        </select>
        <select
          value={yearB}
          onChange={(e) => setYearB(+e.target.value)}
          className="px-2 py-1 bg-[#161616] border rounded cursor-pointer"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <div className="bg-[#161616] p-4 rounded-lg h-64">
        {loadingChart ? (
          <div className="flex h-full items-center justify-center">
            <PulseLoader size={15} color="#12EB8E" />
          </div>
        ) : chartError ? (
          <div className="text-red-400">{chartError}</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mergedChart}>
              <XAxis dataKey="month" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip
                contentStyle={{ backgroundColor: "#161616" }}
                cursor={{ stroke: "#fff", strokeWidth: 1 }}
              />
              <Line
                type="monotone"
                dataKey={`${yearA}`}
                stroke="#3ADA83"
                strokeWidth={3}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey={`${yearB}`}
                stroke="#8884d8"
                strokeDasharray="5 5"
                strokeWidth={2}
                dot
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Customer locations */}
      <div className="bg-[#0D1D1E] py-10 px-4">
        <h2 className="text-2xl font-bold mb-4">Customer Locations</h2>
        <div className="rounded-2xl shadow-md p-6 border-4 border-purple-100">
          <h3 className="font-semibold text-white mb-4">Sessions</h3>
          {analytics.locations.map((loc, i) => {
            const change = getChange(loc.current, loc.previous);
            const prevW = (loc.previous / maxSessions) * 100;
            const currW = (loc.current / maxSessions) * 100;
            return (
              <div key={i} className="mb-4">
                <div className="text-sm text-white mb-1">{loc.location}</div>
                <div className="relative h-6 mb-1">
                  <div
                    className="absolute h-full bg-blue-200 rounded"
                    style={{ width: `${prevW}%` }}
                  />
                  <div
                    className="absolute h-full bg-sky-500 rounded"
                    style={{ width: `${currW}%` }}
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-white">
                  <span className="font-medium">
                    {loc.current.toLocaleString()}
                  </span>
                  {change.direction !== "none" && (
                    <span
                      className={`flex items-center font-medium ${
                        change.direction === "up"
                          ? "text-green-600"
                          : "text-white"
                      }`}
                    >
                      {change.direction === "up" ? (
                        <ArrowUpRight size={14} className="mr-1" />
                      ) : (
                        <ArrowDownRight size={14} className="mr-1" />
                      )}
                      {change.value}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* New customers trend & returning customers */}
      <div className="px-6 py-10 bg-[#0D1D1E]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* New trend */}
          <div className="bg-[#161616] rounded-xl p-6 shadow-sm">
            <h3 className="text-md font-semibold text-white mb-2">
              New customers over time
            </h3>
            <p className="text-3xl font-bold text-white mb-4">
              {analytics.newCustomersTotal.toLocaleString()}
            </p>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.charts.newCustomerTrend}>
                  <XAxis dataKey="date" stroke="#888" />
                  <YAxis stroke="#888" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#161616",
                      border: "1px solid #fff",
                      borderRadius: "8px",
                      color: "#fff",
                      boxShadow: "0 4px 12px rgba(0,255,47,0.4)",
                    }}
                    cursor={{ fill: "#fff", opacity: 0.1 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#00A3FF"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-white mt-2">
              {dateRange.startDate.toLocaleDateString()} –{" "}
              {dateRange.endDate.toLocaleDateString()}
            </p>
          </div>
          {/* Returning customers */}
          <div className="bg-[#161616] rounded-xl p-6 shadow-sm">
            <h3 className="text-md font-semibold text-white border-b border-dotted mb-4">
              Returning customers
            </h3>
            <div className="space-y-4">
              {analytics.returningCustomers.map((c, idx) => {
                const w = (c.amount / maxAmount) * 100;
                return (
                  <div key={idx}>
                    <p className="text-sm text-white font-medium truncate">
                       {c.id} : {c.name} : {c.email} 
                    </p>
                    <div className="w-full h-3 bg-gray-200 rounded overflow-hidden mt-1">
                      <div
                        className="h-full bg-green-500 rounded"
                        style={{ width: `${w}%` }}
                      />
                    </div>
                    <p className="text-sm text-white mt-1">
                      ₹{c.amount.toLocaleString()} · Subscribed on{" "}
                      {c.subscribed}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Cohort Heatmap */}
      <CohortHeatmap data={analytics.cohort} />
    </div>
  );
};

export default Analytics;
