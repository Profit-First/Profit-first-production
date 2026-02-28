import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Line,
  CartesianGrid,
  Cell,
} from "recharts";
import { subDays } from "date-fns";
import { PulseLoader } from "react-spinners";
import axiosInstance from "../../axios";
import { toast } from "react-toastify";
import DateRangeSelector from "../components/DateRangeSelector";
const toISTDateString = (date) => {
  const istOffset = 330 * 60 * 1000; // 5.5 hours in milliseconds
  const istDate = new Date(date.getTime() + istOffset);
  return istDate.toISOString().split("T")[0];
}; 
const Marketing = () => {
  const [adsSummaryData, setAdsSummaryData] = useState([]);
  const [metaCampaignMetrics, setMetaCampaignMetrics] = useState({});
  const [spendData, setSpendData] = useState([]);
  const [metaAdsData, setMetaAdsData] = useState([]);
  const [detailedAnalysisData, setDetailedAnalysisData] = useState([]);

  const [campaignFilter, setCampaignFilter] = useState("Best");
  const [selectedCampaign, setSelectedCampaign] = useState("Campaign 1");
  const [dateRange, setDateRange] = useState({
    startDate: subDays(new Date(), 29),
    endDate: new Date(),
  });
  const [showDateSelector, setShowDateSelector] = useState(false);
  const [loading, setLoading] = useState(true);
  const metrics = metaCampaignMetrics[selectedCampaign] || {};

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await axiosInstance.get("/data/marketingData", {
          params: {
            startDate: toISTDateString(dateRange.startDate),
            endDate: toISTDateString(dateRange.endDate),
          },
        });
        const {
          summary,
          campaignMetrics,
          spendChartData,
          adsChartData,
          analysisTable,
        } = res.data;
        toast.success("Data fetched successfully!");

        // Fallback to empty objects/arrays if data is missing
        setAdsSummaryData(summary || []);
        setMetaCampaignMetrics(campaignMetrics || {});
        setSpendData(spendChartData || []);
        setMetaAdsData(adsChartData || []);
        setDetailedAnalysisData(analysisTable || []);
        setSelectedCampaign(
          Object.keys(campaignMetrics || {})[0] || "Campaign 1"
        );
        setLoading(false);
      } catch (err) {
        console.error("Error fetching marketing data:", err);
        toast.error("Error fetching data. Please try again later.");
        setLoading(false);
      }
    };
    fetchData();
  }, [dateRange]);

  const sortedMetaAdsData = [...metaAdsData].sort((a, b) => {
    return campaignFilter === "Best" ? b.value - a.value : a.value - b.value;
  });

  const handleBarClick = (data) => {
    if (metaCampaignMetrics[data.name]) {
      setSelectedCampaign(data.name);
    }
  };

  const handleApply = (range) => {
    setDateRange(range);
    setShowDateSelector(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0D1D1E]">
        <PulseLoader size={15} color="#12EB8E" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 text-white space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Marketing Dashboard</h1>
          <p className="text-sm text-white">
            Overall Data like the main dashboard starting
          </p>
        </div>
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
            <div className="absolute top-full mt-2 z-50 right-0 bg-[#161616] rounded-lg shadow-lg border border-gray-700 parentz">
              <DateRangeSelector onApply={handleApply} />
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5 gap-8">
        {adsSummaryData.map(([title, value]) => (
          <div key={title} className="bg-[#161616] p-4 rounded-xl shadow-md">
            <div className="text-sm text-white">{title}</div>
            <div className="text-xl font-bold">{value}</div>
          </div>
        ))}
      </div>

      {/* Campaign Breakdown Button */}
      <button className="border border-gray-500 rounded px-4 py-1 text-xl z-1">
        Campaign Breakdown
      </button>

      {/* Spend, CPP and ROAS Chart */}
      <div className="bg-[#161616] rounded-xl p-4 z-1">
        <h3 className="text-xl font-medium mb-4">Spend, CPP and ROAS</h3>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={spendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis dataKey="name" stroke="#888" />
            <YAxis
              yAxisId="left"
              stroke="#888"
              tickFormatter={(v) => `${v / 1000}K`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#888"
              domain={[0, 5]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#161616",
                border: "1px solid #2e2e2e",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
                color: "#ffffff",
              }}
              wrapperStyle={{
                zIndex: 1000,
              }}
              cursor={{ fill: "#2e2e2e", opacity: 0.1 }}
            />
            <Legend />
            <Bar
              yAxisId="left"
              dataKey="cpp"
              stackId="a"
              fill="#6a66db"
              name="CPP"
            />
            <Bar
              yAxisId="left"
              dataKey="spend"
              stackId="a"
              fill="#3b82f6"
              name="Spend"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="roas"
              stroke="#ffffff"
              strokeWidth={2}
              name="ROAS"
              dot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed Analysis Table */}
      <div className="bg-[#161616] rounded-xl p-4 z-1">
        <h3 className="text-xl font-medium mb-2">Detailed Analysis</h3>

        {/* container scrolls in both X and Y if needed, capped at 80 (20rem) high */}
        <div className="overflow-auto max-h-80">
          <table className="min-w-full text-md">
            <thead className="text-white sticky top-0 bg-[#161616]">
              <tr>
                <th className="text-left p-2">Campaign</th>
                <th className="text-left p-2">Spend</th>
                <th className="text-left p-2">CPP</th>
                <th className="text-left p-2">ROAS</th>
                <th className="text-left p-2">Sales</th>
                <th className="text-left p-2">Performing Well</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(metaCampaignMetrics).map((campaign, idx) => (
                <tr key={idx} className="border-t border-gray-700">
                  <td className="p-2">{campaign}</td>
                  <td className="p-2">
                    {metaCampaignMetrics[
                      campaign
                    ]?.amountSpent?.toLocaleString() || "N/A"}
                  </td>
                  <td className="p-2">
                    {metaCampaignMetrics[campaign]?.costPerClick || "N/A"}
                  </td>
                  <td className="p-2">
                    {metaCampaignMetrics[campaign]?.roas || "N/A"}
                  </td>
                  <td className="p-2">
                    {metaCampaignMetrics[campaign]?.sales?.toLocaleString()}
                  </td>
                  <td
                    className={`p-2 ${
                      metaCampaignMetrics[campaign]?.roas >= 5
                        ? "text-green-400"
                        : metaCampaignMetrics[campaign]?.roas >= 3
                        ? "text-yellow-400"
                        : "text-red-400"
                    }`}
                  >
                    {metaCampaignMetrics[campaign]?.roas >= 5
                      ? "Performing Well"
                      : metaCampaignMetrics[campaign]?.roas >= 3
                      ? "Average"
                      : "Poor"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Meta Ads Campaigns Chart with Filter and Sorting */}
      <div className="bg-[#161616] rounded-xl p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-medium">Meta Ads Campaigns</h3>
          <select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            className="bg-[#202020] text-white text-sm px-3 py-1 rounded border border-gray-700"
          >
            <option value="Best">Best Performing</option>
            <option value="Least">Least Performing</option>
          </select>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={sortedMetaAdsData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis dataKey="name" stroke="#888" />
            <YAxis stroke="#888" />
            <Tooltip
              contentStyle={{
                backgroundColor: "#161616",
                border: "1px solid #2e2e2e",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
                color: "#ffffff",
              }}
              wrapperStyle={{
                zIndex: 1000,
              }}
              cursor={{ fill: "#2e2e2e", opacity: 0.1 }}
            />
            <Bar
              dataKey="value"
              fill="#5488d8"
              onClick={handleBarClick}
              isAnimationActive={false}
            >
              {sortedMetaAdsData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.name === selectedCampaign ? "#22c55e" : "#5488d8"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Metrics */}
      <h3 className="text-xl mb-2 text-white">
        {selectedCampaign
          ? `${selectedCampaign} Breakdown`
          : "All Campaigns Overview"}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-md text-gray-200">
        <div className="bg-[#161616] rounded-xl p-6">
          <p className="text-white">Amount Spent</p>
          <h4 className="text-lg font-semibold">
            {metrics.amountSpent?.toLocaleString() || "N/A"}
          </h4>
        </div>
        <div className="bg-[#161616] rounded-xl p-6">
          <p className="text-white">Impressions</p>
          <h4 className="text-lg font-semibold">
            {metrics.impressions?.toLocaleString() || "N/A"}
          </h4>
        </div>
        <div className="bg-[#161616] rounded-xl p-6">
          <p className="text-white">Reach</p>
          <h4 className="text-lg font-semibold">
            {metrics.reach?.toLocaleString() || "N/A"}
          </h4>
        </div>
        <div className="bg-[#161616] rounded-xl p-6">
          <p className="text-white">Link Clicks</p>
          <h4 className="text-lg font-semibold">
            {metrics.linkClicks?.toLocaleString() || "N/A"}
          </h4>
        </div>
        <div className="bg-[#161616] rounded-xl p-6">
          <p className="text-white">Cost Per Link Click</p>
          <h4 className="text-lg font-semibold">
            {metrics.costPerClick || "N/A"}
          </h4>
        </div>
        <div className="bg-[#161616] rounded-xl p-6">
          <p className="text-white">Sales</p>
          <h4 className="text-lg font-semibold">
            {metrics.sales?.toLocaleString() || "N/A"}
          </h4>
        </div>
        <div className="bg-[#161616] rounded-xl p-6">
          <p className="text-white">Cost Per Sale</p>
          <h4 className="text-lg font-semibold">
            {metrics.costPerSale || "N/A"}
          </h4>
        </div>
        <div className="bg-[#161616] rounded-xl p-6">
          <p className="text-white">ROAS</p>
          <h4
            className={`text-lg font-semibold ${
              metrics.roas < 3 ? "text-red-400" : "text-green-400"
            }`}
          >
            {metrics.roas || "N/A"}
          </h4>
        </div>
      </div>
    </div>
  );
};

export default Marketing;
