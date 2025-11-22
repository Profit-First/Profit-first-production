import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend, 
  AreaChart,
  Area,
} from "recharts";
import DateRangeSelector from "../components/DateRangeSelector";
import { subDays } from "date-fns";
import { FiInfo, FiBarChart2 } from "react-icons/fi";
import Samplemap from "../components/samplemap";
import axiosInstance from "../../axios";
import { PulseLoader } from "react-spinners";

const Shipping = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: subDays(new Date(), 29),
    endDate: new Date(),
  });
  const [showDateSelector, setShowDateSelector] = useState(false);
  const [showLastYear, setShowLastYear] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState("Shipment");
  const [activeIndex, setActiveIndex] = useState(null);
  const [years, setYears] = useState([]);
  const [currentYear, setCurrentYear] = useState(null);
  const [pastYear, setPastYear] = useState(null);

  const [rangeData, setRangeData] = useState(null);
  const [yearData, setYearData] = useState({ curr: null, past: null });

  useEffect(() => {
    const now = new Date().getFullYear();
    const list = Array.from({ length: 5 }, (_, i) => now - i);
    setYears(list);
    setCurrentYear(list[0]);
    setPastYear(list[1]);
  }, []);

  // fetch summary based on date range
  useEffect(() => {
    setLoading(true);
    setError(null);
    axiosInstance
      .get("/data/shipping", {
        params: {
          startDate: dateRange.startDate.toISOString().slice(0, 10),
          endDate: dateRange.endDate.toISOString().slice(0, 10),
        },
      })
      .then((res) => {
        setRangeData(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load summary data.");
        setLoading(false);
      });
  }, [dateRange]);

  // fetch yearly breakdowns
  useEffect(() => {
    if (currentYear == null || pastYear == null) return;
    setLoading(true);
    setError(null);
    const fetchYear = (y) =>
      axiosInstance
        .get("/data/shipping", {
          params: { startDate: `${y}-01-01`, endDate: `${y}-12-31` },
        })
        .then((r) => r.data);
    Promise.all([fetchYear(currentYear), fetchYear(pastYear)])
      .then(([curr, past]) => {
        setYearData({ curr, past });
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load breakdown data.");
        setLoading(false);
      });
  }, [currentYear, pastYear]);

  if (loading || !rangeData || !yearData.curr) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0D1D1E]">
        <PulseLoader size={15} color="#12EB8E" />
      </div>
    );
  }
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  const getValueBasedStops = (data) => {
    const values = data.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return data.map((point, index) => {
      const percent = (index / (data.length - 1)) * 100;
      const valueRatio = (point.value - min) / range;
      let color;
      if (valueRatio < 0.33) {
        color = interpolateColor("#C82B2B", "#DAD239", valueRatio / 0.33);
      } else if (valueRatio > 0.66) {
        color = interpolateColor(
          "#DAD239",
          "#3ADA83",
          (valueRatio - 0.66) / 0.34
        );
      } else {
        color = "#DAD239";
      }
      return (
        <stop
          key={index}
          offset={`${percent}%`}
          stopColor={color}
          stopOpacity={1}
        />
      );
    });
  };
  const interpolateColor = (startColor, endColor, ratio) => {
    const start = hexToRgb(startColor);
    const end = hexToRgb(endColor);
    const r = Math.round(start.r + (end.r - start.r) * ratio);
    const g = Math.round(start.g + (end.g - start.g) * ratio);
    const b = Math.round(start.b + (end.b - start.b) * ratio);
    return rgbToHex(r, g, b);
  };
  const hexToRgb = (hex) => {
    let r = 0,
      g = 0,
      b = 0;
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
      r = parseInt(hex[1] + hex[2], 16);
      g = parseInt(hex[3] + hex[4], 16);
      b = parseInt(hex[5] + hex[6], 16);
    }
    return { r, g, b };
  };
  const rgbToHex = (r, g, b) => {
    return (
      "#" +
      ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()
    );
  };

  // Safely access chartData
  const gradientStops =
    yearData.curr?.chartData?.[selectedMetric] &&
    getValueBasedStops(yearData.curr.chartData[selectedMetric]);

  const shipmentColors = [
    "#3ADA83",
    "#C82B2B",
    "#DAD239",
    "#4b69d6",
    "#00B0FF",
  ];
  const codColors = ["#1c8d23", "#98d49a"];
  const NDRColors = ["#00B0FF", "#4b69d6", "#3ADA83", "#C82B2B", "#DAD239"];

  const handleApply = (range) => {
    setDateRange(range);
    setShowDateSelector(false);
  };
  const onMouseEnter = (i) => setActiveIndex(i);
  const onMouseLeave = () => setActiveIndex(null);

  return (
    <div className="p-6 text-white space-y-6 bg-[#0D1D1E] min-h-screen">
      <h2 className="text-2xl font-bold text-red-500">This section is under maintenance</h2>

      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h2 className="text-2xl font-bold">Shipping</h2>
        <div className="flex items-center gap-4 relative">
          <button
            onClick={() => setShowDateSelector(!showDateSelector)}
            className="px-3 py-1 rounded-md text-sm border bg-[#161616] border-gray-700"
          >
            {dateRange
              ? `${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()}`
              : "Select Date Range"}
          </button>

          {showDateSelector && (
            <div className="absolute top-full mt-2 right-0 z-50 bg-[#161616] rounded-lg shadow-lg border border-gray-700">
              <DateRangeSelector onApply={handleApply} />
            </div>
          )}

        

        </div>
      </div>

      <div className="space-y-4">
        {/* Row 1 – first 4 summary items */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {rangeData.summaryData.slice(0, 4).map(([title, value]) => (
            <div
              key={title}
              className="bg-[#161616] p-4 rounded-xl z-1 h-fit flex flex-col justify-center items-center"
            >
              <div className="text-sm text-gray-300">{title}</div>
              <div className="text-xl font-bold">{value}</div>
            </div>
          ))}
        </div>

        {/* Row 2 – next 5 summary items */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 ">
          {rangeData.summaryData.slice(4, 9).map(([title, value]) => (
            <div
              key={title}
              className="bg-[#161616] p-4 rounded-xl z-1 h-fit flex flex-col justify-center items-center"
            >
              <div className="text-sm text-gray-300">{title}</div>
              <div className="text-xl font-bold">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Shipping Chart Section */}
      <div className="">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Shipping BreakDown</h2>
        </div>
        <div className="bg-[#161616] rounded-2xl p-6 flex justify-between gap-4 align-center">
          <div className="mt-6 w-full">
            <div className="flex items-center justify-between mb-2">
              <div className="space-x-2">
                {["Shipment", "ShipmentCost", "Delivered", "RTO"].map(
                  (metric) => (
                    <button
                      key={metric}
                      onClick={() => setSelectedMetric(metric)}
                      className={`px-3 py-1 rounded-lg text-sm ${
                        selectedMetric === metric
                          ? "bg-[#00B0FF] text-white font-bold"
                          : "bg-[#434343] text-white"
                      }`}
                    >
                      {metric}
                    </button>
                  )
                )}
              </div>
              <div className="flex items-center gap-4 relative">
                {/* map year selectore  */}
                <select
                  value={currentYear}
                  onChange={(e) => setcurrentYear(+e.target.value)}
                  className="px-2 py-1 bg-[#161616] border rounded cursor-pointer"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <select
                  value={pastYear}
                  onChange={(e) => setpastYear(+e.target.value)}
                  className="px-2 py-1 bg-[#161616] border rounded cursor-pointer"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setShowLastYear((ys) => !ys)}
                  className="ml-4 text-sm text-gray-300"
                >
                  {showLastYear ? "Hide Last Year" : "Show Last Year"}
                </button>
              </div>
            </div>
            {yearData.curr.chartData[selectedMetric] && (
              <div className="h-64 bg-[#161616] rounded-lg p-4 z-1 ">
                {/* Area Chart */}
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={yearData.curr.chartData[selectedMetric]}>
                    <XAxis dataKey="name" stroke="#888" />
                    <YAxis stroke="#888" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#161616",
                        border: "none",
                      }}
                      labelStyle={{ color: "#fff" }}
                      itemStyle={{ color: "#3ADA83" }}
                    />
                    <defs>
                      <linearGradient
                        id="colorUv"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="0%"
                      >
                        {gradientStops}
                      </linearGradient>
                      <linearGradient
                        id="lineGradient"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="0%"
                      >
                        {gradientStops}
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="url(#lineGradient)"
                      fill="url(#colorUv)"
                      strokeWidth={3}
                      dot={{ fill: "#3ADA83", r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    {showLastYear && (
                      <Area
                        type="monotone"
                        data={yearData.past.chartData[selectedMetric]}
                        dataKey="Lastvalue"
                        stroke="#FF5733"
                        fill="url(#lastYearGradient)"
                        strokeWidth={2}
                        dot={{ fill: "#FF5733", r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-[#161616] rounded-xl shadow-md p-4 w-[450px] shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-white font-semibold text-sm">
                Overall Shipment Status
              </h2>
              <FiInfo className="text-white text-lg cursor-pointer" />
            </div>

            <PieChart width={400} height={350}>
              <Pie
                data={rangeData.shipmentStatusData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={110}
                dataKey="value"
                onClick={undefined}
                style={{ cursor: "default", pointerEvents: "none" }}
              >
                {rangeData.shipmentStatusData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={shipmentColors[index]}
                    style={{
                      filter:
                        activeIndex === index
                          ? "drop-shadow(0px 0px 10px rgba(3, 201, 0, 0.7))"
                          : "none",
                      transition: "filter 0.3s ease",
                    }}
                    onMouseEnter={() => onMouseEnter(index)}
                    onMouseLeave={onMouseLeave}
                  />
                ))}
              </Pie>

              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  borderRadius: "8px",
                  border: "none",
                  color: "#fff",
                }}
                cursor={{ fill: "transparent" }}
              />

              <Legend
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                iconType="circle"
                iconSize={12}
                formatter={(value) => (
                  <span className="text-sm text-white">{value}</span>
                )}
              />
            </PieChart>
          </div>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mt-6">
          <h2 className="text-2xl font-bold">COD Payment Status</h2>
        </div>

        <div className="flex justify-between mt-6 bg-[#161616] rounded-2xl p-6">
          {/* Overall Shipment Status */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-4 ml-24">
            {rangeData.codPaymentStatus.map(([title, value]) => (
              <div
                key={title}
                className="bg-[#161616] p-4 rounded-xl z-1 h-fit w-[500px] flex flex-col justify-center items-center"
              >
                <div className="text-sm text-gray-300">{title}</div>
                <div className="text-xl font-bold">{value}</div>
              </div>
            ))}
          </div>

          <div className="bg-[#161616] rounded-xl shadow-md p-4 w-[450px]">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-white font-semibold text-sm">
                Prepaid vs. COD Orders
              </h2>
              <FiBarChart2 className="text-purple-400 text-lg cursor-pointer" />
            </div>
            <PieChart width={400} height={350}>
              <Pie
                data={rangeData.prepaidCodData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={110}
                dataKey="value"
                onClick={undefined}
                style={{ cursor: "default", pointerEvents: "none" }}
              >
                {rangeData.prepaidCodData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={codColors[index]}
                    style={{
                      filter:
                        activeIndex === index
                          ? "drop-shadow(0px 0px 10px rgba(3, 201, 0, 0.7))"
                          : "none",
                      transition: "filter 0.3s ease",
                    }}
                    onMouseEnter={() => onMouseEnter(index)}
                    onMouseLeave={onMouseLeave}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  borderRadius: "8px",
                  border: "none",
                  color: "#fff",
                }}
                cursor={{ fill: "transparent" }}
              />
              <Legend
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                iconType="circle"
                iconSize={12}
                formatter={(value) => (
                  <span className="text-sm text-white">{value}</span>
                )}
              />
            </PieChart>
          </div>
        </div>
      </div>
      <div>
        <div className="flex justify-between items-center mt-6">
          <h2 className="text-2xl font-bold">NDR Status</h2>
        </div>
        <div className="flex justify-between mt-6 bg-[#161616] rounded-2xl p-6">
          {/* Overall Shipment Status */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-4 ml-24">
            {rangeData.ndrSummary.map(([title, value]) => (
              <div
                key={title}
                className="bg-[#161616] p-4 rounded-xl z-1 h-fit w-[500px] flex flex-col justify-center items-center"
              >
                <div className="text-sm text-gray-300">{title}</div>
                <div className="text-xl font-bold">{value}</div>
              </div>
            ))}
          </div>

          <div className="bg-[#161616] rounded-xl shadow-md p-4 w-[450px]">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-white font-semibold text-sm">NDR Status</h2>
              <FiBarChart2 className="text-purple-400 text-lg cursor-pointer" />
            </div>
            <PieChart width={400} height={350}>
              <Pie
                data={rangeData.ndrStatusData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={110}
                dataKey="value"
                onClick={undefined}
                style={{ cursor: "default", pointerEvents: "none" }}
              >
                {rangeData.ndrStatusData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={NDRColors[index]}
                    style={{
                      filter:
                        activeIndex === index
                          ? "drop-shadow(0px 0px 10px rgba(3, 201, 0, 0.7))"
                          : "none",
                      transition: "filter 0.3s ease",
                    }}
                    onMouseEnter={() => onMouseEnter(index)}
                    onMouseLeave={onMouseLeave}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  borderRadius: "8px",
                  border: "none",
                  color: "#fff",
                }}
                cursor={{ fill: "transparent" }}
              />
              <Legend
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                iconType="circle"
                iconSize={12}
                formatter={(value) => (
                  <span className="text-sm text-white">{value}</span>
                )}
              />
            </PieChart>
          </div>
        </div>
      </div>

      <Samplemap
        currentYearData={yearData.curr.sampleData}
        pastYearData={yearData.past.sampleData}
        currentYear={currentYear}
        pastYear={pastYear}
      />
    </div>
  );
};

export default Shipping;
