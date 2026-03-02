import React, { useState, useEffect } from "react";

const Samplemap = ({
  currentYearData = [],
  pastYearData = [],
  currentYear,
  pastYear,
}) => {
  const [metric, setMetric] = useState("delivered");
  const [layer, setLayer] = useState("state");
  const [whichYear, setWhichYear] = useState("current"); // "current" or "past"

  // Helper to compute % delivered out of (delivered + rto)
  const percent = (d, r) => (d + r ? ((d / (d + r)) * 100).toFixed(2) : "0.00");

  // Button styling helper
  const btn = (t, cur) =>
    `px-4 py-2 border rounded-lg transition-colors duration-300 ${
      t === cur
        ? "bg-green-500 border-gray-400"
        : "bg-[#161616] border-gray-600"
    }`;

  // Pick the right dataset for the map and table
  const sampleData = whichYear === "current" ? currentYearData : pastYearData;

  useEffect(() => {
    const { Highcharts } = window;
    if (!Highcharts) return;

    const TOPO = "countries/in/custom/in-all-disputed";
    if (!Highcharts.maps || !Highcharts.maps[TOPO]) return;

    // build [hc-key, value] pairs for Highcharts
    const mapData = sampleData
      .filter((item) => item.type === layer)
      .map((item) => [item.key, item[metric] || 0]);

    Highcharts.mapChart("container", {
      chart: { map: TOPO },
      title: {
        text: `India map — ${
          whichYear === "current" ? currentYear : pastYear
        } (${metric.charAt(0).toUpperCase() + metric.slice(1)})`,
      },
      colorAxis: {
        min: 0,
        max: Math.max(...mapData.map(([_, v]) => v), 1),
        stops: [
          [0, "#e6ebf5"],
          [1, "#003399"],
        ],
      },
      series: [
        {
          data: mapData,
          name: metric.charAt(0).toUpperCase() + metric.slice(1),
          joinBy: ["hc-key", 0],
          states: { hover: { color: "#a4edba" } },
          dataLabels: { enabled: true, format: "{point.name}" },
        },
      ],
    });
  }, [sampleData, metric, layer, whichYear, currentYear, pastYear]);

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 text-white h-[600px] overflow-hidden bg-[#161616] rounded-lg shadow-lg">
      {/* LEFT PANEL */}
      <div
        className="space-y-6 overflow-y-auto pr-4"
        style={{ maxHeight: "100%" }}
      >
        <h2 className="text-2xl font-semibold">RTO / Delivered Breakdown</h2>

        {/* Year Toggle */}
        <div className="flex space-x-4 font-bold">
          <button
            className={btn("current", whichYear)}
            onClick={() => setWhichYear("current")}
          >
            {currentYear}
          </button>
          <button
            className={btn("past", whichYear)}
            onClick={() => setWhichYear("past")}
          >
            {pastYear}
          </button>
        </div>

        {/* Metric Toggle */}
        <div className="flex space-x-4 font-bold">
          <button
            className={btn("delivered", metric)}
            onClick={() => setMetric("delivered")}
          >
            Delivered
          </button>
          <button
            className={btn("rto", metric)}
            onClick={() => setMetric("rto")}
          >
            RTO
          </button>
        </div>

        {/* Layer Toggle */}
        <div className="flex space-x-4 mt-4 font-bold">
          <button
            className={btn("state", layer)}
            onClick={() => setLayer("state")}
          >
            State
          </button>
          <button
            className={btn("pincode", layer)}
            onClick={() => setLayer("pincode")}
          >
            Pincode
          </button>
          <button
            className={btn("city", layer)}
            onClick={() => setLayer("city")}
          >
            City
          </button>
        </div>

        {/* Data Table */}
        <div
          className="bg-[#161616] p-4 rounded-lg shadow-lg overflow-y-auto"
          style={{ maxHeight: "300px" }}
        >
          <table className="w-full text-left">
            <thead className="bg-gray-700 text-gray-300">
              <tr>
                <th className="py-3 px-2">Name</th>
                <th className="py-3 px-2">
                  {metric.charAt(0).toUpperCase() + metric.slice(1)}
                </th>
                <th className="py-3 px-2">
                  % {metric === "delivered" ? "Delivered" : "RTO"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {sampleData
                .filter((i) => i.type === layer)
                .map((row) => (
                  <tr
                    key={`${row.type}-${row.name}`}
                    className="hover:bg-gray-800"
                  >
                    <td className="py-3 px-2">{row.name}</td>
                    <td className="py-3 px-2">{row[metric] || 0}</td>
                    <td className="py-3 px-2">
                      {metric === "delivered"
                        ? percent(row.delivered, row.rto)
                        : percent(row.rto, row.delivered)}
                      %
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* RIGHT PANEL (Map) */}
      <div className="h-[500px] overflow-hidden bg-white rounded-lg shadow-inner">
        <div
          id="container"
          style={{ width: "100%", height: "500px", margin: "0 auto" }}
        />
      </div>
    </div>
  );
};

export default Samplemap;
